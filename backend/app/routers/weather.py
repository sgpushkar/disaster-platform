"""
/weather endpoint - fetches live weather and stores it.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.schemas import WeatherOut
from app.services.weather_service import fetch_current_weather, WeatherServiceError

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
