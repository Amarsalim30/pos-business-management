from decimal import Decimal


def test_reports_and_profit_statement(staff_auth_client):
    # 1. Check Net Profit Statement
    net_res = staff_auth_client.get("/api/v1/reports/net-profit")
    assert net_res.status_code == 200
    np = net_res.json()
    assert "gross_sales_revenue" in np
    assert "cost_of_goods_sold" in np
    assert "gross_profit" in np
    assert "total_operating_expenses" in np
    assert "mpesa_commission_income" in np
    assert "project_net_profit" in np
    assert "net_profit" in np

    # 2. Check Fast Moving Products
    fast_res = staff_auth_client.get("/api/v1/reports/fast-moving")
    assert fast_res.status_code == 200
    assert isinstance(fast_res.json(), list)

    # 3. Check Sales Summary
    sales_res = staff_auth_client.get("/api/v1/reports/sales-summary")
    assert sales_res.status_code == 200
    s_sum = sales_res.json()
    assert "total_transactions" in s_sum
    assert "total_revenue" in s_sum
    assert "payment_methods" in s_sum
    assert "etr_revenue" in s_sum
    assert "non_etr_revenue" in s_sum
