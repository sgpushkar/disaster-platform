"""
Admin-only endpoints, protected by require_admin (role must be 'admin').
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.models import (
    User, Prediction, WeatherData, EmergencyLocation, Alert,
    RiskLevelEnum, AlertSourceEnum, RiskSnapshot, DangerZone
)
from app.schemas.schemas import (
    UserOut, RiskPredictionOut, WeatherOut, EmergencyLocationOut,
    EmergencyLocationCreate, AlertOut, AlertCreate, RiskSnapshotOut,
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
    valid_types = {"hospital", "shelter", "police", "fire_station", "safe_zone", "danger_zone"}
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

    level_map = {
        "Low": RiskLevelEnum.low,
        "Moderate": RiskLevelEnum.moderate,
        "High": RiskLevelEnum.high,
        "Critical": RiskLevelEnum.critical,
    }
    alert = Alert(
        title=payload.title,
        message=payload.message,
        risk_level=level_map[payload.risk_level],
        risk_score=payload.risk_score,
        latitude=payload.latitude,
        longitude=payload.longitude,
        location_name=payload.location_name,
        recommended_action=payload.recommended_action,
        expires_at=payload.expires_at,
        source=AlertSourceEnum.admin,
        is_active=True,
    )
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


@router.get("/risk-overview", response_model=list[RiskSnapshotOut])
def risk_overview(
    limit: int = 20,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Returns the most recent risk snapshots for regional overview."""
    return (
        db.query(RiskSnapshot)
        .order_by(RiskSnapshot.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/seed-locations", status_code=201)
def seed_locations(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    """
    Seeds development emergency location data for Pune, India.
    These are clearly marked as seed/development data and should NOT be
    represented as real verified emergency infrastructure in production.
    Run: POST /admin/seed-locations
    """
    # Check and add only missing seed locations

    seed = [
        # ---- Pune Hospitals ----
        {"name": "Sassoon General Hospital", "latitude": 18.5163, "longitude": 73.8569, "type": "hospital",
         "capacity": 1800, "availability_status": "open", "risk_level": "Low",
         "description": "Major public hospital, Pune (Dev seed data — not verified)",
         "contact": "020-26128000"},
        {"name": "KEM Hospital Pune", "latitude": 18.5246, "longitude": 73.8553, "type": "hospital",
         "capacity": 900, "availability_status": "open", "risk_level": "Low",
         "description": "KEM Hospital (Dev seed data — not verified)", "contact": "020-26127544"},
        {"name": "Ruby Hall Clinic", "latitude": 18.5312, "longitude": 73.8794, "type": "hospital",
         "capacity": 450, "availability_status": "open", "risk_level": "Low",
         "description": "Private hospital (Dev seed data — not verified)", "contact": "020-66455000"},

        # ---- Pune Shelters ----
        {"name": "Shivaji Nagar Community Shelter", "latitude": 18.5308, "longitude": 73.8474, "type": "shelter",
         "capacity": 500, "current_occupancy": 0, "availability_status": "open", "risk_level": "Low",
         "description": "Municipal evacuation shelter (Dev seed data — not verified)"},
        {"name": "Baner Relief Camp", "latitude": 18.5590, "longitude": 73.7868, "type": "shelter",
         "capacity": 300, "current_occupancy": 0, "availability_status": "open", "risk_level": "Low",
         "description": "Flood relief camp (Dev seed data — not verified)"},
        {"name": "Hadapsar Evacuation Centre", "latitude": 18.5018, "longitude": 73.9260, "type": "shelter",
         "capacity": 400, "current_occupancy": 0, "availability_status": "open", "risk_level": "Low",
         "description": "Relief centre near Hadapsar (Dev seed data — not verified)"},

        # ---- Pune Police ----
        {"name": "Deccan Gymkhana Police Station", "latitude": 18.5190, "longitude": 73.8423, "type": "police",
         "description": "Police station (Dev seed data — not verified)", "contact": "020-25672300"},
        {"name": "Shivajinagar Police Station", "latitude": 18.5295, "longitude": 73.8417, "type": "police",
         "description": "Police station (Dev seed data — not verified)", "contact": "020-25512444"},

        # ---- Pune Fire Stations ----
        {"name": "Pune Fire Brigade HQ", "latitude": 18.5204, "longitude": 73.8567, "type": "fire_station",
         "description": "Fire station (Dev seed data — not verified)", "contact": "101"},
        {"name": "Kothrud Fire Station", "latitude": 18.5074, "longitude": 73.8090, "type": "fire_station",
         "description": "Fire station (Dev seed data — not verified)", "contact": "101"},

        # ---- Safe Zones (elevated ground) ----
        {"name": "Vetal Hill Safe Zone", "latitude": 18.5421, "longitude": 73.8139, "type": "safe_zone",
         "capacity": 2000, "availability_status": "open", "risk_level": "Low",
         "description": "Elevated area — low flood risk (Dev seed data — not verified)"},
        {"name": "Chatushringi Area Safe Zone", "latitude": 18.5531, "longitude": 73.8207, "type": "safe_zone",
         "capacity": 1500, "availability_status": "open", "risk_level": "Low",
         "description": "Higher elevation zone (Dev seed data — not verified)"},

        # ---- Mumbai Hospitals ----
        {"name": "KEM Hospital Mumbai", "latitude": 18.9996, "longitude": 72.8427, "type": "hospital",
         "capacity": 1800, "availability_status": "open", "risk_level": "Low",
         "description": "Major tertiary care public hospital, Parel (Dev seed data)", "contact": "022-24107000"},
        {"name": "Lilavati Hospital Bandra", "latitude": 19.0515, "longitude": 72.8286, "type": "hospital",
         "capacity": 350, "availability_status": "open", "risk_level": "Low",
         "description": "Multi-specialty hospital, Bandra West (Dev seed data)", "contact": "022-26751000"},
        {"name": "Sion Hospital (LTMMC)", "latitude": 19.0360, "longitude": 72.8600, "type": "hospital",
         "capacity": 1400, "availability_status": "open", "risk_level": "Low",
         "description": "Civic hospital, Sion (Dev seed data)", "contact": "022-24076381"},

        # ---- Mumbai Shelters ----
        {"name": "BKC MMRDA Evacuation Camp", "latitude": 19.0667, "longitude": 72.8647, "type": "shelter",
         "capacity": 1000, "current_occupancy": 50, "availability_status": "open", "risk_level": "Low",
         "description": "Central flood relief & transit shelter (Dev seed data)"},
        {"name": "Dadar Municipal Relief Centre", "latitude": 19.0178, "longitude": 72.8478, "type": "shelter",
         "capacity": 600, "current_occupancy": 0, "availability_status": "open", "risk_level": "Low",
         "description": "Municipal emergency shelter, Dadar (Dev seed data)"},
        {"name": "Andheri West Sports Complex Shelter", "latitude": 19.1350, "longitude": 72.8280, "type": "shelter",
         "capacity": 800, "current_occupancy": 0, "availability_status": "open", "risk_level": "Low",
         "description": "Community evacuation centre (Dev seed data)"},

        # ---- Mumbai Fire Stations ----
        {"name": "Byculla Fire Station HQ", "latitude": 18.9750, "longitude": 72.8330, "type": "fire_station",
         "description": "Mumbai Fire Brigade headquarters (Dev seed data)", "contact": "101"},
        {"name": "Bandra Fire Station", "latitude": 19.0558, "longitude": 72.8397, "type": "fire_station",
         "description": "Bandra division fire station (Dev seed data)", "contact": "101"},

        # ---- Mumbai Safe Zones (Elevated Ground) ----
        {"name": "Malabar Hill Safe Zone", "latitude": 18.9548, "longitude": 72.7985, "type": "safe_zone",
         "capacity": 3000, "availability_status": "open", "risk_level": "Low",
         "description": "Elevated ridge terrain, minimal flood risk (Dev seed data)"},
        {"name": "Powai Hills High Ground Safe Zone", "latitude": 19.1235, "longitude": 72.9080, "type": "safe_zone",
         "capacity": 2500, "availability_status": "open", "risk_level": "Low",
         "description": "Elevated plateau near IIT Bombay (Dev seed data)"},
    ]

    for loc_data in seed:
        existing_loc = db.query(EmergencyLocation).filter(EmergencyLocation.name == loc_data["name"]).first()
        if not existing_loc:
            loc = EmergencyLocation(**loc_data, is_seed_data=True)
            db.add(loc)

    db.commit()
    return {"detail": f"Seeded development emergency locations for Pune and Mumbai."}
