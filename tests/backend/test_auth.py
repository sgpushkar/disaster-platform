"""
Unit + API tests for signup/login.
"""


def test_signup_success(client):
    resp = client.post("/signup", json={
        "name": "Test User", "email": "test@example.com", "password": "password123",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["user"]["email"] == "test@example.com"
    assert data["user"]["role"] == "admin"  # first user becomes admin
    assert "access_token" in data


def test_signup_duplicate_email_rejected(client):
    payload = {"name": "Aa", "email": "dupe@example.com", "password": "password123"}
    client.post("/signup", json=payload)
    resp = client.post("/signup", json=payload)
    assert resp.status_code == 400


def test_second_user_is_not_admin(client):
    client.post("/signup", json={"name": "Aa", "email": "a@example.com", "password": "password123"})
    resp = client.post("/signup", json={"name": "Bb", "email": "b@example.com", "password": "password123"})
    assert resp.json()["user"]["role"] == "user"


def test_login_success(client):
    client.post("/signup", json={"name": "Aa", "email": "login@example.com", "password": "password123"})
    resp = client.post("/login", json={"email": "login@example.com", "password": "password123"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_wrong_password_rejected(client):
    client.post("/signup", json={"name": "Aa", "email": "wrongpw@example.com", "password": "password123"})
    resp = client.post("/login", json={"email": "wrongpw@example.com", "password": "wrongpass"})
    assert resp.status_code == 401


def test_login_nonexistent_user_rejected(client):
    resp = client.post("/login", json={"email": "ghost@example.com", "password": "password123"})
    assert resp.status_code == 401


def test_signup_password_too_short_rejected(client):
    resp = client.post("/signup", json={"name": "Aa", "email": "short@example.com", "password": "abc"})
    assert resp.status_code == 422
