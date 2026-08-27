"""
Tests for the redesigned risk engine v2.
"""
import pytest
from unittest.mock import MagicMock
from app.services.risk_engine import (
    compute_risk_score,
    _rainfall_to_score,
    _weather_to_score,
    _compute_trend,
    _risk_level_from_score,
)
from app.models.models import WeatherData


def _make_weather(humidity=60, wind_speed=5, pressure=1013, rainfall=0):
    w = MagicMock(spec=WeatherData)
    w.humidity = humidity
    w.wind_speed = wind_speed
    w.pressure = pressure
    w.rainfall = rainfall
    return w


# -------------------------------------------------------
# Rainfall scoring
# -------------------------------------------------------

def test_rainfall_score_zero():
    assert _rainfall_to_score(0) == 0.0


def test_rainfall_score_light():
    assert 0 < _rainfall_to_score(5) < 30


def test_rainfall_score_heavy():
    assert _rainfall_to_score(120) >= 70


def test_rainfall_score_extreme():
    assert _rainfall_to_score(300) == 100.0


# -------------------------------------------------------
# Weather scoring
# -------------------------------------------------------

def test_weather_score_calm():
    w = _make_weather(humidity=40, wind_speed=2, pressure=1013)
    score = _weather_to_score(w)
    assert 0 <= score <= 50


def test_weather_score_storm():
    w = _make_weather(humidity=95, wind_speed=20, pressure=980)
    score = _weather_to_score(w)
    assert score > 70


# -------------------------------------------------------
# Trend computation
# -------------------------------------------------------

def test_trend_unknown_single_value():
    assert _compute_trend([50]) == "UNKNOWN"


def test_trend_stable():
    assert _compute_trend([40, 41, 40, 42]) == "STABLE"


def test_trend_increasing():
    assert _compute_trend([30, 35, 42, 45]) == "INCREASING"


def test_trend_rapidly_increasing():
    assert _compute_trend([30, 45, 58, 70]) == "RAPIDLY_INCREASING"


def test_trend_decreasing():
    assert _compute_trend([70, 60, 50, 40]) == "DECREASING"


# -------------------------------------------------------
# Risk level from score
# -------------------------------------------------------

def test_risk_level_low():
    assert _risk_level_from_score(10) == "Low"


def test_risk_level_moderate():
    assert _risk_level_from_score(35) == "Moderate"


def test_risk_level_high():
    assert _risk_level_from_score(60) == "High"


def test_risk_level_critical():
    assert _risk_level_from_score(80) == "Critical"


# -------------------------------------------------------
# compute_risk_score — no signals
# -------------------------------------------------------

def test_risk_no_signals():
    score, level, trend, confidence, factors, rec = compute_risk_score()
    assert score == 0.0
    assert level == "Low"
    assert confidence == 0.0
    assert factors == []


# -------------------------------------------------------
# compute_risk_score — weather only (no image required!)
# -------------------------------------------------------

def test_risk_weather_only_no_image_required():
    w = _make_weather(humidity=80, wind_speed=10, pressure=995)
    score, level, trend, confidence, factors, rec = compute_risk_score(weather=w)
    assert score > 0
    assert level in ("Low", "Moderate", "High", "Critical")
    # Confidence: 1 of 4 signals = 25%
    assert confidence == 25.0
    assert any(f["key"] == "weather" for f in factors)


# -------------------------------------------------------
# compute_risk_score — with rainfall forecast (primary signal)
# -------------------------------------------------------

def test_risk_rainfall_primary():
    score, level, trend, confidence, factors, rec = compute_risk_score(
        rainfall_forecast_mm=120
    )
    assert score >= 50  # heavy rain should be High risk
    assert any(f["key"] == "rainfall_forecast" for f in factors)


# -------------------------------------------------------
# compute_risk_score — all signals including image
# -------------------------------------------------------

def test_risk_all_signals_with_image():
    w = _make_weather(humidity=85, wind_speed=12, pressure=990)
    score, level, trend, confidence, factors, rec = compute_risk_score(
        flood_image_confidence=78.0,
        flood_image_label="Flood",
        rainfall_forecast_mm=80,
        weather=w,
        recent_risk_scores=[30, 40, 55, 62],
    )
    assert score > 50
    assert confidence == 100.0  # all 4 signals active
    assert any(f["key"] == "image_evidence" for f in factors)


# -------------------------------------------------------
# compute_risk_score — image shows no flood (reduces risk)
# -------------------------------------------------------

def test_risk_image_no_flood_reduces_score():
    w = _make_weather(humidity=50, wind_speed=3, pressure=1010)
    score_no_image, _, _, _, _, _ = compute_risk_score(weather=w)
    score_with_no_flood, _, _, _, _, _ = compute_risk_score(
        flood_image_confidence=90.0,
        flood_image_label="No Flood",
        weather=w,
    )
    # "No Flood" image should reduce or not inflate the score
    assert score_with_no_flood <= score_no_image + 5  # small tolerance


# -------------------------------------------------------
# Weight normalization when image absent
# -------------------------------------------------------

def test_weight_normalization_no_image():
    """Without image, weights should redistribute so score is still valid 0-100."""
    w = _make_weather(humidity=90, wind_speed=15, pressure=985)
    score, _, _, _, _, _ = compute_risk_score(
        rainfall_forecast_mm=150,
        weather=w,
        recent_risk_scores=[40, 55, 70],
    )
    assert 0 <= score <= 100


def test_risk_score_bounds():
    """Score must always be within 0-100."""
    for rainfall in [0, 10, 50, 200, 500]:
        w = _make_weather(humidity=100, wind_speed=25, pressure=950)
        score, _, _, _, _, _ = compute_risk_score(
            rainfall_forecast_mm=rainfall,
            weather=w,
        )
        assert 0 <= score <= 100, f"Score {score} out of bounds for rainfall={rainfall}"


# -------------------------------------------------------
# Explainability
# -------------------------------------------------------

def test_contributing_factors_have_required_keys():
    w = _make_weather(humidity=75, wind_speed=8, pressure=1000)
    _, _, _, _, factors, _ = compute_risk_score(
        rainfall_forecast_mm=60,
        weather=w,
    )
    for f in factors:
        assert "key" in f
        assert "label" in f
        assert "delta" in f
        assert "weight_pct" in f


def test_recommendation_not_empty():
    w = _make_weather(humidity=90, wind_speed=18, pressure=980)
    _, _, _, _, _, rec = compute_risk_score(
        rainfall_forecast_mm=120,
        weather=w,
    )
    assert len(rec) > 10
