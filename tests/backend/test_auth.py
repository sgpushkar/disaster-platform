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


def test_signup_with_phone_stores_phone_and_subscriber(client, db_session):
    from app.models.models import SMSSubscriber
    resp = client.post("/signup", json={
        "name": "Pushkar Mhatre",
        "email": "pushkar@example.com",
        "password": "securepassword123",
        "phone": "9876543210"
    })
    assert resp.status_code == 201
    user_data = resp.json()["user"]
    assert user_data["phone"] == "+919876543210"

    # Verify auto-enrollment in SMSSubscriber
    sub = db_session.query(SMSSubscriber).filter(SMSSubscriber.phone_number == "+919876543210").first()
    assert sub is not None
    assert sub.is_active is True


def test_me_profile_endpoints(client):
    signup_resp = client.post("/signup", json={
        "name": "Alex Mercer",
        "email": "alex@example.com",
        "password": "password123",
        "phone": "+919876500000"
    })
    token = signup_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Test /auth/me
    resp1 = client.get("/auth/me", headers=headers)
    assert resp1.status_code == 200
    assert resp1.json()["email"] == "alex@example.com"
    assert resp1.json()["phone"] == "+919876500000"

    # Test /me
    resp2 = client.get("/me", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["email"] == "alex@example.com"


def test_change_password_flow(client):
    signup_resp = client.post("/signup", json={
        "name": "Priya",
        "email": "priya@example.com",
        "password": "oldpassword123"
    })
    token = signup_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Wrong old password rejected
    bad_resp = client.post("/auth/change-password", headers=headers, json={
        "old_password": "wrongpassword",
        "new_password": "newpassword456"
    })
    assert bad_resp.status_code == 400

    # Successful change
    good_resp = client.post("/auth/change-password", headers=headers, json={
        "old_password": "oldpassword123",
        "new_password": "newpassword456"
    })
    assert good_resp.status_code == 200

    # Old password fails login
    fail_login = client.post("/login", json={"email": "priya@example.com", "password": "oldpassword123"})
    assert fail_login.status_code == 401

    # New password succeeds
    succ_login = client.post("/login", json={"email": "priya@example.com", "password": "newpassword456"})
    assert succ_login.status_code == 200


def test_case_insensitive_email_login(client):
    client.post("/signup", json={
        "name": "Case Test",
        "email": "CaseSens@Example.Com",
        "password": "password123"
    })

    # Login with lowercase
    resp1 = client.post("/login", json={"email": "casesens@example.com", "password": "password123"})
    assert resp1.status_code == 200

    # Login with uppercase
    resp2 = client.post("/login", json={"email": "CASESENS@EXAMPLE.COM", "password": "password123"})
    assert resp2.status_code == 200

