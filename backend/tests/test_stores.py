def test_get_store_settings(owner_auth_client):
    res = owner_auth_client.get("/api/v1/stores/settings")
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Test Solar Store"
    assert float(data["vat_rate"]) == 0.16


def test_update_store_settings_as_owner(owner_auth_client):
    res = owner_auth_client.patch("/api/v1/stores/settings", json={
        "name": "Nairobi Solar Hub",
        "phone": "+254799887766"
    })
    assert res.status_code == 200
    assert res.json()["name"] == "Nairobi Solar Hub"
    assert res.json()["phone"] == "+254799887766"


def test_update_store_settings_as_staff_forbidden(staff_auth_client):
    res = staff_auth_client.patch("/api/v1/stores/settings", json={
        "name": "Hacked Name"
    })
    assert res.status_code == 403


def test_list_recurring_expenses(owner_auth_client):
    res = owner_auth_client.get("/api/v1/stores/recurring-expenses")
    assert res.status_code == 200
    expenses = res.json()
    assert len(expenses) >= 1
    assert expenses[0]["name"] == "Store Rent"
    assert float(expenses[0]["amount"]) == 45000.00


def test_create_recurring_expense_as_owner(owner_auth_client):
    res = owner_auth_client.post("/api/v1/stores/recurring-expenses", json={
        "name": "Staff Payroll - John",
        "amount": 35000.00,
        "category": "payroll"
    })
    assert res.status_code == 201
    created = res.json()
    assert created["name"] == "Staff Payroll - John"
    assert float(created["amount"]) == 35000.00
    assert created["category"] == "payroll"


def test_create_recurring_expense_as_staff_forbidden(staff_auth_client):
    res = staff_auth_client.post("/api/v1/stores/recurring-expenses", json={
        "name": "Bonus",
        "amount": 10000.00,
        "category": "payroll"
    })
    assert res.status_code == 403


def test_update_recurring_expense(owner_auth_client):
    expenses = owner_auth_client.get("/api/v1/stores/recurring-expenses").json()
    rent_expense = expenses[0]

    res = owner_auth_client.patch(f"/api/v1/stores/recurring-expenses/{rent_expense['id']}", json={
        "amount": 48000.00
    })
    assert res.status_code == 200
    assert float(res.json()["amount"]) == 48000.00


def test_delete_recurring_expense(owner_auth_client):
    # Create one to delete
    created = owner_auth_client.post("/api/v1/stores/recurring-expenses", json={
        "name": "Water Bill",
        "amount": 2500.00,
        "category": "other"
    }).json()

    del_res = owner_auth_client.delete(f"/api/v1/stores/recurring-expenses/{created['id']}")
    assert del_res.status_code == 200
    assert "deleted" in del_res.json()["message"]


def test_download_database_backup_as_owner(owner_auth_client):
    res = owner_auth_client.get("/api/v1/stores/backup/export")
    assert res.status_code == 200
    assert "application/sql" in res.headers.get("content-type", "")
    assert "attachment; filename=" in res.headers.get("content-disposition", "")
    content = res.text
    assert "-- POS & Business Management System Database Backup" in content


def test_download_database_backup_as_staff_forbidden(staff_auth_client):
    res = staff_auth_client.get("/api/v1/stores/backup/export")
    assert res.status_code == 403


def test_download_database_backup_unauthenticated(client):
    res = client.get("/api/v1/stores/backup/export")
    assert res.status_code == 401


def test_get_backup_status_as_owner(owner_auth_client):
    res = owner_auth_client.get("/api/v1/stores/backup/status")
    assert res.status_code == 200
    data = res.json()
    assert "backup_directory" in data
    assert "status" in data
    assert data["status"] == "ready"

