from decimal import Decimal


def test_petty_cash_ledger(staff_auth_client):
    # 1. Add Cash In (Float replenishment)
    staff_auth_client.post("/api/v1/accounts/petty-cash", json={
        "description": "Weekly Petty Cash Float Replenishment",
        "amount": 10000.0,
        "type": "in",
        "category": "float_deposit"
    })

    # 2. Add Cash Out (Office tea & snacks)
    staff_auth_client.post("/api/v1/accounts/petty-cash", json={
        "description": "Milk and sugar for store kitchen",
        "amount": 850.0,
        "type": "out",
        "category": "tea_snacks",
        "receipt_no": "NAIVAS-1122"
    })

    # 3. Check summary
    sum_res = staff_auth_client.get("/api/v1/accounts/petty-cash/summary")
    assert sum_res.status_code == 200
    summary = sum_res.json()
    assert float(summary["total_in"]) >= 10000.0
    assert float(summary["total_out"]) >= 850.0
    assert float(summary["balance"]) == float(summary["total_in"]) - float(summary["total_out"])


def test_bank_accounts_and_mpesa_income(staff_auth_client):
    # 1. Create a Bank Account
    bank_res = staff_auth_client.post("/api/v1/accounts/bank-accounts", json={
        "name": "KCB Business Account",
        "bank_name": "Kenya Commercial Bank",
        "account_number": "1234567890",
        "initial_balance": 50000.0
    })

    assert bank_res.status_code == 201
    bank = bank_res.json()
    bank_id = bank["id"]

    # 2. Record a Deposit Transaction
    dep_res = staff_auth_client.post(f"/api/v1/accounts/bank-accounts/{bank_id}/transactions", json={
        "amount": 25000.0,
        "type": "deposit",
        "description": "Cash sales deposit from drawer",
        "reference": "DEP-991122"
    })
    assert dep_res.status_code == 201

    # 3. Record a Withdrawal Transaction
    w_res = staff_auth_client.post(f"/api/v1/accounts/bank-accounts/{bank_id}/transactions", json={
        "amount": 10000.0,
        "type": "withdrawal",
        "description": "Supplier wire payment",
        "reference": "WIRE-4433"
    })
    assert w_res.status_code == 201

    # Check updated balance: 50,000 + 25,000 - 10,000 = 65,000
    detail_res = staff_auth_client.get(f"/api/v1/accounts/bank-accounts/{bank_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert float(detail["balance"]) == 65000.0
    assert len(detail["transactions"]) == 2

    # 4. Record M-Pesa Agent Commission
    mpesa_res = staff_auth_client.post("/api/v1/accounts/mpesa-income", json={
        "description": "Safaricom M-Pesa monthly float commission payout",
        "amount": 14500.0,
        "reference": "SAF-COM-AUG2026"
    })
    assert mpesa_res.status_code == 201

    # 5. Accounts Overview
    overview_res = staff_auth_client.get("/api/v1/accounts/overview")
    assert overview_res.status_code == 200
    ov = overview_res.json()
    assert float(ov["total_bank_balances"]) >= 65000.0
    assert float(ov["total_mpesa_commission"]) >= 14500.0
