from decimal import Decimal
import pytest


def test_create_sale_piece_and_stock_deduction(staff_auth_client):
    # 1. Create a piece product with 20 in stock
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Schneider Electric 32A MCB",
        "sku": "SCH-MCB-32A",
        "cost_price": 400.0,
        "selling_price": 650.0,
        "initial_stock": 20.0
    }).json()

    # 2. Checkout 5 pieces via cash
    sale_res = staff_auth_client.post("/api/v1/sales/", json={
        "payment_method": "cash",
        "discount_amount": 50.0,
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "piece",
                "unit_sold": "piece",
                "quantity": 5.0,
                "unit_price": 650.0
            }
        ]
    })
    assert sale_res.status_code == 201
    sale_data = sale_res.json()
    assert sale_data["invoice_no"].startswith("INV-")
    assert float(sale_data["subtotal"]) == 3250.0
    assert float(sale_data["discount_amount"]) == 50.0
    assert float(sale_data["total_amount"]) == 3200.0
    assert sale_data["status"] == "paid"

    # 3. Check stock was deducted to 15
    prod_check = staff_auth_client.get(f"/api/v1/products/{prod['id']}").json()
    assert float(prod_check["current_stock"]) == 15.0


def test_create_sale_roll_meters_and_stock_deduction(staff_auth_client):
    # 1. Create roll product with 2 rolls (200m) in stock
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "East African Cables 4.0mm Single Core",
        "sku": "EAC-4MM-RED",
        "unit_type": "roll",
        "meters_per_roll": 100.0,
        "cost_price": 5000.0,
        "selling_price": 7500.0,
        "initial_stock": 200.0
    }).json()

    # 2. Sell 1 roll + 25m = 125m total
    sale_res = staff_auth_client.post("/api/v1/sales/", json={
        "payment_method": "mpesa",
        "payment_reference": "QHG89423JK",
        "items": [
            {
                "product_id": prod["id"],
                "unit_type": "roll",
                "unit_sold": "roll",
                "rolls_qty": 1,
                "loose_meters": 25.0,
                "unit_price": 7500.0  # 7500 per roll -> 1.25 * 7500 = 9375
            }
        ]
    })
    assert sale_res.status_code == 201
    sale_data = sale_res.json()
    assert float(sale_data["total_amount"]) == 9375.0

    # 3. Verify stock is now 75.0m
    prod_check = staff_auth_client.get(f"/api/v1/products/{prod['id']}").json()
    assert float(prod_check["current_stock"]) == 75.0
    assert "75.0m" in prod_check["formatted_stock"]


def test_prevent_overselling_during_checkout(staff_auth_client):
    # 1. Product with 5 in stock
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Surge Protector 40kA",
        "cost_price": 1200.0,
        "selling_price": 1800.0,
        "initial_stock": 5.0
    }).json()

    # 2. Attempt to sell 10 pieces -> should fail with 400
    fail_res = staff_auth_client.post("/api/v1/sales/", json={
        "payment_method": "cash",
        "items": [
            {"product_id": prod["id"], "unit_type": "piece", "unit_sold": "piece", "quantity": 10.0, "unit_price": 1800.0}
        ]
    })
    assert fail_res.status_code == 400
    assert "Insufficient stock" in fail_res.json()["detail"]


def test_credit_sale_and_customer_balance_lifecycle(staff_auth_client):
    # 1. Create customer
    cust_res = staff_auth_client.post("/api/v1/customers/", json={
        "name": "Mombasa Solar Contractors",
        "phone": "+254711223344",
        "email": "info@msasolar.co.ke"
    })
    assert cust_res.status_code == 201
    cust = cust_res.json()
    assert float(cust["balance"]) == 0.0

    # 2. Create product
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Felicity Solar 5kVA Inverter",
        "cost_price": 75000.0,
        "selling_price": 95000.0,
        "initial_stock": 3.0
    }).json()

    # 3. Credit sale of 1 inverter
    sale_res = staff_auth_client.post("/api/v1/sales/", json={
        "customer_id": cust["id"],
        "payment_method": "credit",
        "items": [
            {"product_id": prod["id"], "quantity": 1.0, "unit_price": 95000.0}
        ]
    })
    assert sale_res.status_code == 201
    assert sale_res.json()["status"] == "unpaid"

    # Customer balance must now be 95,000
    cust_check = staff_auth_client.get(f"/api/v1/customers/{cust['id']}").json()
    assert float(cust_check["balance"]) == 95000.0

    # 4. Record partial payment of 40,000 via Bank
    pay_res = staff_auth_client.post(f"/api/v1/customers/{cust['id']}/payments", json={
        "amount": 40000.0,
        "payment_method": "bank",
        "reference": "EFT-8912389",
        "notes": "Partial settlement"
    })
    assert pay_res.status_code == 201

    # Customer balance must now be 55,000
    cust_after_pay = staff_auth_client.get(f"/api/v1/customers/{cust['id']}").json()
    assert float(cust_after_pay["balance"]) == 55000.0


def test_void_sale_restores_inventory_as_staff_and_owner(staff_auth_client):
    # 1. Product with 10 stock
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Digital Multimeter Pro",
        "cost_price": 1000.0,
        "selling_price": 1500.0,
        "initial_stock": 10.0
    }).json()

    # 2. Make sale of 4 items
    sale = staff_auth_client.post("/api/v1/sales/", json={
        "payment_method": "cash",
        "items": [{"product_id": prod["id"], "quantity": 4.0, "unit_price": 1500.0}]
    }).json()

    # Stock should be 6
    assert float(staff_auth_client.get(f"/api/v1/products/{prod['id']}").json()["current_stock"]) == 6.0

    # 3. Staff voids the sale
    void_res = staff_auth_client.post(f"/api/v1/sales/{sale['id']}/void", json={"reason": "Customer changed mind"})
    assert void_res.status_code == 200
    assert void_res.json()["status"] == "voided"

    # Stock must be restored to 10
    assert float(staff_auth_client.get(f"/api/v1/products/{prod['id']}").json()["current_stock"]) == 10.0

    # 4. Attempting to void again should fail
    re_void = staff_auth_client.post(f"/api/v1/sales/{sale['id']}/void", json={})
    assert re_void.status_code == 400


def test_pre_sale_quotation_to_sale_conversion(staff_auth_client):
    # 1. Create product
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Solar Floodlight 300W",
        "cost_price": 2500.0,
        "selling_price": 3800.0,
        "initial_stock": 15.0
    }).json()

    # 2. Create Quotation
    quote_res = staff_auth_client.post("/api/v1/pre-sales/", json={
        "type": "quotation",
        "discount_amount": 200.0,
        "notes": "Valid for 14 days",
        "items": [
            {"product_id": prod["id"], "quantity": 3.0, "unit_price": 3800.0}
        ]
    })
    assert quote_res.status_code == 201
    quote = quote_res.json()
    assert quote["document_no"].startswith("QT-")
    assert quote["status"] == "draft"
    assert float(quote["total_amount"]) == (3 * 3800.0) - 200.0  # 11,200

    # Stock untouched during quote
    assert float(staff_auth_client.get(f"/api/v1/products/{prod['id']}").json()["current_stock"]) == 15.0

    # 3. Convert quotation to active sale
    conv_res = staff_auth_client.post(f"/api/v1/pre-sales/{quote['id']}/convert-to-sale?payment_method=mpesa")
    assert conv_res.status_code == 200
    sale_data = conv_res.json()
    assert sale_data["invoice_no"].startswith("INV-")
    assert sale_data["payment_method"] == "mpesa"
    assert float(sale_data["total_amount"]) == 11200.0

    # Stock now deducted by 3 -> 12
    assert float(staff_auth_client.get(f"/api/v1/products/{prod['id']}").json()["current_stock"]) == 12.0

    # Quote status updated to converted
    quote_check = staff_auth_client.get(f"/api/v1/pre-sales/{quote['id']}").json()
    assert quote_check["status"] == "converted"
    assert quote_check["converted_sale_id"] == sale_data["id"]


def test_split_payments_at_checkout(staff_auth_client):
    # 1. Create product
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Solar Battery 200Ah Gel",
        "cost_price": 25000.0,
        "selling_price": 32000.0,
        "initial_stock": 5.0
    }).json()

    # 2. Checkout with split payment (20,000 M-Pesa + 12,000 Cash)
    sale_res = staff_auth_client.post("/api/v1/sales/", json={
        "payment_method": "split",
        "payments": [
            {"amount": 20000.0, "payment_method": "mpesa", "reference": "QHG91238A"},
            {"amount": 12000.0, "payment_method": "cash"}
        ],
        "items": [
            {"product_id": prod["id"], "quantity": 1.0, "unit_price": 32000.0}
        ]
    })
    assert sale_res.status_code == 201
    sale_data = sale_res.json()
    assert sale_data["status"] == "paid"
    assert float(sale_data["total_paid"]) == 32000.0
    assert float(sale_data["balance_due"]) == 0.0
    assert len(sale_data["payments"]) == 2
    assert sale_data["payments"][0]["payment_method"] == "mpesa"
    assert float(sale_data["payments"][0]["amount"]) == 20000.0
    assert sale_data["payments"][1]["payment_method"] == "cash"
    assert float(sale_data["payments"][1]["amount"]) == 12000.0


def test_credit_sale_requires_customer_selection(staff_auth_client):
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Solar Cable 6mm",
        "cost_price": 100.0,
        "selling_price": 180.0,
        "initial_stock": 50.0
    }).json()

    # Attempting credit sale without customer_id
    fail_res = staff_auth_client.post("/api/v1/sales/", json={
        "payment_method": "credit",
        "items": [{"product_id": prod["id"], "quantity": 10.0, "unit_price": 180.0}]
    })
    assert fail_res.status_code == 400
    assert "Customer selection is required" in fail_res.json()["detail"]


def test_customer_live_statement_ledger(staff_auth_client):
    # 1. Create customer
    cust = staff_auth_client.post("/api/v1/customers/", json={
        "name": "Taslam Energy Solutions Ltd",
        "phone": "+254722000111"
    }).json()

    # 2. Create product
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Solar Charge Controller 60A",
        "cost_price": 5000.0,
        "selling_price": 7242.0,
        "initial_stock": 10.0
    }).json()

    # 3. Create sale of 7,242 on credit with 0 payment at checkout
    sale_res = staff_auth_client.post("/api/v1/sales/", json={
        "customer_id": cust["id"],
        "payment_method": "credit",
        "items": [{"product_id": prod["id"], "quantity": 1.0, "unit_price": 7242.0}]
    })
    assert sale_res.status_code == 201
    sale = sale_res.json()
    assert sale["status"] == "unpaid"
    assert float(sale["balance_due"]) == 7242.0

    # 4. Record invoice payment of 5,000 via M-Pesa
    pay1 = staff_auth_client.post(f"/api/v1/sales/{sale['id']}/payments", json={
        "amount": 5000.0,
        "payment_method": "mpesa",
        "reference": "QKH7129JK"
    })
    assert pay1.status_code == 201

    # Sale status should now be 'partial' with 2,242 balance due
    sale_check = staff_auth_client.get(f"/api/v1/sales/{sale['id']}").json()
    assert sale_check["status"] == "partial"
    assert float(sale_check["total_paid"]) == 5000.0
    assert float(sale_check["balance_due"]) == 2242.0

    # 5. Record second payment of 2,000 via Cash
    pay2 = staff_auth_client.post(f"/api/v1/sales/{sale['id']}/payments", json={
        "amount": 2000.0,
        "payment_method": "cash"
    })
    assert pay2.status_code == 201

    # 6. Fetch live statement ledger
    ledger_res = staff_auth_client.get(f"/api/v1/customers/{cust['id']}/ledger")
    assert ledger_res.status_code == 200
    ledger = ledger_res.json()
    assert ledger["customer_name"] == "Taslam Energy Solutions Ltd"
    assert float(ledger["total_debt"]) == 242.0

    # Verify rows match the screenshot structure exactly:
    # Row 1: Sale 7,242 -> Debit 7,242, Credit None, Balance 7,242
    # Row 2: Payment M-Pesa 5,000 -> Debit None, Credit 5,000, Balance 2,242
    # Row 3: Payment Cash 2,000 -> Debit None, Credit 2,000, Balance 242
    entries = ledger["entries"]
    assert len(entries) == 3

    assert entries[0]["entry_type"] == "sale"
    assert float(entries[0]["debit"]) == 7242.0
    assert float(entries[0]["running_balance"]) == 7242.0

    assert entries[1]["entry_type"] == "payment"
    assert float(entries[1]["credit"]) == 5000.0
    assert float(entries[1]["running_balance"]) == 2242.0

    assert entries[2]["entry_type"] == "payment"
    assert float(entries[2]["credit"]) == 2000.0
    assert float(entries[2]["running_balance"]) == 242.0


def test_delete_customer_safeguards(staff_auth_client):
    # 1. Create a customer without transactions and delete them
    c1 = staff_auth_client.post("/api/v1/customers/", json={
        "name": "Temporary Test Customer",
        "phone": "+254700000001"
    }).json()

    del_res = staff_auth_client.delete(f"/api/v1/customers/{c1['id']}")
    assert del_res.status_code == 200
    assert "deleted successfully" in del_res.json()["detail"]

    # 2. Create customer with credit debt and verify delete is blocked
    c2 = staff_auth_client.post("/api/v1/customers/", json={
        "name": "Indebted Customer",
        "phone": "+254700000002"
    }).json()

    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Solar Battery 200Ah",
        "cost_price": 15000.0,
        "selling_price": 22000.0,
        "initial_stock": 5.0
    }).json()

    staff_auth_client.post("/api/v1/sales/", json={
        "customer_id": c2["id"],
        "payment_method": "credit",
        "items": [{"product_id": prod["id"], "unit_type": "piece", "unit_sold": "piece", "quantity": 1.0, "unit_price": 22000.0}]
    })

    # Try deleting indebted customer -> 400
    del_debt = staff_auth_client.delete(f"/api/v1/customers/{c2['id']}")
    assert del_debt.status_code == 400
    assert "outstanding balance" in del_debt.json()["detail"].lower()

    # Settle debt
    staff_auth_client.post(f"/api/v1/customers/{c2['id']}/payments", json={
        "amount": 22000.0,
        "payment_method": "mpesa"
    })

    # Delete settled customer -> soft deactivates due to sales history
    del_settled = staff_auth_client.delete(f"/api/v1/customers/{c2['id']}")
    assert del_settled.status_code == 200
    assert "deactivated" in del_settled.json()["detail"].lower()


def test_customers_summary(staff_auth_client):
    summary_res = staff_auth_client.get("/api/v1/customers/summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert "total_customers" in summary
    assert "active_customers" in summary
    assert "total_receivables_debt" in summary
    assert "customers_with_debt" in summary
    assert isinstance(summary["total_customers"], int)
    assert isinstance(summary["active_customers"], int)
    assert float(summary["total_receivables_debt"]) >= 0.0


def test_site_narrative_and_customer_sites_endpoint(staff_auth_client):
    # 1. Create a customer
    cust = staff_auth_client.post("/api/v1/customers/", json={
        "name": "Eng. Kamau Construction",
        "phone": "+254711998877"
    }).json()

    # 2. Create product
    prod = staff_auth_client.post("/api/v1/products/", json={
        "name": "Distribution Board 12 Way",
        "cost_price": 3000.0,
        "selling_price": 4500.0,
        "initial_stock": 20.0
    }).json()

    # 3. Create Sale 1 with site_name "Kilifi Beach Villa - Main DB"
    s1_res = staff_auth_client.post("/api/v1/sales/", json={
        "customer_id": cust["id"],
        "site_name": "Kilifi Beach Villa - Main DB",
        "payment_method": "credit",
        "items": [{"product_id": prod["id"], "unit_type": "piece", "unit_sold": "piece", "quantity": 2.0, "unit_price": 4500.0}]
    })
    assert s1_res.status_code == 201
    assert s1_res.json()["site_name"] == "Kilifi Beach Villa - Main DB"

    # 4. Create Sale 2 with site_name "Nyali Heights Block B"
    s2_res = staff_auth_client.post("/api/v1/sales/", json={
        "customer_id": cust["id"],
        "site_name": "Nyali Heights Block B",
        "payment_method": "mpesa",
        "payment_reference": "QWERT12345",
        "items": [{"product_id": prod["id"], "unit_type": "piece", "unit_sold": "piece", "quantity": 1.0, "unit_price": 4500.0}]
    })
    assert s2_res.status_code == 201
    assert s2_res.json()["site_name"] == "Nyali Heights Block B"

    # 5. Fetch /customers/{id}/sites endpoint
    sites_res = staff_auth_client.get(f"/api/v1/customers/{cust['id']}/sites")
    assert sites_res.status_code == 200
    sites = sites_res.json()
    assert "Kilifi Beach Villa - Main DB" in sites
    assert "Nyali Heights Block B" in sites

    # 6. Check customer ledger contains site_name
    ledger_res = staff_auth_client.get(f"/api/v1/customers/{cust['id']}/ledger")
    assert ledger_res.status_code == 200
    ledger_entries = ledger_res.json()["entries"]
    sale_entries = [e for e in ledger_entries if e["entry_type"] == "sale"]
    assert any(e["site_name"] == "Kilifi Beach Villa - Main DB" for e in sale_entries)
    assert any(e["site_name"] == "Nyali Heights Block B" for e in sale_entries)

    # 7. Test sales search by site_name
    search_res = staff_auth_client.get("/api/v1/sales/?q=Kilifi")
    assert search_res.status_code == 200
    search_sales = search_res.json()
    assert any(s["id"] == s1_res.json()["id"] for s in search_sales)



