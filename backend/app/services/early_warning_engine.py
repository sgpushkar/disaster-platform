"""
Early Warning Engine — evaluates current risk conditions and generates
alerts when risk crosses configured thresholds.

Alert deduplication: will not create a new alert if an alert of the same
or higher level already exists for the same location within ALERT_DEDUP_HOURS.

Warning levels:
    none       — risk < WARNING_THRESHOLD_MODERATE
    advisory   — MODERATE (25–49)
    warning    — HIGH (50–74)
    emergency  — CRITICAL (75+)
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Alert, AlertSourceEnum, RiskLevelEnum


# -------------------------------------------------------
# Warning level labels and messages
# -------------------------------------------------------
_LEVEL_MAP = {
    "Low": "none",
    "Moderate": "advisory",
    "High": "warning",
    "Critical": "emergency",
}

_TITLES = {
    "Moderate": "⚠️ Flood Risk Advisory",
    "High": "🚨 High Flood Risk Warning",
    "Critical": "🆘 Critical Flood Risk — Emergency Alert",
}

_MESSAGES = {
    "Moderate": (
        "Moderate flood risk has been detected in your area. "
        "Current environmental conditions indicate elevated risk. "
        "Stay alert and monitor updates."
    ),
    "High": (
        "High flood risk has been detected. Current conditions indicate a significant "
        "probability of flooding in low-lying areas. Heavy rainfall is expected or already occurring. "
        "Prepare to move toward a designated safe area if conditions worsen."
    ),
    "Critical": (
        "CRITICAL flood risk detected. Conditions are dangerous. "
        "Immediate action is strongly recommended. "
        "Move to the nearest shelter or elevated safe area now. "
        "Avoid roads and low-lying zones."
    ),
}

_ACTIONS = {
    "Moderate": (
        "Monitor local weather updates. Identify your nearest shelter. "
        "Prepare an emergency kit (documents, water, medicine)."
    ),
    "High": (
        "Prepare to evacuate. Identify the nearest safe area now. "
        "Pack essentials. Avoid basements and low-lying areas. "
        "Keep phone charged and stay tuned for alerts."
    ),
    "Critical": (
        "EVACUATE IMMEDIATELY. Move to high ground or the nearest designated shelter. "
        "Do NOT walk or drive through floodwater. "
        "Call emergency services if you need assistance."
    ),
}


def _risk_level_enum(level_str: str) -> RiskLevelEnum:
    mapping = {
        "Low": RiskLevelEnum.low,
        "Moderate": RiskLevelEnum.moderate,
        "High": RiskLevelEnum.high,
        "Critical": RiskLevelEnum.critical,
    }
    return mapping.get(level_str, RiskLevelEnum.low)


def _should_deduplicate(
    db: Session,
    risk_level: str,
    lat: Optional[float],
    lon: Optional[float],
) -> bool:
    """
    Returns True if we should skip creating a new alert because a recent
    equivalent or higher-severity alert already exists.
    """
    if risk_level not in ("Moderate", "High", "Critical"):
        return True  # no alert needed for Low

    cutoff = datetime.utcnow() - timedelta(hours=settings.ALERT_DEDUP_HOURS)

    q = db.query(Alert).filter(
        Alert.timestamp >= cutoff,
        Alert.is_active == True,
        Alert.source == AlertSourceEnum.ai,
    )

    # Level hierarchy for comparison
    level_order = {"Low": 0, "Moderate": 1, "High": 2, "Critical": 3}
    current_order = level_order.get(risk_level, 0)

    recent_alerts = q.all()
    for alert in recent_alerts:
        alert_level = alert.risk_level.value if hasattr(alert.risk_level, "value") else str(alert.risk_level)
        existing_order = level_order.get(alert_level, 0)
        if existing_order >= current_order:
            return True  # already have equal or higher alert

    return False


def evaluate_and_alert(
    db: Session,
    risk_score: float,
    risk_level: str,
    risk_trend: str,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    location_name: Optional[str] = None,
) -> dict:
    """
    Evaluates risk and creates an alert if warranted.

    Returns a dict with:
        warning_issued    bool
        warning_level     str
        risk_score        float
        risk_level        str
        risk_trend        str
        title             str | None
        message           str | None
        recommended_action str | None
        alert_id          int | None
    """
    warning_level = _LEVEL_MAP.get(risk_level, "none")
    result = {
        "warning_issued": False,
        "warning_level": warning_level,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_trend": risk_trend,
        "title": None,
        "message": None,
        "recommended_action": None,
        "alert_id": None,
    }

    if risk_level not in ("Moderate", "High", "Critical"):
        return result

    # Check deduplication
    if _should_deduplicate(db, risk_level, lat, lon):
        return result

    # Create alert
    title = _TITLES[risk_level]
    message = _MESSAGES[risk_level]
    action = _ACTIONS[risk_level]

    # Append trend information
    if risk_trend == "RAPIDLY_INCREASING":
        message += " Risk levels are RAPIDLY INCREASING."
        title = title.rstrip(".") + " (Rapidly Increasing)"
    elif risk_trend == "INCREASING":
        message += " Risk levels are increasing."

    # Expiry: High = 12h, Critical = 6h, Moderate = 24h
    expiry_hours = {"Moderate": 24, "High": 12, "Critical": 6}
    expires_at = datetime.utcnow() + timedelta(hours=expiry_hours.get(risk_level, 12))

    alert = Alert(
        title=title,
        message=message,
        risk_level=_risk_level_enum(risk_level),
        risk_score=risk_score,
        latitude=lat,
        longitude=lon,
        location_name=location_name,
        recommended_action=action,
        source=AlertSourceEnum.ai,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    result.update({
        "warning_issued": True,
        "title": title,
        "message": message,
        "recommended_action": action,
        "alert_id": alert.id,
    })
    return result
