"""
Tests for the /predict/disaster-risk endpoint.
"""


def _get_auth_token(client, email="attr_user@example.com"):
    resp = client.post("/signup", json={"name": "AttrUser", "email": email, "password": "password123"})
    return resp.json()["access_token"]


def test_predict_disaster_risk_endpoint_requires_auth(client):
    resp = client.post("/predict/disaster-risk", json={})
    assert resp.status_code == 401


def test_predict_disaster_risk_endpoint_success(client):
    token = _get_auth_token(client, email="risk_tester@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "rainfall_24h_mm": 180.0,
        "rainfall_72h_mm": 350.0,
        "humidity_pct": 95.0,
        "temperature_c": 24.0,
        "wind_speed_ms": 16.0,
        "pressure_hpa": 995.0,
        "soil_moisture_pct": 92.0,
        "river_water_level_m": 7.5,
        "drainage_capacity_index": 0.45,
        "use_latest_weather": False,
    }

    resp = client.post("/predict/disaster-risk", headers=headers, json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert "risk_score" in data
    assert "risk_level" in data
    assert "flood_probability" in data
    assert "flood_predicted" in data
    assert data["risk_score"] > 60.0
    assert data["risk_level"] in ("High", "Critical")
    assert data["flood_predicted"] is True
    assert "dataset_benchmarks" in data
    assert data["dataset_benchmarks"]["total_records"] == 61368
