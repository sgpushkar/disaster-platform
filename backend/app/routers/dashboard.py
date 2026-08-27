"""
/dashboard, /history, /map, /alerts endpoints.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import WeatherData, FloodImage, Prediction, Alert, EmergencyLocation, RiskSnapshot
from app.schemas.schemas import (
    DashboardOut, WeatherOut, FloodImageOut, RiskPredictionOut, AlertOut,
    EmergencyLocationOut, RainfallPredictOut, RiskSnapshotOut,
)
import json

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardOut)
def get_dashboard(
    lat: float | None = Query(default=None),
    lon: float | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Try fetching live weather if lat/lon provided or no weather exists in DB
    from app.services.weather_service import fetch_current_weather
    try:
        weather = fetch_current_weather(db, lat=lat, lon=lon)
    except Exception:
        weather = db.query(WeatherData).order_by(WeatherData.timestamp.desc()).first()

    flood_img = db.query(FloodImage).order_by(FloodImage.created_at.desc()).first()
    rainfall_pred = (
        db.query(Prediction)
        .filter(Prediction.prediction_type == "rainfall")
        .order_by(Prediction.created_at.desc())
        .first()
    )
    risk_pred = (
        db.query(Prediction)
        .filter(Prediction.prediction_type == "risk_combined")
        .order_by(Prediction.created_at.desc())
        .first()
    )
    # Also get latest risk snapshot (from new /risk/current endpoint)
    risk_snapshot = (
        db.query(RiskSnapshot)
        .order_by(RiskSnapshot.created_at.desc())
        .first()
    )

    # Active alerts only (not expired)
    now = datetime.utcnow()
    alerts = (
        db.query(Alert)
        .filter(Alert.is_active == True)
        .filter((Alert.expires_at == None) | (Alert.expires_at > now))
        .order_by(Alert.timestamp.desc())
        .limit(5)
        .all()
    )
    active_warnings_count = (
        db.query(Alert)
        .filter(Alert.is_active == True)
        .filter((Alert.expires_at == None) | (Alert.expires_at > now))
        .count()
    )

    rainfall_out = None
    if rainfall_pred and rainfall_pred.details_json:
        d = json.loads(rainfall_pred.details_json)
        rainfall_out = RainfallPredictOut(tomorrow_mm=d["tomorrow_mm"], next_3_days_mm=d["next_3_days_mm"])

    return DashboardOut(
        current_weather=weather,
        latest_flood_prediction=flood_img,
        latest_rainfall_forecast=rainfall_out,
        current_risk=risk_pred,
        recent_alerts=alerts,
        current_risk_snapshot=risk_snapshot,
        active_warnings_count=active_warnings_count,
    )


@router.get("/history", response_model=list[RiskPredictionOut])
def get_history(
    limit: int = Query(default=50, le=500),
    prediction_type: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(Prediction)
    if prediction_type:
        q = q.filter(Prediction.prediction_type == prediction_type)
    return q.order_by(Prediction.created_at.desc()).limit(limit).all()


@router.get("/map", response_model=list[EmergencyLocationOut])
def get_map_locations(
    location_type: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(EmergencyLocation)
    if location_type:
        q = q.filter(EmergencyLocation.type == location_type)
    return q.all()


@router.get("/alerts", response_model=list[AlertOut])
def get_alerts(
    limit: int = Query(default=20, le=200),
    active_only: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    now = datetime.utcnow()
    q = db.query(Alert)
    if active_only:
        q = q.filter(Alert.is_active == True)
        q = q.filter((Alert.expires_at == None) | (Alert.expires_at > now))
    return q.order_by(Alert.timestamp.desc()).limit(limit).all()
