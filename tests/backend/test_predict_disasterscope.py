"""
Tests for the /predict/disaster-scope API endpoint.
"""


def _get_auth_token(client, email="scope_user@example.com"):
    resp = client.post("/signup", json={"name": "ScopeUser", "email": email, "password": "password123"})
    return resp.json()["access_token"]


def test_predict_disaster_scope_requires_auth(client):
    resp = client.post("/predict/disaster-scope", json={})
    assert resp.status_code == 401


def test_predict_disaster_scope_success(client):
    token = _get_auth_token(client, email="drone_pilot@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "temperature": 34.5,
        "humidity": 78.0,
        "wind_speed": 18.0,
        "air_quality_index": 195.0,
        "water_level": 2.2,
        "vegetation_cover": 40.0,
        "people_detected": 4,
        "heat_signatures": 3,
        "hazardous_material_detected": 0,
        "building_damage_level": "Moderate",
        "road_condition": "Damaged",
        "infrastructure_status": "Damaged",
        "use_latest_weather": False,
    }

    resp = client.post("/predict/disaster-scope", headers=headers, json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert "disaster_severity_level" in data
    assert "affected_area_type" in data
    assert "immediate_action_required" in data
    assert "survivor_presence_likelihood" in data
    assert "urgency_score" in data
    assert "recommendations" in data
    assert "input_telemetry" in data
    assert data["input_telemetry"]["people_detected"] == 4
    assert data["input_telemetry"]["building_damage_level"] == "Moderate"
