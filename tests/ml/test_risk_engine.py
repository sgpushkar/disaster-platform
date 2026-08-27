"""
Unit tests for the risk fusion engine — pure logic, no DB or ML models needed.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from app.services.risk_engine import compute_risk_score, _rainfall_to_score
from app.models.models import WeatherData


def test_no_signals_returns_zero_low():
    score, level, breakdown = compute_risk_score()
    assert score == 0.0
    assert level == "Low"


def test_flood_image_only_high_confidence():
    score, level, breakdown = compute_risk_score(
        flood_image_confidence=95.0, flood_image_label="Flood",
    )
    assert score > 50  # strong flood signal should push risk up
    assert "flood_image" in breakdown["components"]


def test_no_flood_label_lowers_score():
    score, _, _ = compute_risk_score(flood_image_confidence=95.0, flood_image_label="No Flood")
    assert score < 40


def test_rainfall_score_bands_increase_monotonically():
    assert _rainfall_to_score(0) == 0.0
    assert _rainfall_to_score(10) < _rainfall_to_score(50)
    assert _rainfall_to_score(50) < _rainfall_to_score(100)
    assert _rainfall_to_score(100) < _rainfall_to_score(250)


def test_extreme_rainfall_caps_at_100():
    assert _rainfall_to_score(500) == 100.0


def test_weather_signal_included_in_breakdown():
    weather = WeatherData(temperature=30, humidity=90, wind_speed=15, rainfall=5, pressure=990)
    score, level, breakdown = compute_risk_score(weather=weather)
    assert "weather" in breakdown["components"]
    assert 0 <= score <= 100


def test_combined_signals_weighted_correctly():
    weather = WeatherData(temperature=28, humidity=80, wind_speed=5, rainfall=2, pressure=1010)
    score, level, breakdown = compute_risk_score(
        flood_image_confidence=90.0, flood_image_label="Flood",
        rainfall_forecast_mm=120.0, weather=weather,
    )
    assert set(breakdown["components"].keys()) == {"flood_image", "rainfall", "weather"}
    assert level in {"Low", "Moderate", "High", "Critical"}


def test_risk_level_thresholds():
    # Craft scores near each boundary via rainfall-only signal
    _, low_level, _ = compute_risk_score(rainfall_forecast_mm=0)
    assert low_level == "Low"

    _, high_level, _ = compute_risk_score(rainfall_forecast_mm=250)
    assert high_level in {"High", "Critical"}
