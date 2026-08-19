from decimal import Decimal
import pytest


def test_create_purchase_order_and_expenses(staff_auth_client):
    # 1. Setup supplier & product
    supp = staff_auth_client.post("/api/v1/suppliers/", json={"name": "Must Solar East Africa"}).json()
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Must 3KW Hybrid Inverter 24V",
        "sku": "MUST-3KW-24V",
        "cost_price": 45000.0,
        "selling_price": 60000.0,
        "initial_stock": 0.0
    }).json()

    # 2. Create Purchase Order
    po_res = staff_auth_client.post("/api/v1/purchases/orders", json={
        "supplier_id": supp["id"],
        "is_etr": True,
        "notes": "Urgent procurement for shop restock",
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "piece",
                "ordered_qty": 4.0,
                "unit_cost": 45000.0
            }
        ]
    })
    assert po_res.status_code == 201
    po = po_res.json()
    assert po["po_no"].startswith("PO-")
    assert po["status"] == "ordered"
    assert po["is_etr"] is True
    assert float(po["total_amount"]) == 180000.0

    # 3. Add transport expense to PO
    exp_res = staff_auth_client.post(f"/api/v1/purchases/orders/{po['id']}/expenses", json={
        "category": "transport",
        "description": "Pickup truck delivery from warehouse",
        "amount": 3500.0,
        "payment_method": "mpesa",
        "reference": "QKA991823"
    })
    assert exp_res.status_code == 201
    expense = exp_res.json()
    assert expense["category"] == "transport"
    assert float(expense["amount"]) == 3500.0

    # 4. Check PO details contain expenses
    po_detail = staff_auth_client.get(f"/api/v1/purchases/orders/{po['id']}").json()
    assert len(po_detail["expenses"]) == 1
    assert float(po_detail["expenses"][0]["amount"]) == 3500.0


def test_grn_receives_stock_and_updates_po_status(staff_auth_client):
    # 1. Setup supplier & roll product
    supp = staff_auth_client.post("/api/v1/suppliers/", json={"name": "Metsec Cables Ltd"}).json()
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Metsec 6.0mm Solar DC Cable",
        "unit_type": "roll",
        "meters_per_roll": 100.0,
        "cost_price": 8000.0,
        "selling_price": 11000.0,
        "initial_stock": 0.0
    }).json()

    # 2. Create PO for 10 rolls (1,000 meters)
    po = staff_auth_client.post("/api/v1/purchases/orders", json={
        "supplier_id": supp["id"],
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "roll",
                "ordered_qty": 1000.0,
                "unit_cost": 80.0
            }
        ]
    }).json()

    # 3. Receive partial delivery: 4 rolls (400 meters)
    grn1_res = staff_auth_client.post("/api/v1/purchases/grn", json={
        "po_id": po["id"],
        "invoice_number": "MET-00192",
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "roll",
                "quantity_received": 400.0,
                "rolls_received": 4,
                "loose_meters_received": 0.0,
                "unit_cost": 80.0
            }
        ]
    })
    assert grn1_res.status_code == 201

    # Check inventory increased by 400m (4 rolls)
    prod_check = staff_auth_client.get(f"/api/v1/products/{prod['id']}").json()
    assert float(prod_check["current_stock"]) == 400.0
    assert "4 rolls" in prod_check["formatted_stock"]

    # Check PO status is 'partial'
    po_check = staff_auth_client.get(f"/api/v1/purchases/orders/{po['id']}").json()
    assert po_check["status"] == "partial"
    assert float(po_check["items"][0]["received_qty"]) == 400.0

    # 4. Receive remaining 6 rolls (600 meters)
    grn2_res = staff_auth_client.post("/api/v1/purchases/grn", json={
        "po_id": po["id"],
        "invoice_number": "MET-00205",
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "roll",
                "quantity_received": 600.0,
                "rolls_received": 6,
                "loose_meters_received": 0.0,
                "unit_cost": 80.0
            }
        ]
    })
    assert grn2_res.status_code == 201

    # Check inventory is now 1,000m (10 rolls)
    prod_check2 = staff_auth_client.get(f"/api/v1/products/{prod['id']}").json()
    assert float(prod_check2["current_stock"]) == 1000.0
    assert "10 rolls" in prod_check2["formatted_stock"]

    # Check PO status is now 'received'
    po_check2 = staff_auth_client.get(f"/api/v1/purchases/orders/{po['id']}").json()
    assert po_check2["status"] == "received"
    assert float(po_check2["items"][0]["received_qty"]) == 1000.0


def test_prevent_cancelling_po_with_received_goods(staff_auth_client):
    supp = staff_auth_client.post("/api/v1/suppliers/", json={"name": "Top Solar Supplies"}).json()
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Solar Floodlight 100W",
        "cost_price": 2500.0,
        "selling_price": 3800.0,
        "initial_stock": 0.0
    }).json()

    po = staff_auth_client.post("/api/v1/purchases/orders", json={
        "supplier_id": supp["id"],
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "piece",
                "ordered_qty": 5.0,
                "unit_cost": 2500.0
            }
        ]
    }).json()

    # Receive 2 pieces
    staff_auth_client.post("/api/v1/purchases/grn", json={
        "po_id": po["id"],
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "piece",
                "quantity_received": 2.0,
                "unit_cost": 2500.0
            }
        ]
    })

    # Attempting to cancel should be blocked
    cancel_res = staff_auth_client.post(f"/api/v1/purchases/orders/{po['id']}/cancel")
    assert cancel_res.status_code == 400
    assert "Cannot cancel a purchase order that has already received inventory" in cancel_res.json()["detail"]
