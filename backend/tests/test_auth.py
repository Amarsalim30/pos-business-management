def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "pos-business-management"}


def test_login_success(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "owner", "password": "owner123"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["username"] == "owner"
    assert data["user"]["role"] == "owner"
    assert "access_token" in res.cookies
    assert "refresh_token" in res.cookies


def test_login_wrong_password(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "owner", "password": "wrongpassword"}
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Incorrect username or password"


def test_login_nonexistent_user(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "nobody", "password": "password"}
    )
    assert res.status_code == 401


def test_login_inactive_user(client, db_session):
    from backend.app.models.user import User
    user = db_session.query(User).filter(User.username == "staff").first()
    user.is_active = False
    db_session.commit()

    res = client.post(
        "/api/v1/auth/login",
        json={"username": "staff", "password": "staff123"}
    )
    assert res.status_code == 401


def test_me_endpoint_authenticated(owner_auth_client):
    res = owner_auth_client.get("/api/v1/auth/me")
    assert res.status_code == 200
    assert res.json()["username"] == "owner"


def test_me_endpoint_unauthenticated(client):
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401


def test_logout(owner_auth_client):
    res = owner_auth_client.post("/api/v1/auth/logout")
    assert res.status_code == 200
    assert "Successfully logged out" in res.json()["message"]

    # Subsequent request should fail
    me_res = owner_auth_client.get("/api/v1/auth/me")
    assert me_res.status_code == 401


def test_refresh_token_flow(client):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username": "owner", "password": "owner123"}
    )
    assert login_res.status_code == 200

    refresh_res = client.post("/api/v1/auth/refresh")
    assert refresh_res.status_code == 200
    assert "access_token" in refresh_res.json()
    assert refresh_res.json()["user"]["username"] == "owner"
