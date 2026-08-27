"""
Tests for the early warning engine — alert generation and deduplication.
"""
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.services.early_warning_engine import evaluate_and_alert


def _make_db(existing_alerts=None):
    """Creates a mock DB session."""
    db = MagicMock()
    existing_alerts = existing_alerts or []

    mock_query = MagicMock()
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = existing_alerts
    db.query.return_value = mock_query

    # Mock add/commit/refresh
    db.add = MagicMock()
    db.commit = MagicMock()
    db.refresh = MagicMock(side_effect=lambda x: setattr(x, "id", 99))
    return db


def test_low_risk_no_alert_issued():
    db = _make_db()
    result = evaluate_and_alert(db, risk_score=15.0, risk_level="Low", risk_trend="STABLE")
    assert result["warning_issued"] is False
    assert result["alert_id"] is None
    db.add.assert_not_called()


def test_moderate_risk_issues_advisory():
    db = _make_db(existing_alerts=[])
    result = evaluate_and_alert(db, risk_score=35.0, risk_level="Moderate", risk_trend="STABLE")
    assert result["warning_issued"] is True
    assert result["warning_level"] == "advisory"
    assert result["alert_id"] is not None
    db.add.assert_called_once()


def test_high_risk_issues_warning():
    db = _make_db(existing_alerts=[])
    result = evaluate_and_alert(db, risk_score=65.0, risk_level="High", risk_trend="INCREASING")
    assert result["warning_issued"] is True
    assert result["warning_level"] == "warning"
    assert "High" in result["title"]


def test_critical_risk_issues_emergency():
    db = _make_db(existing_alerts=[])
    result = evaluate_and_alert(db, risk_score=85.0, risk_level="Critical", risk_trend="RAPIDLY_INCREASING")
    assert result["warning_issued"] is True
    assert result["warning_level"] == "emergency"
    assert "RAPIDLY_INCREASING" in result["message"] or "RAPIDLY" in result["title"] or "Rapidly" in result["title"]


def test_deduplication_prevents_duplicate_alert():
    """If a High alert already exists within dedup window, no new alert is created."""
    from unittest.mock import MagicMock
    from app.models.models import Alert, RiskLevelEnum, AlertSourceEnum

    existing_alert = MagicMock(spec=Alert)
    existing_alert.risk_level = RiskLevelEnum.high
    existing_alert.source = AlertSourceEnum.ai
    existing_alert.is_active = True
    existing_alert.timestamp = datetime.utcnow() - timedelta(hours=1)

    db = _make_db(existing_alerts=[existing_alert])
    result = evaluate_and_alert(db, risk_score=68.0, risk_level="High", risk_trend="STABLE")
    assert result["warning_issued"] is False
    db.add.assert_not_called()


def test_message_includes_location_info():
    db = _make_db(existing_alerts=[])
    result = evaluate_and_alert(
        db,
        risk_score=75.0,
        risk_level="Critical",
        risk_trend="STABLE",
        lat=18.52,
        lon=73.85,
        location_name="Pune",
    )
    assert result["warning_issued"] is True


def test_recommended_action_present_for_high():
    db = _make_db(existing_alerts=[])
    result = evaluate_and_alert(db, risk_score=62.0, risk_level="High", risk_trend="STABLE")
    assert result["recommended_action"] is not None
    assert len(result["recommended_action"]) > 10


def test_recommended_action_present_for_critical():
    db = _make_db(existing_alerts=[])
    result = evaluate_and_alert(db, risk_score=90.0, risk_level="Critical", risk_trend="RAPIDLY_INCREASING")
    assert "EVACUATE" in result["recommended_action"].upper() or "evacuate" in result["recommended_action"].lower()
