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

    # Check PO status changed to 'partial'
    po_check = staff_auth_client.get(f"/api/v1/purchases/orders/{po['id']}").json()
    assert po_check["status"] == "partial"
    assert float(po_check["items"][0]["received_qty"]) == 400.0

    # 4. Receive remaining delivery: 6 rolls (600 meters)
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

    # Check PO status is now 'received'
    po_check2 = staff_auth_client.get(f"/api/v1/purchases/orders/{po['id']}").json()
    assert po_check2["status"] == "received"
    assert float(po_check2["items"][0]["received_qty"]) == 1000.0


def test_cancel_purchase_order_guardrails(staff_auth_client):
    # Setup
    supp = staff_auth_client.post("/api/v1/suppliers/", json={"name": "Sollatek East Africa"}).json()
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Sollatek AVS30 Voltage Protector",
        "cost_price": 2500.0,
        "selling_price": 3500.0,
        "initial_stock": 0.0
    }).json()

    # 1. Unreceived PO can be cancelled
    po1 = staff_auth_client.post("/api/v1/purchases/orders", json={
        "supplier_id": supp["id"],
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "piece",
                "ordered_qty": 10.0,
                "unit_cost": 2500.0
            }
        ]
    }).json()

    cancel_res = staff_auth_client.post(f"/api/v1/purchases/orders/{po1['id']}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    # 2. PO with received items cannot be cancelled
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


def test_direct_grn_receipt_without_po(staff_auth_client):
    # 1. Setup supplier & products
    supp = staff_auth_client.post("/api/v1/suppliers/", json={"name": "Direct Solar Importers Ltd"}).json()
    prod1 = staff_auth_client.post("/api/v1/products/", json={
        "name": "Felicity 5kWh Lithium Battery 48V",
        "sku": "FEL-5KWH-48V",
        "cost_price": 140000.0,
        "selling_price": 165000.0,
        "initial_stock": 0.0
    }).json()

    # 2. Post Direct GRN without any PO (po_id is None)
    grn_res = staff_auth_client.post("/api/v1/purchases/grn", json={
        "po_id": None,
        "supplier_id": supp["id"],
        "invoice_number": "DIR-INV-88910",
        "notes": "Direct shop delivery from port container",
        "items": [
            {
                "product_id": prod1["id"],
                "unit_type": "piece",
                "quantity_received": 3.0,
                "unit_cost": 142000.0  # Updated cost price
            }
        ]
    })
    assert grn_res.status_code == 201
    grn = grn_res.json()
    assert grn["grn_no"].startswith("GRN-")
    assert grn["po_id"] is None
    assert grn["supplier_id"] == supp["id"]
    assert float(grn["total_amount"]) == 426000.0  # 3 * 142000

    # 3. Verify product stock increased to 3 pcs and cost_price updated to 142,000
    prod_check = staff_auth_client.get(f"/api/v1/products/{prod1['id']}").json()
    assert float(prod_check["current_stock"]) == 3.0
    assert float(prod_check["cost_price"]) == 142000.0

    # 4. Verify supplier debt balance increased by 426,000
    supp_check = staff_auth_client.get(f"/api/v1/suppliers/{supp['id']}").json()
    assert float(supp_check["balance"]) == 426000.0

    # 5. Verify stock movement was recorded with GRN reference
    movements_res = staff_auth_client.get(f"/api/v1/inventory/movements?product_id={prod1['id']}").json()
    assert len(movements_res) >= 1
    latest_mov = movements_res[0]
    assert latest_mov["type"] == "in"
    assert float(latest_mov["quantity"]) == 3.0
    assert grn["grn_no"] in latest_mov["reference_id"]


def test_edit_and_delete_purchase_order(staff_auth_client):
    supp = staff_auth_client.post("/api/v1/suppliers/", json={"name": "Schneider Electric EA"}).json()
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Schneider 32A Double Pole MCB",
        "cost_price": 1200.0,
        "selling_price": 1800.0,
        "initial_stock": 0.0
    }).json()

    # 1. Create PO
    po = staff_auth_client.post("/api/v1/purchases/orders", json={
        "supplier_id": supp["id"],
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "piece",
                "ordered_qty": 10.0,
                "unit_cost": 1200.0
            }
        ]
    }).json()
    assert float(po["total_amount"]) == 12000.0

    # 2. Edit PO
    put_res = staff_auth_client.put(f"/api/v1/purchases/orders/{po['id']}", json={
        "notes": "Updated delivery terms",
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "piece",
                "ordered_qty": 15.0,
                "unit_cost": 1150.0
            }
        ]
    })
    assert put_res.status_code == 200
    updated_po = put_res.json()
    assert updated_po["notes"] == "Updated delivery terms"
    assert float(updated_po["total_amount"]) == 17250.0
    assert float(updated_po["items"][0]["ordered_qty"]) == 15.0

    # 3. Delete PO
    del_res = staff_auth_client.delete(f"/api/v1/purchases/orders/{po['id']}")
    assert del_res.status_code == 200

    # 4. Verify PO is gone
    get_res = staff_auth_client.get(f"/api/v1/purchases/orders/{po['id']}")
    assert get_res.status_code == 404


def test_edit_and_delete_grn(staff_auth_client):
    supp = staff_auth_client.post("/api/v1/suppliers/", json={"name": "Growatt Kenya Ltd"}).json()
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Growatt 5KW Inverter SPF5000ES",
        "cost_price": 55000.0,
        "selling_price": 72000.0,
        "initial_stock": 0.0
    }).json()

    # 1. Post Direct GRN for 5 inverters
    grn = staff_auth_client.post("/api/v1/purchases/grn", json={
        "supplier_id": supp["id"],
        "invoice_number": "GW-9901",
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "piece",
                "quantity_received": 5.0,
                "unit_cost": 55000.0
            }
        ]
    }).json()
    assert float(grn["total_amount"]) == 275000.0

    # Verify inventory is 5 pcs and supplier balance is 275,000
    prod_check = staff_auth_client.get(f"/api/v1/products/{prod['id']}").json()
    assert float(prod_check["current_stock"]) == 5.0
    supp_check = staff_auth_client.get(f"/api/v1/suppliers/{supp['id']}").json()
    assert float(supp_check["balance"]) == 275000.0

    # 2. Edit GRN to 7 inverters (increase by 2)
    put_res = staff_auth_client.put(f"/api/v1/purchases/grn/{grn['id']}", json={
        "invoice_number": "GW-9901-REV",
        "notes": "Added 2 bonus units delivered",
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "piece",
                "quantity_received": 7.0,
                "unit_cost": 55000.0
            }
        ]
    })
    assert put_res.status_code == 200
    updated_grn = put_res.json()
    assert updated_grn["invoice_number"] == "GW-9901-REV"
    assert float(updated_grn["total_amount"]) == 385000.0

    # Check inventory increased to 7 and supplier balance increased to 385,000
    prod_check2 = staff_auth_client.get(f"/api/v1/products/{prod['id']}").json()
    assert float(prod_check2["current_stock"]) == 7.0
    supp_check2 = staff_auth_client.get(f"/api/v1/suppliers/{supp['id']}").json()
    assert float(supp_check2["balance"]) == 385000.0

    # 3. Edit GRN down to 4 inverters (decrease by 3)
    put_res2 = staff_auth_client.put(f"/api/v1/purchases/grn/{grn['id']}", json={
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "piece",
                "quantity_received": 4.0,
                "unit_cost": 55000.0
            }
        ]
    })
    assert put_res2.status_code == 200
    prod_check3 = staff_auth_client.get(f"/api/v1/products/{prod['id']}").json()
    assert float(prod_check3["current_stock"]) == 4.0
    supp_check3 = staff_auth_client.get(f"/api/v1/suppliers/{supp['id']}").json()
    assert float(supp_check3["balance"]) == 220000.0

    # 4. Delete GRN
    del_res = staff_auth_client.delete(f"/api/v1/purchases/grn/{grn['id']}")
    assert del_res.status_code == 200

    # Verify inventory returned to 0 and supplier balance reversed to 0
    prod_check4 = staff_auth_client.get(f"/api/v1/products/{prod['id']}").json()
    assert float(prod_check4["current_stock"]) == 0.0
    supp_check4 = staff_auth_client.get(f"/api/v1/suppliers/{supp['id']}").json()
    assert float(supp_check4["balance"]) == 0.0


def test_grn_landed_expenses_flow(staff_auth_client):
    supp = staff_auth_client.post("/api/v1/suppliers/", json={"name": "Kenya Solar Wholesale"}).json()
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Solar Battery 200Ah",
        "cost_price": 25000.0,
        "selling_price": 32000.0,
        "initial_stock": 0.0
    }).json()

    # 1. Create Direct GRN with initial freight expense
    grn_res = staff_auth_client.post("/api/v1/purchases/grn", json={
        "supplier_id": supp["id"],
        "invoice_number": "DN-FREIGHT-101",
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "piece",
                "quantity_received": 10.0,
                "unit_cost": 25000.0
            }
        ],
        "expenses": [
            {
                "category": "transport",
                "description": "Port to warehouse freight delivery",
                "amount": 4500.0,
                "payment_method": "cash",
                "reference": "RCP-5501"
            }
        ]
    })
    assert grn_res.status_code == 201
    grn = grn_res.json()
    assert float(grn["total_amount"]) == 250000.0
    assert float(grn["total_expenses"]) == 4500.0
    assert float(grn["landed_cost"]) == 254500.0
    assert len(grn["expenses"]) == 1
    exp_id = grn["expenses"][0]["id"]
    assert grn["expenses"][0]["grn_id"] == grn["id"]

    # 2. Add another landed expense (Labour/Offloading) via POST /purchases/grn/{id}/expenses
    add_exp_res = staff_auth_client.post(f"/api/v1/purchases/grn/{grn['id']}/expenses", json={
        "category": "labour",
        "description": "Offloading 10 batteries at store",
        "amount": 1200.0,
        "payment_method": "mpesa",
        "reference": "MP-OFFLOAD-99"
    })
    assert add_exp_res.status_code == 201
    added_exp = add_exp_res.json()
    assert added_exp["grn_id"] == grn["id"]
    assert float(added_exp["amount"]) == 1200.0

    # 3. Check updated GRN detail
    grn_detail = staff_auth_client.get(f"/api/v1/purchases/grn/{grn['id']}").json()
    assert len(grn_detail["expenses"]) == 2
    assert float(grn_detail["total_expenses"]) == 5700.0
    assert float(grn_detail["landed_cost"]) == 255700.0

    # 4. Update an expense
    put_exp = staff_auth_client.put(f"/api/v1/purchases/expenses/{added_exp['id']}", json={
        "amount": 1500.0,
        "description": "Offloading & stacking 10 batteries"
    })
    assert put_exp.status_code == 200
    assert float(put_exp.json()["amount"]) == 1500.0

    # 5. Delete an expense
    del_exp = staff_auth_client.delete(f"/api/v1/purchases/expenses/{exp_id}")
    assert del_exp.status_code == 200

    grn_detail2 = staff_auth_client.get(f"/api/v1/purchases/grn/{grn['id']}").json()
    assert len(grn_detail2["expenses"]) == 1
    assert float(grn_detail2["total_expenses"]) == 1500.0
    assert float(grn_detail2["landed_cost"]) == 251500.0

