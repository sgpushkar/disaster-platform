"""
/weather endpoint - fetches live weather and stores it.
POST /weather/refresh - forces a cache bypass.
GET /weather/forecast - returns 5-day daily summary.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.schemas import WeatherOut
from app.services.weather_service import (
    fetch_current_weather,
    WeatherServiceError,
    get_daily_forecast_summary,
)

router = APIRouter(tags=["weather"])


@router.get("/weather", response_model=WeatherOut)
def get_weather(
    lat: float | None = Query(default=None),
    lon: float | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        record = fetch_current_weather(db, lat, lon)
        return record
    except WeatherServiceError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/weather/refresh", response_model=WeatherOut)
def refresh_weather(
    lat: float | None = Query(default=None),
    lon: float | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Forces a fresh fetch from OpenWeatherMap, bypassing the cache."""
    try:
        record = fetch_current_weather(db, lat, lon, force_refresh=True)
        return record
    except WeatherServiceError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/weather/forecast")
def get_forecast(
    lat: float | None = Query(default=None),
    lon: float | None = Query(default=None),
    current_user=Depends(get_current_user),
):
    """Returns 4-day daily rainfall/temperature summary from OWM 5-day forecast."""
    try:
        return get_daily_forecast_summary(lat, lon)
    except WeatherServiceError as e:
        raise HTTPException(status_code=503, detail=str(e))
