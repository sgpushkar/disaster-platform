"""
/dashboard, /history, /map, /alerts endpoints.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import WeatherData, FloodImage, Prediction, Alert, EmergencyLocation
from app.schemas.schemas import (
    DashboardOut, WeatherOut, FloodImageOut, RiskPredictionOut, AlertOut,
    EmergencyLocationOut, RainfallPredictOut,
)
import json

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardOut)
def get_dashboard(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
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
    alerts = db.query(Alert).order_by(Alert.timestamp.desc()).limit(5).all()

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
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return db.query(Alert).order_by(Alert.timestamp.desc()).limit(limit).all()
