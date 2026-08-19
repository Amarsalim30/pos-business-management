def test_list_users_as_owner(owner_auth_client):
    res = owner_auth_client.get("/api/v1/users/")
    assert res.status_code == 200
    users = res.json()
    assert len(users) >= 2
    usernames = [u["username"] for u in users]
    assert "owner" in usernames
    assert "staff" in usernames


def test_list_users_as_staff_forbidden(staff_auth_client):
    res = staff_auth_client.get("/api/v1/users/")
    assert res.status_code == 403


def test_create_user_as_owner(owner_auth_client):
    new_user_data = {
        "username": "cashier2",
        "password": "password123",
        "full_name": "Second Cashier",
        "role": "staff"
    }
    res = owner_auth_client.post("/api/v1/users/", json=new_user_data)
    assert res.status_code == 201
    created = res.json()
    assert created["username"] == "cashier2"
    assert created["full_name"] == "Second Cashier"
    assert created["role"] == "staff"
    assert created["is_active"] is True
    assert "password" not in created


def test_create_user_duplicate_username(owner_auth_client):
    res = owner_auth_client.post("/api/v1/users/", json={
        "username": "owner",
        "password": "password123",
        "full_name": "Duplicate Owner",
        "role": "owner"
    })
    assert res.status_code == 409
    assert "already registered" in res.json()["detail"]


def test_create_user_as_staff_forbidden(staff_auth_client):
    res = staff_auth_client.post("/api/v1/users/", json={
        "username": "hacker",
        "password": "password123",
        "full_name": "Unauthorized",
        "role": "staff"
    })
    assert res.status_code == 403


def test_update_user_full_name(owner_auth_client):
    # Find staff ID
    users = owner_auth_client.get("/api/v1/users/").json()
    staff_user = next(u for u in users if u["username"] == "staff")

    res = owner_auth_client.patch(f"/api/v1/users/{staff_user['id']}", json={
        "full_name": "Senior Cashier"
    })
    assert res.status_code == 200
    assert res.json()["full_name"] == "Senior Cashier"


def test_deactivate_staff_user(owner_auth_client):
    users = owner_auth_client.get("/api/v1/users/").json()
    staff_user = next(u for u in users if u["username"] == "staff")

    res = owner_auth_client.delete(f"/api/v1/users/{staff_user['id']}")
    assert res.status_code == 200
    assert res.json()["is_active"] is False


def test_prevent_deactivating_last_owner(owner_auth_client):
    users = owner_auth_client.get("/api/v1/users/").json()
    owner_user = next(u for u in users if u["username"] == "owner")

    res = owner_auth_client.delete(f"/api/v1/users/{owner_user['id']}")
    assert res.status_code == 400
    assert "last active owner" in res.json()["detail"]


def test_prevent_demoting_last_owner(owner_auth_client):
    users = owner_auth_client.get("/api/v1/users/").json()
    owner_user = next(u for u in users if u["username"] == "owner")

    res = owner_auth_client.patch(f"/api/v1/users/{owner_user['id']}", json={
        "role": "staff"
    })
    assert res.status_code == 400
    assert "last active owner" in res.json()["detail"]


def test_create_accountant_user_and_permissions(owner_auth_client):
    res = owner_auth_client.post("/api/v1/users/", json={
        "username": "accountant1",
        "password": "password123",
        "full_name": "Chief Accountant",
        "role": "accountant"
    })
    assert res.status_code == 201
    user = res.json()
    assert user["role"] == "accountant"
    assert "reports:view_net_profit" in user["effective_permissions"]


def test_permission_registry_and_custom_overrides(owner_auth_client):
    # 1. Fetch registry
    reg_res = owner_auth_client.get("/api/v1/users/permissions")
    assert reg_res.status_code == 200
    data = reg_res.json()
    assert "registry" in data
    assert "presets" in data
    assert "pos" in data["registry"]
    assert "storekeeper" in data["presets"]

    # 2. Create staff with custom override (allow voiding & inventory adjust)
    res = owner_auth_client.post("/api/v1/users/", json={
        "username": "senior_cashier",
        "password": "password123",
        "full_name": "Senior Cashier Mary",
        "role": "staff",
        "permissions": ["pos:sell", "pos:quotes", "pos:void", "inventory:adjust"]
    })
    assert res.status_code == 201
    cashier = res.json()
    assert cashier["permissions"] == ["pos:sell", "pos:quotes", "pos:void", "inventory:adjust"]
    assert "pos:void" in cashier["effective_permissions"]
    assert "inventory:adjust" in cashier["effective_permissions"]

    # 3. Update permissions on cashier
    patch_res = owner_auth_client.patch(f"/api/v1/users/{cashier['id']}", json={
        "permissions": ["pos:sell", "pos:quotes"]
    })
    assert patch_res.status_code == 200
    updated_cashier = patch_res.json()
    assert updated_cashier["permissions"] == ["pos:sell", "pos:quotes"]
    assert "pos:void" not in updated_cashier["effective_permissions"]
