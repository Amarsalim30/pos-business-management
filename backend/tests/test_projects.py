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

    # 9. Test Customer linking & creation
    cust_res = staff_auth_client.post("/api/v1/customers/", json={
        "name": "General Solar Estates Ltd",
        "phone": "+254788990011",
        "email": "estates@solar.co.ke",
        "address": "Nyali Links Road"
    })
    assert cust_res.status_code == 201
    cust = cust_res.json()

    # Link project to customer
    update_res = staff_auth_client.put(f"/api/v1/projects/{proj_id}", json={
        "customer_id": cust["id"],
        "status": "commissioning"
    })
    assert update_res.status_code == 200

    updated_detail = staff_auth_client.get(f"/api/v1/projects/{proj_id}").json()
    assert updated_detail["customer_id"] == cust["id"]
    assert updated_detail["customer_name"] == "General Solar Estates Ltd"
    assert updated_detail["status"] == "commissioning"

    # 10. Test project deletion
    del_proj = staff_auth_client.delete(f"/api/v1/projects/{proj_id}")
    assert del_proj.status_code == 200


def test_project_batch_material_allocation(staff_auth_client):
    # 1. Create two products with stock
    prod1_res = staff_auth_client.post("/api/v1/products/", json={
        "name": "6mm Twin PV Cable",
        "unit": "meter",
        "unit_type": "roll",
        "meters_per_roll": 100.0,
        "selling_price": 22000.0,
        "price_per_meter": 250.0,
        "price_per_roll": 22000.0,
        "cost_price": 16000.0,
        "cost_per_meter": 160.0,
        "initial_stock": 500.0  # 5 rolls (500m)
    })
    assert prod1_res.status_code == 201
    prod1 = prod1_res.json()

    prod2_res = staff_auth_client.post("/api/v1/products/", json={
        "name": "MC4 Connectors Pair",
        "unit": "pcs",
        "unit_type": "piece",
        "cost_price": 150.0,
        "selling_price": 350.0,
        "initial_stock": 50.0
    })
    assert prod2_res.status_code == 201
    prod2 = prod2_res.json()

    # 2. Create Project
    proj_res = staff_auth_client.post("/api/v1/projects/", json={
        "name": "Watamu Solar Grid-Tie",
        "client_name": "Dr. Amina",
        "client_phone": "+254722998877",
        "quoted_amount": 300000.0,
        "status": "active"
    })
    assert proj_res.status_code == 201
    proj_id = proj_res.json()["id"]

    # 3. Batch Allocate 80 meters cable + 10 pairs MC4
    batch_res = staff_auth_client.post(f"/api/v1/projects/{proj_id}/materials/batch", json={
        "items": [
            {
                "product_id": prod1["id"],
                "unit_sold": "meter",
                "quantity": 80.0,
                "unit_price": 250.0,
                "description": "DC array string cabling"
            },
            {
                "product_id": prod2["id"],
                "unit_sold": "piece",
                "quantity": 10.0,
                "unit_price": 350.0,
                "description": "Array termination pairs"
            }
        ]
    })
    assert batch_res.status_code == 201
    expenses = batch_res.json()
    assert len(expenses) == 2

    # Check inventory deductions
    inv_res = staff_auth_client.get("/api/v1/inventory/")
    inv_map = {i["product_id"]: float(i["quantity"]) for i in inv_res.json()}
    assert inv_map[prod1["id"]] == 420.0  # 500 - 80
    assert inv_map[prod2["id"]] == 40.0   # 50 - 10

    # Verify project financial calculations
    detail_res = staff_auth_client.get(f"/api/v1/projects/{proj_id}")
    detail = detail_res.json()
    # Cable billed: 80 * 250 = 20,000, cost: 80 * 160 = 12,800
    # MC4 billed: 10 * 350 = 3,500, cost: 10 * 150 = 1,500
    # Total materials billed: 23,500, total cost: 14,300
    assert float(detail["materials_billed"]) == 23500.0
    assert float(detail["materials_cost"]) == 14300.0
    assert float(detail["materials_profit"]) == 9200.0


def test_edit_project_materials_expenses_and_incomes(staff_auth_client):
    # 1. Create a product with initial stock = 20
    prod_res = staff_auth_client.post("/api/v1/products/", json={
        "name": "Growatt 5kW Hybrid Inverter",
        "unit": "pcs",
        "unit_type": "piece",
        "cost_price": 85000.0,
        "selling_price": 110000.0,
        "initial_stock": 20.0
    })
    assert prod_res.status_code == 201
    prod = prod_res.json()

    # 2. Create Project
    proj_res = staff_auth_client.post("/api/v1/projects/", json={
        "name": "Kizingo Backup Power",
        "client_name": "Hamisi Salim",
        "quoted_amount": 250000.0,
        "status": "active"
    })
    assert proj_res.status_code == 201
    proj_id = proj_res.json()["id"]

    # 3. Allocate 2 inverters (2 * 110,000 = 220,000 billed, 2 * 85,000 = 170,000 cost)
    mat_res = staff_auth_client.post(f"/api/v1/projects/{proj_id}/materials", json={
        "product_id": prod["id"],
        "unit_sold": "piece",
        "quantity": 2.0,
        "unit_price": 110000.0,
        "description": "2x 5kW Growatt inverters"
    })
    assert mat_res.status_code == 201
    mat_id = mat_res.json()["id"]

    # Check inventory is 20 - 2 = 18
    inv_res = staff_auth_client.get("/api/v1/inventory/")
    inv_item = next(i for i in inv_res.json() if i["product_id"] == prod["id"])
    assert float(inv_item["quantity"]) == 18.0

    # 4. Edit material: increase quantity from 2 to 5 (needs 3 more from inventory)
    edit_mat_res = staff_auth_client.put(f"/api/v1/projects/{proj_id}/expenses/{mat_id}", json={
        "quantity": 5.0,
        "unit_price": 105000.0,  # discounted unit price
        "description": "5x 5kW Growatt inverters in parallel"
    })
    assert edit_mat_res.status_code == 200
    edited_mat = edit_mat_res.json()
    assert float(edited_mat["quantity"]) == 5.0
    assert float(edited_mat["unit_price"]) == 105000.0
    assert float(edited_mat["amount"]) == 525000.0  # 5 * 105,000
    assert float(edited_mat["cost_amount"]) == 425000.0  # 5 * 85,000

    # Verify inventory was deducted from 18 to 15 (20 - 5 = 15)
    inv_res2 = staff_auth_client.get("/api/v1/inventory/")
    inv_item2 = next(i for i in inv_res2.json() if i["product_id"] == prod["id"])
    assert float(inv_item2["quantity"]) == 15.0

    # 5. Edit material: decrease quantity from 5 to 3 (returns 2 to inventory)
    edit_mat_res2 = staff_auth_client.put(f"/api/v1/projects/{proj_id}/expenses/{mat_id}", json={
        "quantity": 3.0,
        "unit_price": 105000.0
    })
    assert edit_mat_res2.status_code == 200
    # Verify inventory restored from 15 to 17 (20 - 3 = 17)
    inv_res3 = staff_auth_client.get("/api/v1/inventory/")
    inv_item3 = next(i for i in inv_res3.json() if i["product_id"] == prod["id"])
    assert float(inv_item3["quantity"]) == 17.0

    # 6. Test insufficient stock error on increase: try setting quantity to 25 (only 17 available, currently holding 3 -> total available 20)
    fail_res = staff_auth_client.put(f"/api/v1/projects/{proj_id}/expenses/{mat_id}", json={
        "quantity": 25.0
    })
    assert fail_res.status_code == 400
    assert "Insufficient inventory" in fail_res.json()["detail"]

    # 7. Add & Edit External Expense
    exp_res = staff_auth_client.post(f"/api/v1/projects/{proj_id}/expenses", json={
        "category": "labor",
        "amount": 15000.0,
        "description": "Technician wiring fee",
        "vendor": "Ali Electrician"
    })
    assert exp_res.status_code == 201
    exp_id = exp_res.json()["id"]

    edit_exp_res = staff_auth_client.put(f"/api/v1/projects/{proj_id}/expenses/{exp_id}", json={
        "category": "subcontract",
        "amount": 22000.0,
        "description": "Master Electrician & Helper Wiring",
        "vendor": "Ali & Sons Electrical",
        "receipt_no": "VOUCH-102"
    })
    assert edit_exp_res.status_code == 200
    edited_exp = edit_exp_res.json()
    assert edited_exp["category"] == "subcontract"
    assert float(edited_exp["amount"]) == 22000.0
    assert edited_exp["vendor"] == "Ali & Sons Electrical"
    assert edited_exp["receipt_no"] == "VOUCH-102"

    # 8. Add & Edit Client Payment
    inc_res = staff_auth_client.post(f"/api/v1/projects/{proj_id}/incomes", json={
        "description": "Initial Deposit",
        "amount": 100000.0,
        "payment_method": "cash"
    })
    assert inc_res.status_code == 201
    inc_id = inc_res.json()["id"]

    edit_inc_res = staff_auth_client.put(f"/api/v1/projects/{proj_id}/incomes/{inc_id}", json={
        "description": "Initial Bank Transfer Deposit",
        "amount": 150000.0,
        "payment_method": "bank",
        "reference": "STANBIC-REF-909"
    })
    assert edit_inc_res.status_code == 200
    edited_inc = edit_inc_res.json()
    assert edited_inc["description"] == "Initial Bank Transfer Deposit"
    assert float(edited_inc["amount"]) == 150000.0
    assert edited_inc["payment_method"] == "bank"
    assert edited_inc["reference"] == "STANBIC-REF-909"

    # 9. Verify overall project detail financials
    detail_res = staff_auth_client.get(f"/api/v1/projects/{proj_id}")
    detail = detail_res.json()
    assert float(detail["client_payments_total"]) == 150000.0
    assert float(detail["external_expenses_total"]) == 22000.0
    assert float(detail["materials_billed"]) == 315000.0  # 3 * 105,000
    assert float(detail["materials_cost"]) == 255000.0  # 3 * 85,000
    assert float(detail["materials_profit"]) == 60000.0  # 315,000 - 255,000



