from decimal import Decimal
import pytest
from backend.app.services.inventory import deduct_stock, adjust_stock
from backend.app.schemas.inventory import StockAdjustmentCreate
from backend.app.utils.roll_conversion import format_roll_display


def test_roll_formatting_utility():
    assert format_roll_display(Decimal("485.0"), Decimal("100.0")) == "4 rolls + 85.0m loose (485.0m total)"
    assert format_roll_display(Decimal("300.0"), Decimal("100.0")) == "3 rolls (300.0m)"
    assert format_roll_display(Decimal("15.5"), Decimal("100.0")) == "15.5m loose"
    assert format_roll_display(Decimal("0.0"), Decimal("100.0")) == "0.0m loose"


def test_deduct_stock_piece(db_session, owner_auth_client):
    # Create product with 10 pcs
    prod = owner_auth_client.post("/api/v1/products/", json={
        "name": "Battery 100Ah",
        "sku": "BAT-100AH",
        "cost_price": 12000.0,
        "selling_price": 16000.0,
        "initial_stock": 10.0
    }).json()

    prev, new = deduct_stock(
        db=db_session,
        store_id=prod["store_id"],
        user_id=1,
        product_id=prod["id"],
        quantity=Decimal("3.0"),
        unit_sold="piece"
    )
    assert prev == Decimal("10.0")
    assert new == Decimal("7.0")


def test_deduct_stock_roll_by_roll_and_by_meter(db_session, owner_auth_client):
    # Create Roll Product with 500m (5 rolls)
    prod = owner_auth_client.post("/api/v1/products/", json={
        "name": "Twin Flex 2.5mm",
        "sku": "CBL-FLX-2.5",
        "unit": "meters",
        "unit_type": "roll",
        "meters_per_roll": 100.0,
        "cost_price": 5000.0,
        "selling_price": 7000.0,
        "initial_stock": 500.0
    }).json()

    # 1. Sell 1 whole roll (should deduct 100m -> 400m remaining)
    prev1, new1 = deduct_stock(
        db=db_session,
        store_id=prod["store_id"],
        user_id=1,
        product_id=prod["id"],
        quantity=Decimal("1.0"),
        unit_sold="roll"
    )
    assert prev1 == Decimal("500.0")
    assert new1 == Decimal("400.0")

    # 2. Sell 15 meters loose (should deduct 15m -> 385m remaining)
    prev2, new2 = deduct_stock(
        db=db_session,
        store_id=prod["store_id"],
        user_id=1,
        product_id=prod["id"],
        quantity=Decimal("15.0"),
        unit_sold="meter"
    )
    assert prev2 == Decimal("400.0")
    assert new2 == Decimal("385.0")

    # 3. Sell 2.5 meters (partial meter -> 382.5m remaining)
    prev3, new3 = deduct_stock(
        db=db_session,
        store_id=prod["store_id"],
        user_id=1,
        product_id=prod["id"],
        quantity=Decimal("2.5"),
        unit_sold="meter"
    )
    assert prev3 == Decimal("385.0")
    assert new3 == Decimal("382.5")


def test_prevent_overselling_stock(db_session, owner_auth_client):
    prod = owner_auth_client.post("/api/v1/products/", json={
        "name": "Junction Box 4W",
        "sku": "JB-4W-001",
        "cost_price": 50.0,
        "selling_price": 80.0,
        "initial_stock": 5.0
    }).json()

    with pytest.raises(Exception) as excinfo:
        deduct_stock(
            db=db_session,
            store_id=prod["store_id"],
            user_id=1,
            product_id=prod["id"],
            quantity=Decimal("10.0"),
            unit_sold="piece"
        )
    assert "Insufficient stock" in str(excinfo.value)


def test_manual_stock_adjustment(owner_auth_client):
    prod = owner_auth_client.post("/api/v1/products/", json={
        "name": "LED Bulb 9W",
        "sku": "LED-9W-001",
        "cost_price": 80.0,
        "selling_price": 120.0,
        "initial_stock": 20.0
    }).json()

    # Adjustment with note
    res = owner_auth_client.post("/api/v1/inventory/adjust", json={
        "product_id": prod["id"],
        "adjusted_quantity": -2.0,
        "note": "Broken on shelf"
    })
    assert res.status_code == 200
    assert float(res.json()["new_quantity"]) == 18.0

    # Adjustment without note (optional note)
    res2 = owner_auth_client.post("/api/v1/inventory/adjust", json={
        "product_id": prod["id"],
        "adjusted_quantity": 5.0,
        "note": None
    })
    assert res2.status_code == 200
    assert float(res2.json()["new_quantity"]) == 23.0


def test_stock_take_lifecycle_and_variance(owner_auth_client):
    # Ensure at least one product exists
    prod = owner_auth_client.post("/api/v1/products/", json={
        "name": "MC4 Connector Pair",
        "sku": "MC4-CON-001",
        "cost_price": 50.0,
        "selling_price": 100.0,
        "initial_stock": 25.0
    }).json()

    # 1. Start stock take
    st_res = owner_auth_client.post("/api/v1/stock-takes/", json={"notes": "End of month audit"})
    assert st_res.status_code == 201
    st_data = st_res.json()
    st_id = st_data["id"]
    assert st_data["status"] == "in_progress"
    assert len(st_data["items"]) >= 1

    target_item = next(i for i in st_data["items"] if i["product_id"] == prod["id"])
    prod_id = target_item["product_id"]
    exp_qty = float(target_item["expected_quantity"])

    # 2. Record count (found 3 extra items)
    count_res = owner_auth_client.post(f"/api/v1/stock-takes/{st_id}/items", json={
        "product_id": prod_id,
        "counted_quantity": exp_qty + 3.0
    })
    assert count_res.status_code == 200
    assert float(count_res.json()["variance"]) == 3.0

    # 3. Reconcile stock take
    rec_res = owner_auth_client.post(f"/api/v1/stock-takes/{st_id}/reconcile")
    assert rec_res.status_code == 200
    assert rec_res.json()["status"] == "completed"

    # Verify inventory was updated
    prod_check = owner_auth_client.get(f"/api/v1/products/{prod_id}").json()
    assert float(prod_check["current_stock"]) == exp_qty + 3.0
