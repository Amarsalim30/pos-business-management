from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.sale import Sale, SaleItem, Payment
from app.models.product import Product, Category
from app.models.inventory import Inventory
from app.models.purchase import PurchaseExpense
from app.models.store import RecurringExpense
from app.models.account import PettyCashEntry, MpesaIncome
from app.models.project import Project, ProjectExpense, ProjectIncome
from app.schemas.report import (
    NetProfitStatementResponse, FastMovingProductItem,
    SalesReportSummaryResponse, PaymentMethodSummaryItem
)


def get_net_profit_statement(
    db: Session,
    store_id: int,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None
) -> NetProfitStatementResponse:
    # 1. Sales revenue & COGS
    sales_q = db.query(Sale).filter(
        Sale.store_id == store_id,
        Sale.voided_at.is_(None)
    )
    if date_from:
        sales_q = sales_q.filter(Sale.created_at >= date_from)
    if date_to:
        sales_q = sales_q.filter(Sale.created_at <= date_to)

    sales = sales_q.all()

    gross_sales_revenue = Decimal("0.00")
    tax_amount = Decimal("0.00")
    discount_amount = Decimal("0.00")
    cogs = Decimal("0.00")

    for s in sales:
        gross_sales_revenue += s.total_amount
        tax_amount += s.tax_amount
        discount_amount += s.discount_amount
        for item in s.items:
            unit_cost = item.cost_price or Decimal("0.00")
            cogs += unit_cost * item.quantity

    net_sales_revenue = gross_sales_revenue - tax_amount
    gross_profit = gross_sales_revenue - cogs
    gross_margin_pct = (
        (gross_profit / gross_sales_revenue * Decimal("100.00"))
        if gross_sales_revenue > Decimal("0.00") else Decimal("0.00")
    )

    # 2. Purchase Expenses (fare, labour, transport)
    pe_q = db.query(func.coalesce(func.sum(PurchaseExpense.amount), Decimal("0.00"))).filter(
        PurchaseExpense.store_id == store_id
    )
    if date_from:
        pe_q = pe_q.filter(PurchaseExpense.created_at >= date_from)
    if date_to:
        pe_q = pe_q.filter(PurchaseExpense.created_at <= date_to)
    purchase_expenses = pe_q.scalar() or Decimal("0.00")

    # 3. Recurring Expenses (monthly rent, payroll)
    recurring_expenses = db.query(
        func.coalesce(func.sum(RecurringExpense.amount), Decimal("0.00"))
    ).filter(
        RecurringExpense.store_id == store_id
    ).scalar() or Decimal("0.00")

    # 4. Petty cash outflows
    pc_q = db.query(func.coalesce(func.sum(PettyCashEntry.amount), Decimal("0.00"))).filter(
        PettyCashEntry.store_id == store_id,
        PettyCashEntry.type == "out"
    )
    if date_from:
        pc_q = pc_q.filter(PettyCashEntry.date >= date_from)
    if date_to:
        pc_q = pc_q.filter(PettyCashEntry.date <= date_to)
    petty_cash_expenses = pc_q.scalar() or Decimal("0.00")

    total_operating_expenses = purchase_expenses + recurring_expenses + petty_cash_expenses

    # 5. M-Pesa Commission Income
    mp_q = db.query(func.coalesce(func.sum(MpesaIncome.amount), Decimal("0.00"))).filter(
        MpesaIncome.store_id == store_id
    )
    if date_from:
        mp_q = mp_q.filter(MpesaIncome.date >= date_from)
    if date_to:
        mp_q = mp_q.filter(MpesaIncome.date <= date_to)
    mpesa_commission = mp_q.scalar() or Decimal("0.00")

    # 6. Project Net Profit
    proj_inc_q = db.query(func.coalesce(func.sum(ProjectIncome.amount), Decimal("0.00"))).join(
        Project, ProjectIncome.project_id == Project.id
    ).filter(Project.store_id == store_id)
    if date_from:
        proj_inc_q = proj_inc_q.filter(ProjectIncome.date >= date_from)
    if date_to:
        proj_inc_q = proj_inc_q.filter(ProjectIncome.date <= date_to)
    proj_income = proj_inc_q.scalar() or Decimal("0.00")

    proj_exp_q = db.query(func.coalesce(func.sum(ProjectExpense.cost_amount), Decimal("0.00"))).join(
        Project, ProjectExpense.project_id == Project.id
    ).filter(Project.store_id == store_id)
    if date_from:
        proj_exp_q = proj_exp_q.filter(ProjectExpense.date >= date_from)
    if date_to:
        proj_exp_q = proj_exp_q.filter(ProjectExpense.date <= date_to)
    proj_cost = proj_exp_q.scalar() or Decimal("0.00")

    project_net_profit = proj_income - proj_cost

    # Net Profit Formula:
    # (Gross Revenue - COGS) - Total Operating Expenses + M-Pesa Income + Project Profit
    net_profit = gross_profit - total_operating_expenses + mpesa_commission + project_net_profit

    return NetProfitStatementResponse(
        period_start=date_from,
        period_end=date_to,
        gross_sales_revenue=Decimal(str(gross_sales_revenue)),
        tax_amount=Decimal(str(tax_amount)),
        discount_amount=Decimal(str(discount_amount)),
        net_sales_revenue=Decimal(str(net_sales_revenue)),
        cost_of_goods_sold=Decimal(str(cogs)),
        gross_profit=Decimal(str(gross_profit)),
        gross_margin_percentage=Decimal(str(round(gross_margin_pct, 2))),
        purchase_expenses=Decimal(str(purchase_expenses)),
        recurring_expenses=Decimal(str(recurring_expenses)),
        petty_cash_expenses=Decimal(str(petty_cash_expenses)),
        total_operating_expenses=Decimal(str(total_operating_expenses)),
        mpesa_commission_income=Decimal(str(mpesa_commission)),
        project_net_profit=Decimal(str(project_net_profit)),
        net_profit=Decimal(str(net_profit))
    )


def get_fast_moving_products(
    db: Session, store_id: int, days: int = 30, limit: int = 10
) -> List[FastMovingProductItem]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    items = db.query(
        SaleItem.product_id,
        func.sum(SaleItem.quantity).label("units_sold"),
        func.sum(SaleItem.total).label("total_revenue"),
        func.sum(SaleItem.total - (SaleItem.cost_price * SaleItem.quantity)).label("total_profit")
    ).join(
        Sale, SaleItem.sale_id == Sale.id
    ).filter(
        Sale.store_id == store_id,
        Sale.voided_at.is_(None),
        Sale.created_at >= cutoff
    ).group_by(
        SaleItem.product_id
    ).order_by(
        desc("units_sold")
    ).limit(limit).all()

    result = []
    for it in items:
        prod = db.query(Product).filter(Product.id == it.product_id).first()
        inv = db.query(Inventory).filter(
            Inventory.product_id == it.product_id,
            Inventory.store_id == store_id
        ).first()

        result.append(FastMovingProductItem(
            product_id=it.product_id,
            product_name=prod.name if prod else f"Product #{it.product_id}",
            sku=prod.sku if prod else None,
            category_name=prod.category.name if (prod and prod.category) else None,
            total_units_sold=Decimal(str(it.units_sold or 0)),
            total_revenue=Decimal(str(it.total_revenue or 0)),
            total_profit=Decimal(str(it.total_profit or 0)),
            stock_on_hand=inv.quantity if inv else Decimal("0.00")
        ))
    return result


def get_sales_report_summary(
    db: Session,
    store_id: int,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None
) -> SalesReportSummaryResponse:
    sales_q = db.query(Sale).filter(
        Sale.store_id == store_id,
        Sale.voided_at.is_(None)
    )
    if date_from:
        sales_q = sales_q.filter(Sale.created_at >= date_from)
    if date_to:
        sales_q = sales_q.filter(Sale.created_at <= date_to)

    sales = sales_q.all()

    total_tx = len(sales)
    total_subtotal = sum(s.subtotal for s in sales) if sales else Decimal("0.00")
    total_tax = sum(s.tax_amount for s in sales) if sales else Decimal("0.00")
    total_discount = sum(s.discount_amount for s in sales) if sales else Decimal("0.00")
    total_revenue = sum(s.total_amount for s in sales) if sales else Decimal("0.00")
    total_collected = sum(s.total_paid for s in sales) if sales else Decimal("0.00")
    total_outstanding = sum(s.balance_due for s in sales) if sales else Decimal("0.00")
    etr_revenue = sum(s.total_amount for s in sales if s.is_etr) if sales else Decimal("0.00")
    non_etr_revenue = total_revenue - etr_revenue

    # Payment methods breakdown
    method_totals = {}
    method_counts = {}

    for s in sales:
        pm = (s.payment_method or "cash").lower()
        method_totals[pm] = method_totals.get(pm, Decimal("0.00")) + s.total_amount
        method_counts[pm] = method_counts.get(pm, 0) + 1

    pm_items = []
    for method, amt in method_totals.items():
        pct = (amt / total_revenue * Decimal("100.00")) if total_revenue > Decimal("0.00") else Decimal("0.00")
        pm_items.append(PaymentMethodSummaryItem(
            method=method,
            total_amount=Decimal(str(amt)),
            count=method_counts.get(method, 0),
            percentage=Decimal(str(round(pct, 1)))
        ))

    return SalesReportSummaryResponse(
        period_start=date_from,
        period_end=date_to,
        total_transactions=total_tx,
        total_subtotal=Decimal(str(total_subtotal)),
        total_tax=Decimal(str(total_tax)),
        total_discount=Decimal(str(total_discount)),
        total_revenue=Decimal(str(total_revenue)),
        total_collected=Decimal(str(total_collected)),
        total_outstanding_credit=Decimal(str(total_outstanding)),
        etr_revenue=Decimal(str(etr_revenue)),
        non_etr_revenue=Decimal(str(non_etr_revenue)),
        payment_methods=pm_items
    )
