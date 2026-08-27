"""
Fetches live weather from OpenWeatherMap and persists it to the DB.
"""
from datetime import datetime

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import WeatherData

OWM_CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather"
OWM_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"


class WeatherServiceError(Exception):
    pass


def fetch_current_weather(
    db: Session,
    lat: float | None = None,
    lon: float | None = None,
) -> WeatherData:
    if not settings.OPENWEATHER_API_KEY:
        raise WeatherServiceError(
            "OPENWEATHER_API_KEY is not set. Add it to backend/.env — get a free key at "
            "https://openweathermap.org/api"
        )

    lat = lat if lat is not None else settings.OPENWEATHER_DEFAULT_LAT
    lon = lon if lon is not None else settings.OPENWEATHER_DEFAULT_LON

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
        }
        for item in data.get("list", [])
    ]
