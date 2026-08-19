from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel


class PaymentMethodSummaryItem(BaseModel):
    method: str
    total_amount: Decimal
    count: int
    percentage: Decimal


class FastMovingProductItem(BaseModel):
    product_id: int
    product_name: str
    sku: Optional[str] = None
    category_name: Optional[str] = None
    total_units_sold: Decimal
    total_revenue: Decimal
    total_profit: Decimal
    stock_on_hand: Decimal


class NetProfitStatementResponse(BaseModel):
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None

    # Sales Revenue
    gross_sales_revenue: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    net_sales_revenue: Decimal

    # Cost of Goods Sold
    cost_of_goods_sold: Decimal

    # Gross Margin
    gross_profit: Decimal
    gross_margin_percentage: Decimal

    # Operating Deductions & Expenses
    purchase_expenses: Decimal
    recurring_expenses: Decimal
    petty_cash_expenses: Decimal
    total_operating_expenses: Decimal

    # Other Incomes & Modules
    mpesa_commission_income: Decimal
    project_net_profit: Decimal

    # Final Net Profit
    net_profit: Decimal


class SalesReportSummaryResponse(BaseModel):
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    total_transactions: int
    total_subtotal: Decimal
    total_tax: Decimal
    total_discount: Decimal
    total_revenue: Decimal
    total_collected: Decimal
    total_outstanding_credit: Decimal
    etr_revenue: Decimal
    non_etr_revenue: Decimal
    payment_methods: List[PaymentMethodSummaryItem] = []
