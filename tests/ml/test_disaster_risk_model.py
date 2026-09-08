"""
Unit and integration tests for the historical disaster attribute risk ML model.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from app.ml.inference import predict_disaster_risk_from_attributes, _load_disaster_risk_model


def test_disaster_risk_model_loads():
    bundle = _load_disaster_risk_model()
    assert "scaler" in bundle
    assert "level_classifier" in bundle
    assert "flood_classifier" in bundle
    assert "regressor" in bundle
    assert len(bundle["feature_names"]) > 0


def test_predict_dry_weather_low_risk():
    dry_inputs = {
        "rainfall_24h_mm": 0.0,
        "rainfall_72h_mm": 0.0,
        "humidity_pct": 45.0,
        "temperature_c": 32.0,
        "wind_speed_ms": 2.5,
        "pressure_hpa": 1014.0,
        "soil_moisture_pct": 25.0,
        "river_water_level_m": 1.2,
        "drainage_capacity_index": 0.7,
    }
    result = predict_disaster_risk_from_attributes(dry_inputs)
    assert result["risk_level"] == "Low"
    assert result["risk_score"] < 35.0
    assert result["flood_predicted"] is False
    assert result["flood_probability"] < 50.0


def test_predict_extreme_monsoon_critical_risk():
    extreme_inputs = {
        "rainfall_24h_mm": 280.0,
        "rainfall_72h_mm": 520.0,
        "humidity_pct": 98.0,
        "temperature_c": 23.5,
        "wind_speed_ms": 22.0,
        "pressure_hpa": 989.0,
        "soil_moisture_pct": 98.0,
        "river_water_level_m": 8.9,
        "drainage_capacity_index": 0.4,
    }
    result = predict_disaster_risk_from_attributes(extreme_inputs)
    assert result["risk_level"] in ("High", "Critical")
    assert result["risk_score"] >= 70.0
    assert result["flood_predicted"] is True
    assert result["flood_probability"] > 70.0


def test_predict_contributing_factors_exist():
    inputs = {
        "rainfall_24h_mm": 85.0,
        "rainfall_72h_mm": 160.0,
        "humidity_pct": 88.0,
        "temperature_c": 26.0,
        "wind_speed_ms": 11.0,
        "pressure_hpa": 1002.0,
        "soil_moisture_pct": 78.0,
        "river_water_level_m": 5.2,
        "drainage_capacity_index": 0.5,
    }
    result = predict_disaster_risk_from_attributes(inputs)
    factors = result["contributing_factors"]
    assert len(factors) > 0
    assert "water_level" in factors or "temperature" in factors

