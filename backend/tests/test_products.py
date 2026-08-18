from decimal import Decimal
import pytest


def test_create_category_and_list(owner_auth_client):
    res = owner_auth_client.post("/api/v1/categories/", json={"name": "Solar Panels"})
    assert res.status_code == 201
    assert res.json()["name"] == "Solar Panels"

    cat_list = owner_auth_client.get("/api/v1/categories/").json()
    assert any(c["name"] == "Solar Panels" for c in cat_list)


def test_create_piece_product_with_sku(owner_auth_client):
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
    assert data["sku"] == "INV-3KVA-001"
    assert float(data["current_stock"]) == 5.0
    assert data["unit_type"] == "piece"


def test_create_product_without_sku_optional(owner_auth_client):
    prod_data = {
        "name": "Generic Tape Roll",
        "sku": None,
        "unit": "pcs",
        "unit_type": "piece",
        "cost_price": 50.00,
        "selling_price": 80.00,
        "initial_stock": 10.0
    }
    res = owner_auth_client.post("/api/v1/products/", json=prod_data)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Generic Tape Roll"
    assert data["sku"] is None

    # Verify multiple products can exist with null SKU without conflict
    prod_data2 = {
        "name": "Another Generic Tape",
        "sku": "",
        "cost_price": 40.00,
        "selling_price": 70.00
    }
    res2 = owner_auth_client.post("/api/v1/products/", json=prod_data2)
    assert res2.status_code == 201
    assert res2.json()["sku"] is None


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


def test_product_validation_errors(owner_auth_client):
    # Missing mandatory name
    res = owner_auth_client.post("/api/v1/products/", json={
        "cost_price": 100.0,
        "selling_price": 150.0
    })
    assert res.status_code == 422

    # Negative cost price
    res2 = owner_auth_client.post("/api/v1/products/", json={
        "name": "Invalid Price Item",
        "cost_price": -50.0,
        "selling_price": 100.0
    })
    assert res2.status_code == 422

    # Negative selling price
    res3 = owner_auth_client.post("/api/v1/products/", json={
        "name": "Invalid Price Item 2",
        "cost_price": 50.0,
        "selling_price": -100.0
    })
    assert res3.status_code == 422

    # Invalid unit type (must be piece or roll)
    res4 = owner_auth_client.post("/api/v1/products/", json={
        "name": "Invalid Unit Type",
        "unit_type": "box_container",
        "cost_price": 50.0,
        "selling_price": 100.0
    })
    assert res4.status_code == 422


def test_product_sku_whitespace_trimming(owner_auth_client):
    # SKU with leading/trailing spaces should be cleanly trimmed
    res = owner_auth_client.post("/api/v1/products/", json={
        "name": "Trimmable SKU Product",
        "sku": "  SP-TRIM-001  ",
        "cost_price": 500.0,
        "selling_price": 750.0
    })
    assert res.status_code == 201
    assert res.json()["sku"] == "SP-TRIM-001"

    # Subsequent insertion with same trimmed SKU should detect collision
    res2 = owner_auth_client.post("/api/v1/products/", json={
        "name": "Duplicate of Trimmed SKU",
        "sku": "SP-TRIM-001",
        "cost_price": 500.0,
        "selling_price": 750.0
    })
    assert res2.status_code == 409


def test_get_nonexistent_product_returns_404(owner_auth_client):
    res = owner_auth_client.get("/api/v1/products/999999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_update_nonexistent_product_returns_404(owner_auth_client):
    res = owner_auth_client.patch("/api/v1/products/999999", json={"selling_price": 200.0})
    assert res.status_code == 404


def test_delete_and_deactivate_product(owner_auth_client):
    # Create product
    prod = owner_auth_client.post("/api/v1/products/", json={
        "name": "To Be Deactivated",
        "sku": "DEACT-001",
        "cost_price": 100.0,
        "selling_price": 150.0
    }).json()

    # Soft delete (deactivate)
    del_res = owner_auth_client.delete(f"/api/v1/products/{prod['id']}")
    assert del_res.status_code == 200

    # Default list excludes inactive products
    prod_list = owner_auth_client.get("/api/v1/products/").json()
    assert not any(p["id"] == prod["id"] for p in prod_list)


def test_category_deletion_flow(owner_auth_client):
    cat = owner_auth_client.post("/api/v1/categories/", json={"name": "Temporary Cat"}).json()
    assert cat["id"] > 0

    del_res = owner_auth_client.delete(f"/api/v1/categories/{cat['id']}")
    assert del_res.status_code == 200

    # Nonexistent category deletion returns 404
    del_res2 = owner_auth_client.delete("/api/v1/categories/99999")
    assert del_res2.status_code == 404


def test_roll_product_fractional_meter_edge_cases(owner_auth_client):
    # 0 stock formatting
    prod0 = owner_auth_client.post("/api/v1/products/", json={
        "name": "Zero Stock Roll Wire",
        "unit_type": "roll",
        "meters_per_roll": 50.0,
        "cost_price": 2500.0,
        "selling_price": 3500.0,
        "initial_stock": 0.0
    }).json()
    assert prod0["formatted_stock"] == "0.0m loose"
    assert prod0["is_low_stock"] is True

    # Exact full roll without loose meters
    prod_full = owner_auth_client.post("/api/v1/products/", json={
        "name": "Exact 2 Rolls Wire",
        "unit_type": "roll",
        "meters_per_roll": 100.0,
        "cost_price": 5000.0,
        "selling_price": 7000.0,
        "initial_stock": 200.0
    }).json()
    assert prod_full["formatted_stock"] == "2 rolls (200.0m)"

    # Fractional loose meters (e.g. 0.75m or 15.5m)
    prod_frac = owner_auth_client.post("/api/v1/products/", json={
        "name": "Fractional Cut Wire",
        "unit_type": "roll",
        "meters_per_roll": 100.0,
        "cost_price": 5000.0,
        "selling_price": 7000.0,
        "initial_stock": 105.5
    }).json()
    assert "1 rolls + 5.5m loose" in prod_frac["formatted_stock"]
