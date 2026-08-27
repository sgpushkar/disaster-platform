"""
/warnings/active, /danger-zones endpoints.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.models import Alert, DangerZone, RiskLevelEnum
from app.schemas.schemas import AlertOut, DangerZoneOut, DangerZoneCreate

router = APIRouter(tags=["warnings"])


@router.get("/warnings/active", response_model=list[AlertOut])
def get_active_warnings(
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns currently active alerts (not expired, is_active=True).
    Includes both AI-generated and admin-broadcast alerts.
    """
    now = datetime.utcnow()
    q = db.query(Alert).filter(Alert.is_active == True)
    # Filter out expired alerts (expires_at < now)
    q = q.filter((Alert.expires_at == None) | (Alert.expires_at > now))
    return q.order_by(Alert.timestamp.desc()).limit(limit).all()


@router.get("/danger-zones", response_model=list[DangerZoneOut])
def get_danger_zones(
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Returns danger zones (active by default)."""
    now = datetime.utcnow()
    q = db.query(DangerZone)
    if active_only:
        q = q.filter(DangerZone.is_active == True)
        q = q.filter((DangerZone.expires_at == None) | (DangerZone.expires_at > now))
    return q.order_by(DangerZone.timestamp.desc()).all()


@router.post("/danger-zones", response_model=DangerZoneOut, status_code=201)
def create_danger_zone(
    payload: DangerZoneCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Admin: create a manual danger zone."""
    valid_levels = {"Low", "Moderate", "High", "Critical"}
    if payload.risk_level not in valid_levels:
        raise HTTPException(400, f"risk_level must be one of {valid_levels}")

    level_map = {
        "Low": RiskLevelEnum.low,
        "Moderate": RiskLevelEnum.moderate,
        "High": RiskLevelEnum.high,
        "Critical": RiskLevelEnum.critical,
    }
    zone = DangerZone(
        latitude=payload.latitude,
        longitude=payload.longitude,
        radius_m=payload.radius_m,
        risk_score=payload.risk_score,
        risk_level=level_map[payload.risk_level],
        source=payload.source or "admin",
        description=payload.description,
        expires_at=payload.expires_at,
        is_active=True,
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone
