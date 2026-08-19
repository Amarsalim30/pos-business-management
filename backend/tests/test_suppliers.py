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
    assert len(ledger["entries"]) == 2

    # Entry 1: GRN Credit of 240,000 -> Running Bal 240,000
    e1 = ledger["entries"][0]
    assert e1["type"] == "grn"
    assert float(e1["credit"]) == 240000.0
    assert float(e1["debit"]) == 0.0
    assert float(e1["running_balance"]) == 240000.0

    # Entry 2: Payment Debit of 100,000 -> Running Bal 140,000
    e2 = ledger["entries"][1]
    assert e2["type"] == "payment"
    assert float(e2["credit"]) == 0.0
    assert float(e2["debit"]) == 100000.0
    assert float(e2["running_balance"]) == 140000.0
