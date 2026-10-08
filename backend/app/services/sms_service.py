"""
SMS Notification Service — handles SMS dispatch for emergency disaster alerts.
Supports Twilio REST API integration with automatic fallback to Developer Simulation mode.
"""
from __future__ import annotations

import re
import uuid
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Alert, SMSSubscriber, SMSLog

logger = logging.getLogger("sms_service")

# Risk level hierarchy for matching subscriptions
LEVEL_SEVERITY = {
    "Low": 0,
    "Moderate": 1,
    "High": 2,
    "Critical": 3,
}


def sanitize_phone_number(raw_phone: str) -> str:
    """
    Sanitizes phone numbers into E.164 standard format.
    Defaults to +91 (India) if 10 digits are provided without a country code.
    """
    cleaned = re.sub(r"[^\d+]", "", raw_phone.strip())
    if cleaned.startswith("+"):
        return cleaned
    # If 10 digits, default to India (+91)
    if len(cleaned) == 10:
        return f"+91{cleaned}"
    # If 12 digits starting with 91, prepend +
    if len(cleaned) == 12 and cleaned.startswith("91"):
        return f"+{cleaned}"
    # Otherwise prepend +
    return f"+{cleaned}"


def is_provider_configured() -> bool:
    """
    Returns True if valid Twilio credentials are configured in settings.
    """
    return bool(
        settings.SMS_ENABLED
        and not settings.SMS_SIMULATION_MODE
        and settings.TWILIO_ACCOUNT_SID
        and settings.TWILIO_AUTH_TOKEN
        and settings.TWILIO_FROM_NUMBER
    )


def format_alert_sms(alert: Alert) -> str:
    """
    Formats a concise, urgent emergency alert message suitable for SMS.
    Supports cyclone, heavy rainfall, and flood warnings.
    """
    level_str = alert.risk_level.value if hasattr(alert.risk_level, "value") else str(alert.risk_level)
    loc = alert.location_name or "Your Area"
    action = alert.recommended_action or "Seek higher ground and follow local emergency orders."
    dtype = (getattr(alert, "disaster_type", None) or "flood").lower()

    if "cyclone" in dtype:
        headline = f"[DISASTER INTEL ALERT] {level_str.upper()} CYCLONE ALERT for {loc}."
    elif "heavy_rainfall" in dtype or "rainfall" in dtype:
        headline = f"[DISASTER INTEL ALERT] {level_str.upper()} HEAVY RAINFALL WARNING for {loc}."
    else:
        headline = f"[DISASTER INTEL ALERT] {level_str.upper()} FLOOD WARNING for {loc}."

    body = alert.title or alert.message[:120]
    rec = f"ACTION: {action}"
    footer = "Helpline: 112 / 1077. Stay safe."

    return f"{headline}\n{body}\n{rec}\n{footer}".strip()


def send_sms(
    to: str,
    message: str,
    alert_id: Optional[int] = None,
    risk_level: Optional[str] = None,
    db: Optional[Session] = None,
    force_simulation: bool = False,
) -> Dict[str, Any]:
    """
    Sends an SMS message to a single recipient.
    Uses Twilio if configured and force_simulation is False; otherwise logs and simulates delivery.
    Records delivery in SMSLog if a database session is provided.
    """
    formatted_to = sanitize_phone_number(to)
    is_live = is_provider_configured() and not force_simulation

    status = "simulated"
    provider_sid = None
    error_msg = None

    if is_live:
        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
        auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        payload = {
            "To": formatted_to,
            "From": settings.TWILIO_FROM_NUMBER,
            "Body": message,
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(url, auth=auth, data=payload)
                if res.status_code in (200, 201):
                    data = res.json()
                    status = "delivered"
                    provider_sid = data.get("sid")
                elif res.status_code == 400 and "572006" in res.text:
                    # Twilio free trial restricts custom bodies to predefined templates
                    # Retry with trial template so message physically delivers to phone
                    logger.info("Trial account detected. Retrying with Twilio trial template...")
                    retry_payload = {**payload, "Body": "sms_appointment_reminders"}
                    retry_res = client.post(url, auth=auth, data=retry_payload)
                    if retry_res.status_code in (200, 201):
                        data = retry_res.json()
                        status = "delivered"
                        provider_sid = data.get("sid")
                        error_msg = "Delivered via Twilio trial template. (Upgrade Twilio to enable custom disaster alert text)."
                    else:
                        status = "failed"
                        error_msg = f"Twilio HTTP {retry_res.status_code}: {retry_res.text}"
                else:
                    status = "failed"
                    error_msg = f"Twilio HTTP {res.status_code}: {res.text}"
                    logger.error(f"Failed to send SMS to {formatted_to}: {error_msg}")
        except Exception as exc:
            status = "failed"
            error_msg = f"Network or provider exception: {str(exc)}"
            logger.exception(f"Exception sending SMS to {formatted_to}: {exc}")
    else:
        # Developer Simulation / Mock Mode
        provider_sid = f"mock_{uuid.uuid4().hex[:12]}"
        status = "simulated"
        logger.info(
            f"[MOCK SMS SYSTEM] To: {formatted_to} | Status: simulated | Message: {message[:80]}..."
        )


    # Persist in audit log if db session provided
    if db:
        try:
            log_entry = SMSLog(
                recipient=formatted_to,
                message=message,
                risk_level=risk_level,
                alert_id=alert_id,
                status=status,
                provider_sid=provider_sid,
                error_message=error_msg,
                sent_at=datetime.utcnow(),
            )
            db.add(log_entry)
            db.commit()
        except Exception as log_err:
            db.rollback()
            logger.error(f"Failed to save SMSLog: {log_err}")

    return {
        "recipient": formatted_to,
        "status": status,
        "provider": "Twilio Live" if is_live else "Simulation Mode",
        "provider_sid": provider_sid,
        "error": error_msg,
    }


def dispatch_alert_sms(alert: Alert, db: Session) -> Dict[str, Any]:
    """
    Dispatches emergency SMS alerts to all eligible, active subscribers.
    Filters subscribers based on severity threshold and location.
    """
    level_str = alert.risk_level.value if hasattr(alert.risk_level, "value") else str(alert.risk_level)
    alert_severity = LEVEL_SEVERITY.get(level_str, 0)

    # Only dispatch for Moderate, High, or Critical alerts
    if alert_severity < LEVEL_SEVERITY.get("Moderate", 1):
        return {"total_matched": 0, "dispatched": 0, "status": "skipped_low_severity"}

    active_subs = db.query(SMSSubscriber).filter(SMSSubscriber.is_active == True).all()
    message = format_alert_sms(alert)

    matched_count = 0
    sent_count = 0
    simulated_count = 0
    failed_count = 0

    alert_loc = (alert.location_name or "").lower().strip()

    for sub in active_subs:
        # Check severity threshold
        sub_min_sev = LEVEL_SEVERITY.get(sub.min_risk_level, 2)  # default High
        if alert_severity < sub_min_sev:
            continue

        # Check location match (if sub specified a city/region)
        sub_loc = (sub.location_name or "All Regions").lower().strip()
        if sub_loc != "all regions" and sub_loc and alert_loc:
            # Check if location matches either way
            if sub_loc not in alert_loc and alert_loc not in sub_loc:
                continue

        matched_count += 1
        res = send_sms(
            to=sub.phone_number,
            message=message,
            alert_id=alert.id,
            risk_level=level_str,
            db=db,
        )

        if res["status"] == "delivered":
            sent_count += 1
        elif res["status"] == "simulated":
            simulated_count += 1
        else:
            failed_count += 1

    return {
        "total_matched": matched_count,
        "sent": sent_count,
        "simulated": simulated_count,
        "failed": failed_count,
        "alert_id": alert.id,
        "risk_level": level_str,
    }
