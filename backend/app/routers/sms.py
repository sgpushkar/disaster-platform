"""
SMS Alert Endpoints — public subscription, status, testing, and delivery logs.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import SMSSubscriber, SMSLog
from app.schemas.schemas import (
    SMSSubscribeRequest,
    SMSUnsubscribeRequest,
    SMSSubscriberOut,
    SMSLogOut,
    SMSTestRequest,
    SMSStatusOut,
    SMSBroadcastRequest,
)
from app.services.sms_service import (
    sanitize_phone_number,
    is_provider_configured,
    send_sms,
    LEVEL_SEVERITY,
)

router = APIRouter(prefix="/sms", tags=["sms"])


@router.post("/subscribe", response_model=SMSSubscriberOut, status_code=status.HTTP_201_CREATED)
def subscribe(payload: SMSSubscribeRequest, db: Session = Depends(get_db)):
    """
    Subscribes a mobile number to receive emergency disaster & flood SMS alerts.
    If the number was previously registered, updates settings and re-activates subscription.
    """
    cleaned_phone = sanitize_phone_number(payload.phone_number)
    if len(cleaned_phone) < 8 or len(cleaned_phone) > 17:
        raise HTTPException(status_code=400, detail="Invalid phone number format")

    valid_levels = {"Moderate", "High", "Critical"}
    min_level = payload.min_risk_level.capitalize() if payload.min_risk_level else "High"
    if min_level not in valid_levels:
        min_level = "High"

    loc = (payload.location_name or "All Regions").strip()

    subscriber = db.query(SMSSubscriber).filter(SMSSubscriber.phone_number == cleaned_phone).first()

    if subscriber:
        subscriber.name = payload.name or subscriber.name
        subscriber.location_name = loc
        subscriber.min_risk_level = min_level
        subscriber.is_active = True
        db.commit()
        db.refresh(subscriber)
    else:
        subscriber = SMSSubscriber(
            phone_number=cleaned_phone,
            name=payload.name,
            location_name=loc,
            min_risk_level=min_level,
            is_active=True,
        )
        db.add(subscriber)
        db.commit()
        db.refresh(subscriber)

    # Dispatch friendly welcome SMS
    welcome_body = (
        f"[DISASTER INTEL] Emergency SMS alerts active for {cleaned_phone} "
        f"({loc}, min severity: {min_level}). Reply STOP anytime to unsubscribe. Helpline: 112."
    )
    send_sms(to=cleaned_phone, message=welcome_body, risk_level="Low", db=db)

    return subscriber


@router.post("/unsubscribe")
def unsubscribe(payload: SMSUnsubscribeRequest, db: Session = Depends(get_db)):
    """
    Deactivates SMS emergency alerts for the provided phone number.
    """
    cleaned_phone = sanitize_phone_number(payload.phone_number)
    subscriber = db.query(SMSSubscriber).filter(SMSSubscriber.phone_number == cleaned_phone).first()

    if not subscriber or not subscriber.is_active:
        return {"detail": "Phone number is not currently subscribed to emergency SMS alerts."}

    subscriber.is_active = False
    db.commit()

    farewell_body = "[DISASTER INTEL] You have been unsubscribed from emergency SMS alerts. Stay safe!"
    send_sms(to=cleaned_phone, message=farewell_body, risk_level="Low", db=db)

    return {"detail": f"Successfully unsubscribed {cleaned_phone} from emergency SMS alerts."}


@router.get("/status", response_model=SMSStatusOut)
def get_status(db: Session = Depends(get_db)):
    """
    Returns the SMS provider operational status and subscription statistics.
    """
    is_live = is_provider_configured()
    provider_name = "Twilio Live Gateway" if is_live else "Developer Simulation Mode"

    total = db.query(SMSSubscriber).count()
    active = db.query(SMSSubscriber).filter(SMSSubscriber.is_active == True).count()
    recent = db.query(SMSLog).count()

    return SMSStatusOut(
        provider=provider_name,
        is_live=is_live,
        total_subscribers=total,
        active_subscribers=active,
        recent_sms_count=recent,
    )


@router.post("/test")
def test_sms(payload: SMSTestRequest, db: Session = Depends(get_db)):
    """
    Sends a test SMS to verify carrier delivery or simulation pipeline.
    """
    cleaned_phone = sanitize_phone_number(payload.phone_number)
    test_body = payload.message or (
        "[DISASTER INTEL TEST ALERT] This is a verification test of the Early Warning SMS system. "
        "Your phone is set up to receive instant emergency flood broadcasts."
    )

    res = send_sms(to=cleaned_phone, message=test_body, risk_level="Low", db=db)
    return {
        "detail": "Test SMS dispatched successfully",
        "result": res,
    }


@router.get("/subscribers", response_model=List[SMSSubscriberOut])
def list_subscribers(
    active_only: bool = False,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    Returns list of registered SMS subscribers.
    """
    q = db.query(SMSSubscriber)
    if active_only:
        q = q.filter(SMSSubscriber.is_active == True)
    return q.order_by(SMSSubscriber.created_at.desc()).limit(limit).all()


@router.get("/logs", response_model=List[SMSLogOut])
def list_logs(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    """
    Returns delivery audit logs of recent sent or simulated SMS alerts.
    """
    return db.query(SMSLog).order_by(SMSLog.sent_at.desc()).limit(limit).all()


@router.post("/broadcast")
def broadcast_sms(payload: SMSBroadcastRequest, db: Session = Depends(get_db)):
    """
    Broadcasts a custom SMS notification to matching active subscribers.
    """
    active_subs = db.query(SMSSubscriber).filter(SMSSubscriber.is_active == True).all()

    min_sev = LEVEL_SEVERITY.get(payload.min_risk_level or "High", 2)
    target_loc = (payload.location_name or "").lower().strip()

    sent = 0
    simulated = 0
    failed = 0

    for sub in active_subs:
        sub_sev = LEVEL_SEVERITY.get(sub.min_risk_level, 2)
        if min_sev < sub_sev:
            continue

        sub_loc = (sub.location_name or "All Regions").lower().strip()
        if target_loc and sub_loc != "all regions" and target_loc not in sub_loc and sub_loc not in target_loc:
            continue

        res = send_sms(
            to=sub.phone_number,
            message=payload.message,
            risk_level=payload.min_risk_level,
            db=db,
        )
        if res["status"] == "delivered":
            sent += 1
        elif res["status"] == "simulated":
            simulated += 1
        else:
            failed += 1

    return {
        "detail": "Broadcast completed",
        "sent": sent,
        "simulated": simulated,
        "failed": failed,
        "total_attempted": sent + simulated + failed,
    }
