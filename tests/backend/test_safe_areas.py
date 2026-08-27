"""
Tests for the safe area ranking service.
"""
from unittest.mock import MagicMock
import pytest

from app.services.safe_area_service import (
    get_nearby_safe_areas,
    _haversine_km,
    _composite_safety_score,
    _distance_score,
    _capacity_score,
    _destination_risk_score,
)
from app.models.models import EmergencyLocation


def _make_location(name, lat, lon, loc_type="shelter", capacity=None,
                   occupancy=None, availability="open", risk_level="Low"):
    loc = MagicMock(spec=EmergencyLocation)
    loc.name = name
    loc.latitude = lat
    loc.longitude = lon
    loc.type = loc_type
    loc.capacity = capacity
    loc.current_occupancy = occupancy
    loc.availability_status = availability
    loc.risk_level = risk_level
    loc.id = hash(name) % 1000
    loc.description = ""
    loc.contact = None
    loc.is_seed_data = True
    loc.created_at = None
    return loc


def _make_db(locations):
    db = MagicMock()
    mock_q = MagicMock()
    mock_q.filter.return_value = mock_q
    mock_q.all.return_value = locations
    db.query.return_value = mock_q
    return db


# -------------------------------------------------------
# Haversine distance
# -------------------------------------------------------

def test_haversine_zero_distance():
    assert _haversine_km(18.52, 73.85, 18.52, 73.85) == 0.0


def test_haversine_known_distance():
    # Pune to Mumbai — measured straight-line distance ~110-135 km
    dist = _haversine_km(18.5204, 73.8567, 19.0760, 72.8777)
    assert 100 < dist < 150


# -------------------------------------------------------
# Distance score
# -------------------------------------------------------

def test_distance_score_nearby():
    assert _distance_score(0.5, 10.0) > 90


def test_distance_score_far():
    assert _distance_score(9.0, 10.0) < 20


def test_distance_score_beyond_radius():
    assert _distance_score(15.0, 10.0) == 0.0


# -------------------------------------------------------
# Capacity score
# -------------------------------------------------------

def test_capacity_score_open_unknown():
    loc = _make_location("A", 0, 0, capacity=None, availability="open")
    assert _capacity_score(loc) == 70.0


def test_capacity_score_full():
    loc = _make_location("B", 0, 0, capacity=100, occupancy=100)
    assert _capacity_score(loc) == 0.0 or _capacity_score(loc) <= 5.0


def test_capacity_score_closed():
    loc = _make_location("C", 0, 0, capacity=100, occupancy=50, availability="closed")
    assert _capacity_score(loc) == 0.0


def test_capacity_score_half_full():
    loc = _make_location("D", 0, 0, capacity=100, occupancy=50, availability="open")
    score = _capacity_score(loc)
    assert 40 < score < 60


# -------------------------------------------------------
# Destination risk score
# -------------------------------------------------------

def test_destination_risk_low():
    loc = _make_location("A", 0, 0, risk_level="Low")
    assert _destination_risk_score(loc) == 100.0


def test_destination_risk_critical():
    loc = _make_location("B", 0, 0, risk_level="Critical")
    assert _destination_risk_score(loc) <= 15.0


# -------------------------------------------------------
# Ranking — does NOT simply pick closest
# -------------------------------------------------------

def test_ranking_prefers_safer_over_closer():
    """A farther but safer location should rank higher than a closer risky one."""
    user_lat, user_lon = 18.52, 73.85

    # Close shelter in HIGH-risk area
    risky_nearby = _make_location("Risky Nearby", 18.521, 73.851, risk_level="High")
    # Farther shelter in LOW-risk area
    safe_farther = _make_location("Safe Farther", 18.545, 73.870, risk_level="Low")

    db = _make_db([risky_nearby, safe_farther])
    results = get_nearby_safe_areas(db, user_lat, user_lon, radius_km=10.0)

    # Safe farther should rank higher despite the distance
    result_names = [r["location"].name for r in results]
    assert result_names.index("Safe Farther") < result_names.index("Risky Nearby")


def test_no_locations_returns_empty():
    db = _make_db([])
    results = get_nearby_safe_areas(db, 18.52, 73.85)
    assert results == []


def test_locations_outside_radius_excluded():
    far_loc = _make_location("Far Away", 19.07, 72.87)  # ~150 km from Pune
    db = _make_db([far_loc])
    results = get_nearby_safe_areas(db, 18.52, 73.85, radius_km=5.0)
    assert results == []


def test_results_have_required_fields():
    loc = _make_location("Test Shelter", 18.525, 73.855)
    db = _make_db([loc])
    results = get_nearby_safe_areas(db, 18.52, 73.85, radius_km=10.0)
    assert len(results) == 1
    r = results[0]
    assert "distance_km" in r
    assert "estimated_minutes" in r
    assert "safety_score" in r
    assert "destination_risk" in r
    assert "reason" in r
    assert 0 <= r["safety_score"] <= 100


def test_safety_score_bounds():
    loc = _make_location("A", 18.522, 73.852, capacity=500, occupancy=0)
    db = _make_db([loc])
    results = get_nearby_safe_areas(db, 18.52, 73.85, radius_km=10.0)
    assert 0 <= results[0]["safety_score"] <= 100
