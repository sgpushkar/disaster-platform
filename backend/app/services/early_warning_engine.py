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
    disaster_type: Optional[str] = None,
) -> bool:
    """
    Returns True if we should skip creating a new alert because a recent
    equivalent or higher-severity alert of the same hazard type already exists.
    """
    if risk_level not in ("Moderate", "High", "Critical"):
        return True  # no alert needed for Low

    cutoff = datetime.utcnow() - timedelta(hours=settings.ALERT_DEDUP_HOURS)

    q = db.query(Alert).filter(
        Alert.timestamp >= cutoff,
        Alert.is_active == True,
        Alert.source == AlertSourceEnum.ai,
    )

    if disaster_type:
        q = q.filter(Alert.disaster_type == disaster_type.lower())

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
    disaster_type: Optional[str] = "flood",
) -> dict:
    """
    Evaluates risk and creates an alert if warranted.
    Supports 'flood', 'cyclone', and 'heavy_rainfall' disaster categories.
    """
    warning_level = _LEVEL_MAP.get(risk_level, "none")
    dtype = (disaster_type or "flood").lower()
    result = {
        "warning_issued": False,
        "warning_level": warning_level,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_trend": risk_trend,
        "disaster_type": dtype,
        "title": None,
        "message": None,
        "recommended_action": None,
        "alert_id": None,
    }

    if risk_level not in ("Moderate", "High", "Critical"):
        return result

    # Check deduplication scoped by disaster type
    if _should_deduplicate(db, risk_level, lat, lon, dtype):
        return result


    # Specialized titles, messages, and actions based on disaster type
    if "cyclone" in dtype:
        c_titles = {
            "Moderate": "🌀 Cyclone Advisory — Elevated Winds",
            "High": "🌪️ Severe Cyclonic Storm Warning",
            "Critical": "🚨 Super Cyclonic Storm — Extreme Emergency",
        }
        c_messages = {
            "Moderate": "Deep depression and gusty winds observed. Elevated cyclone risk in the region. Monitor IMD meteorological bulletins.",
            "High": "Severe cyclonic system approaching. Gale-force winds (>65 km/h) and structural hazards anticipated. Secure windows and outdoor fixtures.",
            "Critical": "EXTREMELY SEVERE CYCLONE IMMINENT. Catastrophic storm gusts, power line damage, and coastal surge expected. Evacuate to cyclone shelters now.",
        }
        c_actions = {
            "Moderate": "Secure loose roofing and objects. Keep emergency lighting and battery-powered radio charged.",
            "High": "Stay indoors away from windows. Disconnect non-critical electrical supplies. Stock clean drinking water.",
            "Critical": "IMMEDIATE EVACUATION to designated pucca cyclone shelters. Do not venture outdoors under any circumstances.",
        }
        title = c_titles.get(risk_level, _TITLES[risk_level])
        message = c_messages.get(risk_level, _MESSAGES[risk_level])
        action = c_actions.get(risk_level, _ACTIONS[risk_level])
    elif "rainfall" in dtype or "heavy_rainfall" in dtype:
        r_titles = {
            "Moderate": "🌧️ Heavy Rainfall Advisory (Yellow Alert)",
            "High": "⛈️ Torrential Downpour & Flash Flood Warning (Orange Alert)",
            "Critical": "🆘 Cloudburst & Extreme Rainfall Emergency (Red Alert)",
        }
        r_messages = {
            "Moderate": "Continuous heavy precipitation detected (>30mm). Waterlogging reported in low-lying roadways and railway tracks.",
            "High": "Intense torrential rainfall detected (>65mm). Widespread localized flooding and stormwater drain choking in progress.",
            "Critical": "EXTREME CLOUDBURST PRECIPITATION (>100mm). Inundation of ground floors and rapid flash flooding underway.",
        }
        r_actions = {
            "Moderate": "Avoid low-lying subways and underpasses. Plan commute with extreme caution.",
            "High": "Move vehicles to elevated spots. Keep away from fallen electric cables and flooded manholes.",
            "Critical": "MOVE TO UPPER FLOORS IMMEDIATELY. Avoid all travel. Contact emergency helpline 112 / 1077.",
        }
        title = r_titles.get(risk_level, _TITLES[risk_level])
        message = r_messages.get(risk_level, _MESSAGES[risk_level])
        action = r_actions.get(risk_level, _ACTIONS[risk_level])
    else:
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
        disaster_type=dtype,
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


    # Automatically dispatch emergency SMS to active subscribers for High/Critical warnings
    sms_stats = None
    try:
        from app.services.sms_service import dispatch_alert_sms
        sms_stats = dispatch_alert_sms(alert, db)
    except Exception as sms_err:
        import logging
        logging.getLogger("early_warning_engine").error(f"Failed to dispatch SMS alert: {sms_err}")

    result.update({
        "warning_issued": True,
        "title": title,
        "message": message,
        "recommended_action": action,
        "alert_id": alert.id,
        "sms_dispatched": sms_stats is not None and (sms_stats.get("sent", 0) > 0 or sms_stats.get("simulated", 0) > 0),
        "sms_stats": sms_stats,
    })
    return result

