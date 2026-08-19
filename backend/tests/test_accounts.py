from decimal import Decimal


def test_petty_cash_ledger(staff_auth_client):
    # 1. Add Cash In (Float replenishment)
    res_in = staff_auth_client.post("/api/v1/accounts/petty-cash", json={
        "description": "Weekly Petty Cash Float Replenishment",
        "amount": 10000.0,
        "type": "in",
        "category": "float_deposit"
    })
    assert res_in.status_code == 201

    # 2. Add Cash Out (Office tea & snacks)
    res_out = staff_auth_client.post("/api/v1/accounts/petty-cash", json={
        "description": "Milk and sugar for store kitchen",
        "amount": 850.0,
        "type": "out",
        "category": "tea_snacks",
        "receipt_no": "NAIVAS-1122"
    })
    assert res_out.status_code == 201

    # 3. Check summary
    sum_res = staff_auth_client.get("/api/v1/accounts/petty-cash/summary")
    assert sum_res.status_code == 200
    summary = sum_res.json()
    assert float(summary["total_in"]) >= 10000.0
    assert float(summary["total_out"]) >= 850.0
    assert float(summary["balance"]) == float(summary["total_in"]) - float(summary["total_out"])


def test_bank_accounts_and_mpesa_income(owner_auth_client, staff_auth_client):
    # Verify staff is forbidden from bank account creation
    staff_bank = staff_auth_client.post("/api/v1/accounts/bank-accounts", json={
        "name": "Unauthorized Staff Bank",
        "bank_name": "Kenya Commercial Bank",
        "account_number": "999999",
        "initial_balance": 10000.0
    })
    assert staff_bank.status_code == 403

    # 1. Owner creates a Bank Account
    bank_res = owner_auth_client.post("/api/v1/accounts/bank-accounts", json={
        "name": "KCB Business Account",
        "bank_name": "Kenya Commercial Bank",
        "account_number": "1234567890",
        "initial_balance": 50000.0
    })
    assert bank_res.status_code == 201
    bank = bank_res.json()
    bank_id = bank["id"]

    # 2. Owner records a Deposit Transaction
    dep_res = owner_auth_client.post(f"/api/v1/accounts/bank-accounts/{bank_id}/transactions", json={
        "amount": 25000.0,
        "type": "deposit",
        "description": "Cash sales deposit from drawer",
        "reference": "DEP-991122"
    })
    assert dep_res.status_code == 201

    # 3. Owner records a Withdrawal Transaction
    w_res = owner_auth_client.post(f"/api/v1/accounts/bank-accounts/{bank_id}/transactions", json={
        "amount": 10000.0,
        "type": "withdrawal",
        "description": "Supplier wire payment",
        "reference": "WIRE-4433"
    })
    assert w_res.status_code == 201

    # Check updated balance: 50,000 + 25,000 - 10,000 = 65,000
    detail_res = owner_auth_client.get(f"/api/v1/accounts/bank-accounts/{bank_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert float(detail["balance"]) == 65000.0
    assert len(detail["transactions"]) == 2

    # 4. Owner records M-Pesa Agent Commission
    mpesa_res = owner_auth_client.post("/api/v1/accounts/mpesa-income", json={
        "description": "Safaricom M-Pesa monthly float commission payout",
        "amount": 14500.0,
        "reference": "SAF-COM-AUG2026"
    })
    assert mpesa_res.status_code == 201

    # 5. Accounts Overview for Owner (Full visibility)
    overview_res = owner_auth_client.get("/api/v1/accounts/overview")
    assert overview_res.status_code == 200
    ov = overview_res.json()
    assert float(ov["total_bank_balances"]) >= 65000.0
    assert float(ov["total_mpesa_commission"]) >= 14500.0

    # 6. Accounts Overview for Staff (Sanitized: bank balances masked)
    staff_ov_res = staff_auth_client.get("/api/v1/accounts/overview")
    assert staff_ov_res.status_code == 200
    staff_ov = staff_ov_res.json()
    assert float(staff_ov["total_bank_balances"]) == 0.0
    assert int(staff_ov["active_bank_accounts"]) == 0
    assert float(staff_ov["total_mpesa_commission"]) == 0.0
