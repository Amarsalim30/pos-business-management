from decimal import Decimal
import pytest


def test_create_category_and_list(owner_auth_client):
    res = owner_auth_client.post("/api/v1/categories/", json={"name": "Solar Panels"})
    assert res.status_code == 201
    assert res.json()["name"] == "Solar Panels"

    cat_list = owner_auth_client.get("/api/v1/categories/").json()
    assert any(c["name"] == "Solar Panels" for c in cat_list)


def test_create_piece_product(owner_auth_client):
    prod_data = {
        "name": "Solar Inverter 3KVA",
        "sku": "INV-3KVA-001",
        "unit": "pcs",
        "unit_type": "piece",
        "cost_price": 35000.00,
        "selling_price": 45000.00,
        "reorder_level": 2.0,
        "initial_stock": 5.0
    }
    res = owner_auth_client.post("/api/v1/products/", json=prod_data)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Solar Inverter 3KVA"
    assert float(data["current_stock"]) == 5.0
    assert data["unit_type"] == "piece"


def test_create_roll_product_with_auto_conversion(owner_auth_client):
    prod_data = {
        "name": "Solar DC Cable 4mm Black",
        "sku": "CBL-4MM-BLK",
        "unit": "meters",
        "unit_type": "roll",
        "meters_per_roll": 100.0,
        "cost_price": 6000.00,       # BP per roll
        "selling_price": 8500.00,    # SP per roll
        "price_per_meter": 100.00,   # SP per meter
        "cost_per_meter": 60.00,     # BP per meter
        "reorder_level": 50.0,       # 50 meters
        "initial_stock": 485.0       # 485 meters
    }
    res = owner_auth_client.post("/api/v1/products/", json=prod_data)
    assert res.status_code == 201
    data = res.json()
    assert data["unit_type"] == "roll"
    assert float(data["meters_per_roll"]) == 100.0
    assert float(data["current_stock"]) == 485.0
    assert "4 rolls + 85.0m loose" in data["formatted_stock"]


def test_prevent_duplicate_sku(owner_auth_client):
    prod_data = {
        "name": "Duplicate SKU Item",
        "sku": "DUP-SKU-001",
        "cost_price": 100.0,
        "selling_price": 150.0
    }
    res1 = owner_auth_client.post("/api/v1/products/", json=prod_data)
    assert res1.status_code == 201

    res2 = owner_auth_client.post("/api/v1/products/", json=prod_data)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_get_product_detail_and_search(owner_auth_client):
    # Create product first to test isolation
    owner_auth_client.post("/api/v1/products/", json={
        "name": "Solar DC Cable 6mm Red",
        "sku": "CBL-6MM-RED",
        "cost_price": 7000.0,
        "selling_price": 9500.0,
        "unit_type": "roll",
        "meters_per_roll": 100.0,
        "initial_stock": 200.0
    })

    # Search by name
    res = owner_auth_client.get("/api/v1/products/?q=Cable")
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 1
    assert any("Cable" in i["name"] for i in items)

    # Search by SKU
    sku_res = owner_auth_client.get("/api/v1/products/?q=CBL-6MM")
    assert sku_res.status_code == 200
    assert len(sku_res.json()) >= 1


def test_update_product_pricing(owner_auth_client):
    prod = owner_auth_client.post("/api/v1/products/", json={
        "name": "Offgrid Inverter 5KVA",
        "sku": "INV-5KVA-OFF",
        "cost_price": 55000.0,
        "selling_price": 70000.0
    }).json()

    res = owner_auth_client.patch(f"/api/v1/products/{prod['id']}", json={
        "selling_price": 75000.00
    })
    assert res.status_code == 200
    assert float(res.json()["selling_price"]) == 75000.00
