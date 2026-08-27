"""
Tests for JWT-protected routes and role-based admin access.
"""


def _signup_and_token(client, email="user@example.com"):
    resp = client.post("/signup", json={"name": "Uu", "email": email, "password": "password123"})
    return resp.json()["access_token"], resp.json()["user"]


def test_dashboard_requires_auth(client):
    resp = client.get("/dashboard")
    assert resp.status_code == 401


def test_dashboard_accessible_with_token(client):
    token, _ = _signup_and_token(client)
    resp = client.get("/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_invalid_token_rejected(client):
    resp = client.get("/dashboard", headers={"Authorization": "Bearer garbage.token.here"})
    assert resp.status_code == 401


def test_admin_route_blocked_for_normal_user(client):
    # first user is admin, so create a second (non-admin) user
    client.post("/signup", json={"name": "Admin1", "email": "admin@example.com", "password": "password123"})
    token, user = _signup_and_token(client, email="normal@example.com")
    assert user["role"] == "user"

    resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_admin_route_allowed_for_admin(client):
    token, user = _signup_and_token(client, email="firstadmin@example.com")
    assert user["role"] == "admin"

    resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_admin_can_create_and_delete_location(client):
    token, _ = _signup_and_token(client, email="locadmin@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = client.post("/admin/locations", headers=headers, json={
        "name": "City Hospital", "latitude": 19.07, "longitude": 72.87, "type": "hospital",
    })
    assert create_resp.status_code == 201
    loc_id = create_resp.json()["id"]

    list_resp = client.get("/map", headers=headers)
    assert len(list_resp.json()) == 1

    delete_resp = client.delete(f"/admin/locations/{loc_id}", headers=headers)
    assert delete_resp.status_code == 200
