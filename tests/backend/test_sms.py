"""
Tests for SMS notification service, subscription endpoints, and automatic alert dispatch.
"""
import pytest
from app.models.models import SMSSubscriber, SMSLog, Alert, RiskLevelEnum, AlertSourceEnum
from app.services.sms_service import sanitize_phone_number, dispatch_alert_sms, send_sms
from app.services.early_warning_engine import evaluate_and_alert


def test_phone_sanitization():
    assert sanitize_phone_number("9876543210") == "+919876543210"
    assert sanitize_phone_number("+91 98765 43210") == "+919876543210"
    assert sanitize_phone_number("+1-415-555-2671") == "+14155552671"
    assert sanitize_phone_number("919876543210") == "+919876543210"


def test_subscribe_success(client, db_session):
    payload = {
        "phone_number": "9876543210",
        "name": "Aarav Sharma",
        "location_name": "Pune",
        "min_risk_level": "High",
    }
    res = client.post("/sms/subscribe", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["phone_number"] == "+919876543210"
    assert data["name"] == "Aarav Sharma"
    assert data["location_name"] == "Pune"
    assert data["is_active"] is True

    # Check subscriber exists in database
    sub = db_session.query(SMSSubscriber).filter(SMSSubscriber.phone_number == "+919876543210").first()
    assert sub is not None

    # Check welcome SMS logged
    log = db_session.query(SMSLog).filter(SMSLog.recipient == "+919876543210").first()
    assert log is not None
    assert "Emergency SMS alerts active" in log.message


def test_subscribe_update_existing(client, db_session):
    client.post("/sms/subscribe", json={"phone_number": "9876543210", "location_name": "Pune", "min_risk_level": "High"})
    res2 = client.post("/sms/subscribe", json={"phone_number": "9876543210", "location_name": "Mumbai", "min_risk_level": "Moderate"})
    assert res2.status_code == 201
    data = res2.json()
    assert data["location_name"] == "Mumbai"
    assert data["min_risk_level"] == "Moderate"

    subs = db_session.query(SMSSubscriber).filter(SMSSubscriber.phone_number == "+919876543210").all()
    assert len(subs) == 1


def test_unsubscribe_success(client, db_session):
    client.post("/sms/subscribe", json={"phone_number": "9123456789", "location_name": "Pune"})
    res = client.post("/sms/unsubscribe", json={"phone_number": "9123456789"})
    assert res.status_code == 200
    assert "Successfully unsubscribed" in res.json()["detail"]

    sub = db_session.query(SMSSubscriber).filter(SMSSubscriber.phone_number == "+919123456789").first()
    assert sub.is_active is False


def test_sms_status(client, db_session):
    client.post("/sms/subscribe", json={"phone_number": "9998887776"})
    res = client.get("/sms/status")
    assert res.status_code == 200
    data = res.json()
    assert "provider" in data
    assert data["total_subscribers"] >= 1
    assert data["active_subscribers"] >= 1


def test_send_test_sms(client, db_session):
    res = client.post("/sms/test", json={"phone_number": "9988776655", "message": "Disaster Intel Verification Test"})
    assert res.status_code == 200
    data = res.json()
    assert data["result"]["recipient"] == "+919988776655"
    assert data["result"]["status"] in ("delivered", "simulated")


def test_automatic_dispatch_on_early_warning_alert(db_session):
    # Add an active subscriber
    sub = SMSSubscriber(
        phone_number="+919876543210",
        name="Citizen",
        location_name="Pune",
        min_risk_level="High",
        is_active=True,
    )
    db_session.add(sub)
    db_session.commit()

    # Trigger evaluate_and_alert with High risk
    result = evaluate_and_alert(
        db=db_session,
        risk_score=68.5,
        risk_level="High",
        risk_trend="INCREASING",
        lat=18.5204,
        lon=73.8567,
        location_name="Pune",
    )

    assert result["warning_issued"] is True
    assert result["sms_dispatched"] is True
    assert result["sms_stats"]["total_matched"] == 1

    # Verify SMSLog created
    log = db_session.query(SMSLog).filter(SMSLog.recipient == "+919876543210", SMSLog.risk_level == "High").first()
    assert log is not None
    assert "HIGH FLOOD WARNING" in log.message


def test_sms_logs_and_subscribers_endpoint(client, db_session):
    client.post("/sms/subscribe", json={"phone_number": "9811122233", "name": "Log Tester"})
    subs_res = client.get("/sms/subscribers")
    assert subs_res.status_code == 200
    assert any(s["phone_number"] == "+919811122233" for s in subs_res.json())

    logs_res = client.get("/sms/logs")
    assert logs_res.status_code == 200
    assert len(logs_res.json()) > 0


def test_cyclone_and_heavy_rainfall_early_warning_alerts(db_session):
    sub = SMSSubscriber(
        phone_number="+919876543999",
        name="Coastal Resident",
        location_name="Ratnagiri",
        min_risk_level="High",
        is_active=True,
    )
    sub_mumbai = SMSSubscriber(
        phone_number="+919876543888",
        name="Mumbai Resident",
        location_name="Mumbai",
        min_risk_level="High",
        is_active=True,
    )
    db_session.add_all([sub, sub_mumbai])
    db_session.commit()

    # Cyclone alert
    res_cyclone = evaluate_and_alert(
        db=db_session,
        risk_score=85.0,
        risk_level="Critical",
        risk_trend="RAPID_RISE",
        lat=16.99,
        lon=73.30,
        location_name="Ratnagiri Port",
        disaster_type="cyclone"
    )
    assert res_cyclone["warning_issued"] is True
    assert res_cyclone["disaster_type"] == "cyclone"
    assert "CYCLON" in res_cyclone["title"].upper()
    assert res_cyclone["sms_dispatched"] is True

    # Check alert in database
    cyclone_alert = db_session.query(Alert).filter(Alert.id == res_cyclone["alert_id"]).first()
    assert cyclone_alert is not None
    assert cyclone_alert.disaster_type == "cyclone"

    # Heavy rainfall alert
    res_rain = evaluate_and_alert(
        db=db_session,
        risk_score=72.0,
        risk_level="High",
        risk_trend="INCREASING",
        lat=19.07,
        lon=72.87,
        location_name="Mumbai Suburbs",
        disaster_type="heavy_rainfall"
    )
    assert res_rain["warning_issued"] is True
    assert res_rain["disaster_type"] == "heavy_rainfall"
    assert any(w in res_rain["title"].upper() for w in ("DOWNPOUR", "RAINFALL", "RAIN"))
    assert res_rain["sms_dispatched"] is True

    rain_alert = db_session.query(Alert).filter(Alert.id == res_rain["alert_id"]).first()
    assert rain_alert is not None
    assert rain_alert.disaster_type == "heavy_rainfall"


def test_admin_broadcast_mock_mode_and_target_audience(client, db_session):
    # Create admin user
    resp = client.post("/signup", json={
        "name": "Broadcast Admin",
        "email": "broadcastadmin@example.com",
        "password": "password123",
        "phone": "9812300001"
    })
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Also register another user with phone
    client.post("/signup", json={
        "name": "Citizen Phone",
        "email": "citizen@example.com",
        "password": "password123",
        "phone": "9812300002"
    })

    # Broadcast cyclone mock alert
    broadcast_resp = client.post("/sms/broadcast", headers=headers, json={
        "message": "URGENT: Cyclone Alert. Seek cyclone shelters immediately.",
        "risk_level": "Critical",
        "location_name": "Alibaug",
        "disaster_type": "cyclone",
        "target_audience": "both",
        "mock_mode": True
    })
    assert broadcast_resp.status_code == 200
    data = broadcast_resp.json()
    assert data["total_attempted"] >= 2
    assert data["simulated"] >= 2
    assert data["target_audience"] == "both"
    assert data["disaster_type"] == "cyclone"
    assert data["is_mock"] is True

    # Check alert table record was created
    created_alert = db_session.query(Alert).filter(Alert.location_name == "Alibaug").first()
    assert created_alert is not None
    assert created_alert.disaster_type == "cyclone"
    assert created_alert.risk_level == RiskLevelEnum.critical



