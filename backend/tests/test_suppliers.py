from decimal import Decimal
import pytest


def test_create_supplier_and_list(staff_auth_client):
    res = staff_auth_client.post("/api/v1/suppliers/", json={
        "name": "SolarTech Importers Kenya Ltd",
        "contact_person": "Grace Mwangi",
        "phone": "+254711223344",
        "email": "sales@solartech.co.ke",
        "address": "Industrial Area, Enterprise Road, Nairobi",
        "tax_pin": "P051234567Z"
    })
    assert res.status_code == 201
    supplier = res.json()
    assert supplier["name"] == "SolarTech Importers Kenya Ltd"
    assert float(supplier["balance"]) == 0.0
    assert supplier["is_active"] is True

    # List suppliers
    list_res = staff_auth_client.get("/api/v1/suppliers/")
    assert list_res.status_code == 200
    names = [s["name"] for s in list_res.json()]
    assert "SolarTech Importers Kenya Ltd" in names


def test_supplier_payment_and_ledger(staff_auth_client):
    # 1. Create a supplier
    supp = staff_auth_client.post("/api/v1/suppliers/", json={
        "name": "Kenya Solar Wholesalers",
        "phone": "+254722334455"
    }).json()
    supp_id = supp["id"]

    # 2. Receive goods via direct GRN to generate liability debt
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Felicity Solar Battery 48V 200Ah",
        "cost_price": 120000.0,
        "selling_price": 160000.0,
        "initial_stock": 0.0
    }).json()

    grn_res = staff_auth_client.post("/api/v1/purchases/grn", json={
        "supplier_id": supp_id,
        "invoice_number": "DN-88192",
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "piece",
                "quantity_received": 2.0,
                "unit_cost": 120000.0
            }
        ]
    })
    assert grn_res.status_code == 201

    # Supplier balance should be 240,000
    supp_check = staff_auth_client.get(f"/api/v1/suppliers/{supp_id}").json()
    assert float(supp_check["balance"]) == 240000.0

    # 3. Pay supplier 100,000 via Bank EFT
    pay_res = staff_auth_client.post(f"/api/v1/suppliers/{supp_id}/payments", json={
        "amount": 100000.0,
        "payment_method": "bank",
        "reference": "EFT-889128",
        "notes": "First installment"
    })
    assert pay_res.status_code == 201

    # Supplier balance should now be 140,000
    supp_check2 = staff_auth_client.get(f"/api/v1/suppliers/{supp_id}").json()
    assert float(supp_check2["balance"]) == 140000.0

    # 4. Check Supplier Live Statement Ledger
    ledger_res = staff_auth_client.get(f"/api/v1/suppliers/{supp_id}/ledger")
    assert ledger_res.status_code == 200
    ledger = ledger_res.json()
    assert float(ledger["current_balance"]) == 140000.0
    assert float(ledger["total_invoiced"]) == 240000.0
    assert float(ledger["total_paid"]) == 100000.0
    assert len(ledger["entries"]) == 2

    # Entry 1: GRN Credit of 240,000 -> Running Bal 240,000
    e1 = ledger["entries"][0]
    assert e1["type"] == "grn"
    assert e1["grn_id"] is not None
    assert "DN-88192" in e1["reference"]
    assert "Felicity Solar Battery" in (e1["items_summary"] or "")
    assert float(e1["credit"]) == 240000.0
    assert float(e1["debit"]) == 0.0
    assert float(e1["running_balance"]) == 240000.0

    # Entry 2: Payment Debit of 100,000 -> Running Bal 140,000
    e2 = ledger["entries"][1]
    assert e2["type"] == "payment"
    assert e2["payment_id"] is not None
    assert float(e2["credit"]) == 0.0
    assert float(e2["debit"]) == 100000.0
    assert float(e2["running_balance"]) == 140000.0

    # 5. Fetch single payment voucher detail
    voucher_res = staff_auth_client.get(f"/api/v1/suppliers/payments/{e2['payment_id']}")
    assert voucher_res.status_code == 200
    voucher = voucher_res.json()
    assert voucher["id"] == e2["payment_id"]
    assert float(voucher["amount"]) == 100000.0
    assert voucher["supplier_name"] == "Kenya Solar Wholesalers"
    assert voucher["payment_method"] == "bank"


def test_update_supplier(staff_auth_client):
    supp = staff_auth_client.post("/api/v1/suppliers/", json={
        "name": "Original Supplier Name",
        "phone": "+254711111111"
    }).json()

    update_res = staff_auth_client.put(f"/api/v1/suppliers/{supp['id']}", json={
        "name": "Updated Supplier Name",
        "contact_person": "Jane Doe",
        "phone": "+254722222222",
        "tax_pin": "P059999999Z",
        "is_active": True
    })
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["name"] == "Updated Supplier Name"
    assert updated["contact_person"] == "Jane Doe"
    assert updated["tax_pin"] == "P059999999Z"


def test_delete_supplier_safeguards(staff_auth_client):
    # 1. Create a supplier without transactions and delete them
    s1 = staff_auth_client.post("/api/v1/suppliers/", json={
        "name": "Temp Supplier",
        "phone": "+254733333333"
    }).json()

    del_res = staff_auth_client.delete(f"/api/v1/suppliers/{s1['id']}")
    assert del_res.status_code == 200
    assert "deleted successfully" in del_res.json()["detail"]

    # 2. Create supplier with open liability and verify delete is blocked
    s2 = staff_auth_client.post("/api/v1/suppliers/", json={
        "name": "Creditor Supplier",
        "phone": "+254744444444"
    }).json()

    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Solar Cable 6mm",
        "cost_price": 5000.0,
        "selling_price": 7500.0,
        "initial_stock": 0.0
    }).json()

    staff_auth_client.post("/api/v1/purchases/grn", json={
        "supplier_id": s2["id"],
        "invoice_number": "DN-9999",
        "items": [{"product_id": prod["id"], "unit_type": "piece", "quantity_received": 1.0, "unit_cost": 5000.0}]
    })

    # Try deleting supplier with balance -> 400
    del_debt = staff_auth_client.delete(f"/api/v1/suppliers/{s2['id']}")
    assert del_debt.status_code == 400
    assert "outstanding payable balance" in del_debt.json()["detail"].lower()

    # Settle payable balance
    staff_auth_client.post(f"/api/v1/suppliers/{s2['id']}/payments", json={
        "amount": 5000.0,
        "payment_method": "bank"
    })

    # Delete settled supplier -> soft deactivates due to GRN history
    del_settled = staff_auth_client.delete(f"/api/v1/suppliers/{s2['id']}")
    assert del_settled.status_code == 200
    assert "deactivated" in del_settled.json()["detail"].lower()


def test_suppliers_summary(staff_auth_client):
    summary_res = staff_auth_client.get("/api/v1/suppliers/summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert "total_suppliers" in summary
    assert "active_suppliers" in summary
    assert "total_payables_debt" in summary
    assert "suppliers_with_balance" in summary
    assert isinstance(summary["total_suppliers"], int)
    assert isinstance(summary["active_suppliers"], int)
    assert float(summary["total_payables_debt"]) >= 0.0


def test_suppliers_infinite_scroll_and_filters(staff_auth_client):
    # Create suppliers
    s_a = staff_auth_client.post("/api/v1/suppliers/", json={"name": "AAA Vendor Alpha", "phone": "0700000001"}).json()
    s_b = staff_auth_client.post("/api/v1/suppliers/", json={"name": "ZZZ Vendor Omega", "phone": "0700000002"}).json()

    # Test limit and offset
    page1 = staff_auth_client.get("/api/v1/suppliers/?limit=1&offset=0").json()
    assert len(page1) == 1

    page2 = staff_auth_client.get("/api/v1/suppliers/?limit=1&offset=1").json()
    assert len(page2) == 1
    assert page1[0]["id"] != page2[0]["id"]

    # Test search q
    search_res = staff_auth_client.get("/api/v1/suppliers/?q=Alpha").json()
    assert any(s["name"] == "AAA Vendor Alpha" for s in search_res)

    # Test sort_by
    sort_asc = staff_auth_client.get("/api/v1/suppliers/?sort_by=name_asc").json()
    assert len(sort_asc) >= 2

    # Test has_balance filter
    zero_bal = staff_auth_client.get("/api/v1/suppliers/?has_balance=false").json()
    assert any(s["name"] == "AAA Vendor Alpha" for s in zero_bal)


def test_supplier_advance_payment_and_ledger(staff_auth_client):
    # 1. Create Supplier (e.g. East African Cables PLC)
    supp = staff_auth_client.post("/api/v1/suppliers/", json={
        "name": "East African Cables PLC",
        "phone": "072155544",
        "tax_pin": "P000595019S"
    }).json()
    supp_id = supp["id"]

    # 2. Record Prepayment 1: 31,627.07
    p1 = staff_auth_client.post(f"/api/v1/suppliers/{supp_id}/payments", json={
        "amount": 31627.07,
        "payment_method": "bank",
        "reference": "8725",
        "notes": "Advance Payment 1"
    })
    assert p1.status_code == 201

    # Check ledger after Payment 1 -> Running balance must be -31,627.07
    l1 = staff_auth_client.get(f"/api/v1/suppliers/{supp_id}/ledger").json()
    assert len(l1["entries"]) == 1
    assert round(float(l1["entries"][0]["running_balance"]), 2) == -31627.07

    # 3. Record Prepayment 2: 59,949.96
    p2 = staff_auth_client.post(f"/api/v1/suppliers/{supp_id}/payments", json={
        "amount": 59949.96,
        "payment_method": "bank",
        "reference": "11225",
        "notes": "Advance Payment 2"
    })
    assert p2.status_code == 201

    # Check ledger after Payment 2 -> Running balance must be -91,577.03
    l2 = staff_auth_client.get(f"/api/v1/suppliers/{supp_id}/ledger").json()
    assert len(l2["entries"]) == 2
    assert round(float(l2["entries"][1]["running_balance"]), 2) == -91577.03

    # 4. Create Product & Receive GRN 1: 59,949.96
    prod1 = staff_auth_client.post("/api/v1/products/", json={
        "name": "BLUE SUBMERSIBLE 1.5MM 4 CORE",
        "cost_price": 59949.96,
        "selling_price": 75000.0,
        "initial_stock": 0.0
    }).json()

    grn1 = staff_auth_client.post("/api/v1/purchases/grn", json={
        "supplier_id": supp_id,
        "invoice_number": "11225",
        "items": [
            {
                "product_id": prod1["id"],
                "unit_type": "piece",
                "quantity_received": 1.0,
                "unit_cost": 59949.96
            }
        ]
    })
    assert grn1.status_code == 201

    # Check ledger after GRN 1 -> Running balance must be -31,627.07
    l3 = staff_auth_client.get(f"/api/v1/suppliers/{supp_id}/ledger").json()
    assert len(l3["entries"]) == 3
    assert round(float(l3["entries"][2]["running_balance"]), 2) == -31627.07

    # 5. Receive GRN 2: 31,626.90
    prod2 = staff_auth_client.post("/api/v1/products/", json={
        "name": "BLUE SUBMERSIBLE 2.5MM 4 CORE",
        "cost_price": 31626.90,
        "selling_price": 40000.0,
        "initial_stock": 0.0
    }).json()

    grn2 = staff_auth_client.post("/api/v1/purchases/grn", json={
        "supplier_id": supp_id,
        "invoice_number": "8725",
        "items": [
            {
                "product_id": prod2["id"],
                "unit_type": "piece",
                "quantity_received": 1.0,
                "unit_cost": 31626.90
            }
        ]
    })
    assert grn2.status_code == 201

    # 6. Check final ledger after all 4 transactions
    l4 = staff_auth_client.get(f"/api/v1/suppliers/{supp_id}/ledger").json()
    assert len(l4["entries"]) == 4
    assert round(float(l4["total_invoiced"]), 2) == 91576.86
    assert round(float(l4["total_paid"]), 2) == 91577.03
    assert round(float(l4["current_balance"]), 2) == -0.17
    assert round(float(l4["entries"][3]["running_balance"]), 2) == -0.17




