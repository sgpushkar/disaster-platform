"""
Unit tests for the DisasterScope Reconnaissance ML Model.
"""
import os
import sys
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from app.ml.inference import predict_disaster_scope, _load_disasterscope_model


def test_disasterscope_dataset_exists():
    path = os.path.join(os.path.dirname(__file__), "..", "..", "datasets", "disasterscope", "disasterscope.csv")
    assert os.path.exists(path), f"Dataset missing at {path}"
    df = pd.read_csv(path, nrows=50)
    assert len(df) == 50
    assert "affected_area_type" in df.columns
    assert "disaster_severity_level" in df.columns
    assert "immediate_action_required" in df.columns
    assert "survivor_presence_likelihood" in df.columns


def test_disasterscope_model_loads():
    bundle = _load_disasterscope_model()
    assert "models" in bundle
    assert "scaler" in bundle
    assert "feature_names" in bundle
    assert "disaster_severity_level" in bundle["models"]
    assert "affected_area_type" in bundle["models"]
    assert "immediate_action_required" in bundle["models"]
    assert "survivor_presence_likelihood" in bundle["models"]


def test_predict_disaster_scope_structure():
    telemetry = {
        "temperature": 28.0,
        "humidity": 65.0,
        "wind_speed": 12.0,
        "air_quality_index": 110.0,
        "water_level": 0.8,
        "vegetation_cover": 55.0,
        "people_detected": 1,
        "heat_signatures": 0,
        "hazardous_material_detected": 0,
        "building_damage_level": "Minor",
        "road_condition": "Intact",
        "infrastructure_status": "Intact",
    }
    result = predict_disaster_scope(telemetry)

    assert "disaster_severity_level" in result
    assert result["disaster_severity_level"] in ("Low", "Medium", "High")
    assert "affected_area_type" in result
    assert result["affected_area_type"] in ("Unblocked", "Flooded", "Fire-Damaged", "Collapsed Structure")
    assert "immediate_action_required" in result
    assert result["immediate_action_required"] in ("Yes", "No")
    assert "survivor_presence_likelihood" in result
    assert result["survivor_presence_likelihood"] in ("Low", "High")
    assert "urgency_score" in result
    assert 0.0 <= result["urgency_score"] <= 100.0
    assert isinstance(result["recommendations"], list)
    assert len(result["recommendations"]) > 0
    assert "severity_probabilities" in result
    assert "area_type_probabilities" in result


def test_predict_disaster_scope_severe_telemetry():
    severe_telemetry = {
        "temperature": 39.0,
        "humidity": 20.0,
        "wind_speed": 42.0,
        "air_quality_index": 450.0,
        "water_level": 4.5,
        "vegetation_cover": 5.0,
        "people_detected": 8,
        "heat_signatures": 5,
        "hazardous_material_detected": 1,
        "building_damage_level": "Destroyed",
        "road_condition": "Blocked",
        "infrastructure_status": "Severely Damaged",
    }
    result = predict_disaster_scope(severe_telemetry)
    assert result["urgency_score"] > 30.0
    # Hazmat recommendation should be present
    assert any("HAZMAT" in rec or "Hazardous" in rec for rec in result["recommendations"])
