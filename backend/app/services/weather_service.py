"""
Fetches live weather from OpenWeatherMap and persists it to the DB.
Includes a simple in-memory TTL cache to respect API rate limits.
"""
import time
from datetime import datetime

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import WeatherData

OWM_CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather"
OWM_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"

# Simple in-memory cache: {cache_key: (timestamp, data)}
_weather_cache: dict[str, tuple[float, dict]] = {}


class WeatherServiceError(Exception):
    pass


def _cache_key(lat: float, lon: float) -> str:
    return f"{round(lat, 3)}_{round(lon, 3)}"


def _is_cached(key: str) -> bool:
    if key not in _weather_cache:
        return False
    ts, _ = _weather_cache[key]
    return (time.time() - ts) < settings.WEATHER_CACHE_SECONDS


def fetch_current_weather(
    db: Session,
    lat: float | None = None,
    lon: float | None = None,
    force_refresh: bool = False,
) -> WeatherData:
    if not settings.OPENWEATHER_API_KEY:
        raise WeatherServiceError(
            "OPENWEATHER_API_KEY is not set. Add it to backend/.env — get a free key at "
            "https://openweathermap.org/api"
        )

    lat = lat if lat is not None else settings.OPENWEATHER_DEFAULT_LAT
    lon = lon if lon is not None else settings.OPENWEATHER_DEFAULT_LON
    key = _cache_key(lat, lon)

    if not force_refresh and _is_cached(key):
        # Return the most recent DB record without hitting OWM again
        existing = db.query(WeatherData).order_by(WeatherData.timestamp.desc()).first()
        if existing:
            return existing

    params = {
        "lat": lat,
        "lon": lon,
        "appid": settings.OPENWEATHER_API_KEY,
        "units": "metric",
    }

    with httpx.Client(timeout=10.0) as client:
        resp = client.get(OWM_CURRENT_URL, params=params)
        if resp.status_code != 200:
            raise WeatherServiceError(f"OpenWeatherMap error: {resp.status_code} {resp.text}")
        data = resp.json()

    # Cache raw response
    _weather_cache[key] = (time.time(), data)

    rainfall_mm = 0.0
    if "rain" in data:
        rainfall_mm = data["rain"].get("1h", data["rain"].get("3h", 0.0))

    record = WeatherData(
        temperature=data["main"]["temp"],
        humidity=data["main"]["humidity"],
        wind_speed=data["wind"]["speed"],
        rainfall=rainfall_mm,
        pressure=data["main"]["pressure"],
        latitude=lat,
        longitude=lon,
        location_name=data.get("name", ""),
        timestamp=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def fetch_5day_forecast(lat: float | None = None, lon: float | None = None) -> list[dict]:
    if not settings.OPENWEATHER_API_KEY:
        raise WeatherServiceError("OPENWEATHER_API_KEY is not set.")

    lat = lat if lat is not None else settings.OPENWEATHER_DEFAULT_LAT
    lon = lon if lon is not None else settings.OPENWEATHER_DEFAULT_LON

    params = {"lat": lat, "lon": lon, "appid": settings.OPENWEATHER_API_KEY, "units": "metric"}
    with httpx.Client(timeout=10.0) as client:
        resp = client.get(OWM_FORECAST_URL, params=params)
        if resp.status_code != 200:
            raise WeatherServiceError(f"OpenWeatherMap error: {resp.status_code} {resp.text}")
        data = resp.json()

    return [
        {
            "datetime": item["dt_txt"],
            "temperature": item["main"]["temp"],
            "humidity": item["main"]["humidity"],
            "rainfall_mm": item.get("rain", {}).get("3h", 0.0),
            "wind_speed": item["wind"]["speed"],
            "pressure": item["main"]["pressure"],
            "description": item["weather"][0]["description"] if item.get("weather") else "",
        }
        for item in data.get("list", [])
    ]


def get_daily_forecast_summary(lat: float | None = None, lon: float | None = None) -> list[dict]:
    """
    Returns 4-day daily rainfall summary aggregated from the 5-day 3h forecast.
    Suitable for input to the LSTM rainfall model and dashboard display.
    """
    items = fetch_5day_forecast(lat, lon)

    # Aggregate by day
    daily: dict[str, dict] = {}
    for item in items:
        day = item["datetime"][:10]  # YYYY-MM-DD
        if day not in daily:
            daily[day] = {"total_rainfall_mm": 0.0, "max_temp": -999, "min_humidity": 999, "count": 0}
        daily[day]["total_rainfall_mm"] += item["rainfall_mm"]
        daily[day]["max_temp"] = max(daily[day]["max_temp"], item["temperature"])
        daily[day]["min_humidity"] = min(daily[day]["min_humidity"], item["humidity"])
        daily[day]["count"] += 1

    result = []
    for day, vals in sorted(daily.items())[:4]:
        result.append({
            "date": day,
            "total_rainfall_mm": round(vals["total_rainfall_mm"], 2),
            "max_temp": vals["max_temp"],
            "min_humidity": vals["min_humidity"],
        })
    return result
