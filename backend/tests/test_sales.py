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
