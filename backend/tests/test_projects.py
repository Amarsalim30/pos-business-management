from decimal import Decimal


def test_project_lifecycle_and_inventory_allocation(staff_auth_client):
    # 1. Create a product with stock
    prod_res = staff_auth_client.post("/api/v1/products/", json={
        "name": "550W Mono Solar Panel",
        "unit": "pcs",
        "unit_type": "piece",
        "cost_price": 12000.0,
        "selling_price": 16500.0,
        "initial_stock": 10.0
    })
    assert prod_res.status_code == 201
    prod = prod_res.json()

    # 2. Create a Solar Project
    proj_res = staff_auth_client.post("/api/v1/projects/", json={
        "name": "Diani Beach Villa 10kW Solar",
        "client_name": "Captain Salim",
        "client_phone": "+254711223344",
        "description": "Hybrid inverter, 10kW panels, and lithium storage",
        "quoted_amount": 450000.0,
        "status": "active"
    })
    assert proj_res.status_code == 201
    proj = proj_res.json()
    proj_id = proj["id"]

    # 3. Allocate 4 Solar Panels to the Project
    mat_res = staff_auth_client.post(f"/api/v1/projects/{proj_id}/materials", json={
        "product_id": prod["id"],
        "unit_sold": "piece",
        "quantity": 4.0,
        "unit_price": 16500.0,
        "description": "4x 550W Panels on main roof"
    })
    assert mat_res.status_code == 201
    mat = mat_res.json()
    assert mat["source"] == "inventory"
    assert mat["category"] == "materials"
    assert float(mat["amount"]) == 66000.0  # 4 * 16,500 billed
    assert float(mat["cost_amount"]) == 48000.0  # 4 * 12,000 cost

    # Verify inventory was deducted from 10 to 6
    inv_res = staff_auth_client.get("/api/v1/inventory/")
    inv_item = next(i for i in inv_res.json() if i["product_id"] == prod["id"])
    assert float(inv_item["quantity"]) == 6.0

    # 4. Add External Expense (Labor & Transport)
    exp_res = staff_auth_client.post(f"/api/v1/projects/{proj_id}/expenses", json={
        "category": "labor",
        "amount": 25000.0,
        "description": "Solar Technician installation fee",
        "vendor": "Mombasa Solar Technicians",
        "receipt_no": "REC-8821"
    })
    assert exp_res.status_code == 201

    # 5. Record Client Deposit Payment
    inc_res = staff_auth_client.post(f"/api/v1/projects/{proj_id}/incomes", json={
        "description": "50% Initial Project Deposit",
        "amount": 225000.0,
        "source": "client_payment",
        "payment_method": "bank",
        "reference": "NCBA-TXN-998822"
    })
    assert inc_res.status_code == 201

    # 6. Retrieve Project Detail and verify profit calculation
    detail_res = staff_auth_client.get(f"/api/v1/projects/{proj_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert float(detail["materials_billed"]) == 66000.0
    assert float(detail["materials_cost"]) == 48000.0
    assert float(detail["materials_profit"]) == 18000.0
    assert float(detail["client_payments_total"]) == 225000.0
    assert float(detail["external_expenses_total"]) == 25000.0
    # Total income = 225,000 (client) + 66,000 (materials) = 291,000
    # Total cost = 48,000 (materials) + 25,000 (labor) = 73,000
    # Net profit = 291,000 - 73,000 = 218,000
    assert float(detail["net_profit"]) == 218000.0

    # 7. Check Projects Summary endpoint
    summary_res = staff_auth_client.get("/api/v1/projects/summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_projects"] >= 1
    assert summary["active_projects"] >= 1
    assert float(summary["total_quoted_value"]) >= 450000.0

    # 8. Delete material allocation and verify inventory restoration
    del_res = staff_auth_client.delete(f"/api/v1/projects/{proj_id}/expenses/{mat['id']}")
    assert del_res.status_code == 200

    # Verify inventory was restored from 6 back to 10
    inv_res2 = staff_auth_client.get("/api/v1/inventory/")
    inv_item2 = next(i for i in inv_res2.json() if i["product_id"] == prod["id"])
    assert float(inv_item2["quantity"]) == 10.0

