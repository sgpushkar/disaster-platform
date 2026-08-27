"""
Admin-only endpoints, protected by require_admin (role must be 'admin').
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.models import User, Prediction, WeatherData, EmergencyLocation, Alert
from app.schemas.schemas import (
    UserOut, RiskPredictionOut, WeatherOut, EmergencyLocationOut,
    EmergencyLocationCreate, AlertOut, AlertCreate,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    return db.query(User).all()


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}


@router.get("/predictions", response_model=list[RiskPredictionOut])
def list_predictions(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    return db.query(Prediction).order_by(Prediction.created_at.desc()).all()


@router.get("/weather", response_model=list[WeatherOut])
def list_weather_records(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    return db.query(WeatherData).order_by(WeatherData.timestamp.desc()).all()


@router.get("/locations", response_model=list[EmergencyLocationOut])
def list_locations(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    return db.query(EmergencyLocation).all()


@router.post("/locations", response_model=EmergencyLocationOut, status_code=201)
def create_location(
    payload: EmergencyLocationCreate, db: Session = Depends(get_db), _admin=Depends(require_admin)
):
    valid_types = {"hospital", "shelter", "police", "danger_zone"}
    if payload.type not in valid_types:
        raise HTTPException(status_code=400, detail=f"type must be one of {valid_types}")
    loc = EmergencyLocation(**payload.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@router.delete("/locations/{location_id}")
def delete_location(location_id: int, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    loc = db.query(EmergencyLocation).filter(EmergencyLocation.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    db.delete(loc)
    db.commit()
    return {"detail": "Location deleted"}


@router.post("/alerts", response_model=AlertOut, status_code=201)
def create_alert(payload: AlertCreate, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    valid_levels = {"Low", "Moderate", "High", "Critical"}
    if payload.risk_level not in valid_levels:
        raise HTTPException(status_code=400, detail=f"risk_level must be one of {valid_levels}")
    alert = Alert(**payload.model_dump())
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.delete("/alerts/{alert_id}")
def delete_alert(alert_id: int, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
    return {"detail": "Alert deleted"}
