from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_
from fastapi import HTTPException, status

from app.models.sale import Customer, Sale, SaleItem, Payment, PreSaleDocument, PreSaleItem
from app.models.inventory import Inventory, StockMovement
from app.models.product import Product
from app.schemas.sale import (
    CustomerCreate, CustomerUpdate, CustomerPaymentCreate, PaymentCreate,
    SaleCreate, SaleItemCreate, PreSaleDocumentCreate, CustomerLedgerEntry,
    CustomerLedgerResponse, CustomerSummaryResponse
)
from app.utils.roll_conversion import roll_count_to_meters


# =========================================================================
# Customer Services & Live Ledger
# =========================================================================

def get_customers_summary(db: Session) -> CustomerSummaryResponse:
    total_customers = db.query(func.count(Customer.id)).scalar() or 0
    active_customers = db.query(func.count(Customer.id)).filter(Customer.is_active == True).scalar() or 0
    total_receivables_debt = db.query(func.coalesce(func.sum(Customer.balance), Decimal("0.00"))).scalar() or Decimal("0.00")
    customers_with_debt = db.query(func.count(Customer.id)).filter(Customer.balance > Decimal("0.00")).scalar() or 0

    return CustomerSummaryResponse(
        total_customers=total_customers,
        active_customers=active_customers,
        total_receivables_debt=Decimal(str(total_receivables_debt)),
        customers_with_debt=customers_with_debt
    )


def create_customer(db: Session, cust_in: CustomerCreate) -> Customer:
    cust = Customer(
        name=cust_in.name.strip(),
        phone=cust_in.phone.strip() if cust_in.phone else None,
        email=cust_in.email.strip() if cust_in.email else None,
        address=cust_in.address.strip() if cust_in.address else None,
        balance=Decimal("0.00"),
        is_active=True
    )
    db.add(cust)
    db.commit()
    db.refresh(cust)
    return cust


def calculate_customer_debt(db: Session, customer_id: int) -> Decimal:
    """Dynamically compute the exact outstanding credit debt for a customer."""
    sales = db.query(Sale).filter(Sale.customer_id == customer_id, Sale.voided_at.is_(None)).all()
    total_unpaid_on_sales = sum((s.balance_due for s in sales), Decimal("0.00"))
    unallocated_payments = db.query(Payment).filter(
        Payment.customer_id == customer_id,
        Payment.sale_id.is_(None)
    ).all()
    unalloc_sum = sum((p.amount for p in unallocated_payments), Decimal("0.00"))
    return max(Decimal("0.00"), total_unpaid_on_sales - unalloc_sum)


def get_customer(db: Session, customer_id: int) -> Customer:
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    # Keep balance synchronized
    calc_bal = calculate_customer_debt(db, cust.id)
    if cust.balance != calc_bal:
        cust.balance = calc_bal
        db.commit()
        db.refresh(cust)
    return cust


def list_customers(
    db: Session,
    q: Optional[str] = None,
    active_only: bool = True,
    limit: Optional[int] = None,
    offset: int = 0
) -> List[Customer]:
    query = db.query(Customer)
    if active_only:
        query = query.filter(Customer.is_active.is_(True))
    if q:
        query = query.filter(
            Customer.name.ilike(f"%{q.strip()}%") | 
            Customer.phone.ilike(f"%{q.strip()}%")
        )
    query = query.order_by(Customer.name.asc())
    if offset:
        query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)

    customers = query.all()
    
    # Synchronize balances with live sales & payments
    changed = False
    for c in customers:
        calc_bal = calculate_customer_debt(db, c.id)
        if c.balance != calc_bal:
            c.balance = calc_bal
            db.add(c)
            changed = True
    if changed:
        db.commit()

    return customers


def update_customer(db: Session, customer_id: int, cust_in: CustomerUpdate) -> Customer:
    cust = get_customer(db, customer_id)
    if cust_in.name is not None:
        cust.name = cust_in.name.strip()
    if cust_in.phone is not None:
        cust.phone = cust_in.phone.strip() if cust_in.phone else None
    if cust_in.email is not None:
        cust.email = cust_in.email.strip() if cust_in.email else None
    if cust_in.address is not None:
        cust.address = cust_in.address.strip() if cust_in.address else None
    if cust_in.is_active is not None:
        cust.is_active = cust_in.is_active

    db.commit()
    db.refresh(cust)
    return cust


def delete_customer(db: Session, customer_id: int) -> dict:
    cust = get_customer(db, customer_id)
    if Decimal(str(cust.balance)) > Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete customer with an outstanding balance of KES {Decimal(str(cust.balance)):,.2f}. Please settle debt first."
        )
    
    # Check for associated sales or payments
    has_sales = db.query(Sale).filter(Sale.customer_id == cust.id).first() is not None
    has_payments = db.query(Payment).filter(Payment.customer_id == cust.id).first() is not None

    if has_sales or has_payments:
        cust.is_active = False
        db.commit()
        return {"detail": "Customer has transaction history and has been deactivated."}
    else:
        db.delete(cust)
        db.commit()
        return {"detail": "Customer deleted successfully."}


def record_customer_payment(
    db: Session, customer_id: int, user_id: int, pay_in: CustomerPaymentCreate, store_id: int = 1
) -> Payment:
    cust = get_customer(db, customer_id)
    
    if pay_in.sale_id:
        return record_sale_payment(db, store_id, user_id, pay_in.sale_id, pay_in)

    # Distribute payment to oldest unpaid / partially paid sales
    unpaid_sales = db.query(Sale).filter(
        Sale.customer_id == cust.id,
        Sale.voided_at.is_(None)
    ).order_by(Sale.id.asc()).all()

    remaining_pay = pay_in.amount
    primary_payment = None

    for sale in unpaid_sales:
        if remaining_pay <= Decimal("0.00"):
            break
        due = sale.balance_due
        if due <= Decimal("0.00"):
            continue
        alloc = min(remaining_pay, due)
        p = Payment(
            sale_id=sale.id,
            customer_id=cust.id,
            store_id=store_id,
            amount=alloc,
            payment_method=pay_in.payment_method,
            reference=pay_in.reference,
            notes=pay_in.notes,
            user_id=user_id
        )
        db.add(p)
        if not primary_payment:
            primary_payment = p
        sale.status = sale.computed_status
        remaining_pay -= alloc

    # If any amount remains after paying off all known invoices, record as unallocated payment
    if remaining_pay > Decimal("0.00") or not unpaid_sales:
        p = Payment(
            sale_id=None,
            customer_id=cust.id,
            store_id=store_id,
            amount=remaining_pay,
            payment_method=pay_in.payment_method,
            reference=pay_in.reference,
            notes=pay_in.notes,
            user_id=user_id
        )
        db.add(p)
        if not primary_payment:
            primary_payment = p

    # Reduce customer balance
    cust.balance = calculate_customer_debt(db, cust.id)
    db.commit()
    if primary_payment:
        db.refresh(primary_payment)
    return primary_payment


def get_customer_ledger(db: Session, customer_id: int) -> CustomerLedgerResponse:
    cust = get_customer(db, customer_id)
    
    # Query all sales for this customer
    sales = db.query(Sale).filter(
        Sale.customer_id == customer_id
    ).order_by(Sale.created_at.asc(), Sale.id.asc()).all()

    # Query all standalone payments for this customer (sale_id is None)
    standalone_payments = db.query(Payment).filter(
        Payment.customer_id == customer_id,
        Payment.sale_id.is_(None)
    ).order_by(Payment.created_at.asc(), Payment.id.asc()).all()

    # Build chronological event timeline
    events = []
    
    for s in sales:
        # Build concise items summary
        items_count = len(s.items) if s.items else 0
        if s.items:
            first_few = [f"{int(it.quantity) if it.quantity % 1 == 0 else float(it.quantity)}x {it.product.name if it.product else 'Item'}" for it in s.items[:2]]
            if items_count > 2:
                items_summary = ", ".join(first_few) + f" (+{items_count - 2} more)"
            else:
                items_summary = ", ".join(first_few)
        else:
            items_summary = None

        events.append({
            "id": f"sale-{s.id}",
            "date": s.created_at,
            "sort_priority": 1,  # sales first
            "entry_type": "sale",
            "reference": s.invoice_no,
            "site_name": s.site_name,
            "notes": s.notes,
            "debit": s.total_amount,
            "credit": None,
            "amount": s.total_amount,
            "sale_id": s.id,
            "items_count": items_count,
            "items_summary": items_summary,
            "payment_method": s.payment_method
        })

        if s.voided_at:
            events.append({
                "id": f"void-{s.id}",
                "date": s.voided_at,
                "sort_priority": 3,
                "entry_type": "void",
                "reference": f"VOID {s.invoice_no}",
                "notes": f"Reason: {s.void_reason or 'Cancelled'}",
                "debit": None,
                "credit": s.total_amount,
                "amount": -s.total_amount,
                "sale_id": s.id,
                "items_count": items_count,
                "items_summary": items_summary,
                "payment_method": s.payment_method
            })
        else:
            # Check for payments attached to this sale
            if s.payments:
                for p in s.payments:
                    method_label = p.payment_method.upper()
                    ref_text = f"Payment ({method_label})"
                    if p.reference:
                        ref_text += f" - {p.reference}"
                    events.append({
                        "id": f"pay-{p.id}",
                        "date": p.created_at,
                        "sort_priority": 2,  # payments after sale
                        "entry_type": "payment",
                        "reference": ref_text,
                        "notes": p.notes or f"Paid for {s.invoice_no}",
                        "debit": None,
                        "credit": p.amount,
                        "amount": -p.amount,
                        "sale_id": s.id,
                        "items_count": None,
                        "items_summary": None,
                        "payment_method": p.payment_method
                    })
            elif s.status == "paid" or s.payment_method != "credit":
                # Legacy / direct cash checkout payment without separate payment row
                method_label = s.payment_method.upper()
                events.append({
                    "id": f"pay-sale-{s.id}",
                    "date": s.created_at,
                    "sort_priority": 2,
                    "entry_type": "payment",
                    "reference": f"Payment ({method_label}) [Checkout]",
                    "notes": s.notes or f"Paid at checkout for {s.invoice_no}",
                    "debit": None,
                    "credit": s.total_amount,
                    "amount": -s.total_amount,
                    "sale_id": s.id,
                    "items_count": None,
                    "items_summary": None,
                    "payment_method": s.payment_method
                })

    for p in standalone_payments:
        method_label = p.payment_method.upper()
        ref_text = f"Account Payment ({method_label})"
        if p.reference:
            ref_text += f" - {p.reference}"

        events.append({
            "id": f"pay-{p.id}",
            "date": p.created_at,
            "sort_priority": 2,
            "entry_type": "payment",
            "reference": ref_text,
            "notes": p.notes or "Account unallocated settlement",
            "debit": None,
            "credit": p.amount,
            "amount": -p.amount,
            "sale_id": None,
            "items_count": None,
            "items_summary": None,
            "payment_method": p.payment_method
        })

    # Sort chronological
    events.sort(key=lambda x: (x["date"], x["sort_priority"]))

    running = Decimal("0.00")
    entries: List[CustomerLedgerEntry] = []

    for ev in events:
        if ev["debit"] is not None:
            running += ev["debit"]
        if ev["credit"] is not None:
            running -= ev["credit"]

        entries.append(CustomerLedgerEntry(
            id=ev["id"],
            date=ev["date"],
            entry_type=ev["entry_type"],
            reference=ev["reference"],
            site_name=ev.get("site_name"),
            notes=ev["notes"],
            debit=ev["debit"],
            credit=ev["credit"],
            running_balance=max(Decimal("0.00"), running),
            sale_id=ev.get("sale_id"),
            items_count=ev.get("items_count"),
            items_summary=ev.get("items_summary"),
            payment_method=ev.get("payment_method")
        ))

    total_debt = max(Decimal("0.00"), running)

    return CustomerLedgerResponse(
        customer_id=cust.id,
        customer_name=cust.name,
        phone=cust.phone,
        total_debt=total_debt,
        entries=entries
    )


def get_customer_sites(db: Session, customer_id: int) -> List[str]:
    """Get distinct, recent site names used for this customer for instant POS and statement autocomplete."""
    sale_results = db.query(Sale.site_name).filter(
        Sale.customer_id == customer_id,
        Sale.site_name.isnot(None),
        Sale.site_name != ""
    ).distinct().all()

    presale_results = db.query(PreSaleDocument.site_name).filter(
        PreSaleDocument.customer_id == customer_id,
        PreSaleDocument.site_name.isnot(None),
        PreSaleDocument.site_name != ""
    ).distinct().all()

    sites_set = set()
    for r in sale_results:
        if r[0] and r[0].strip():
            sites_set.add(r[0].strip())
    for r in presale_results:
        if r[0] and r[0].strip():
            sites_set.add(r[0].strip())

    return sorted(list(sites_set), key=lambda s: s.lower())


# =========================================================================
# Sales Checkout Engine (Atomic, Concurrency-Safe & Split Payments)
# =========================================================================

def generate_invoice_number(db: Session, store_id: int) -> str:
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"INV-{today_str}-"
    
    last_sale = db.query(Sale).filter(
        Sale.invoice_no.like(f"{prefix}%")
    ).order_by(desc(Sale.id)).first()
    
    if last_sale:
        try:
            last_seq = int(last_sale.invoice_no.split("-")[-1])
            new_seq = last_seq + 1
        except Exception:
            new_seq = 1
    else:
        new_seq = 1
        
    return f"{prefix}{new_seq:04d}"


def create_sale(db: Session, store_id: int, user_id: int, sale_in: SaleCreate) -> Sale:
    if not sale_in.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sale must contain at least one item")

    # 1. Customer verification
    customer = None
    if sale_in.customer_id:
        customer = get_customer(db, sale_in.customer_id)

    # 2. Prevent deadlocks: Sort product IDs to acquire row-locks in deterministic order
    sorted_items = sorted(sale_in.items, key=lambda x: x.product_id)

    line_items = []
    subtotal = Decimal("0.00")
    tax_amount = Decimal("0.00")
    invoice_no = generate_invoice_number(db, store_id)

    for item_in in sorted_items:
        prod = db.query(Product).filter(Product.id == item_in.product_id, Product.is_active.is_(True)).first()
        if not prod:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product #{item_in.product_id} not found or inactive")

        # Determine exact deduction quantity in base units (meters or pieces)
        if prod.unit_type == "roll":
            if item_in.unit_sold == "roll":
                rolls = item_in.rolls_qty or 1
                loose = Decimal(str(item_in.loose_meters or "0.00"))
                mpr = prod.meters_per_roll or Decimal("100.00")
                deduct_qty = roll_count_to_meters(rolls, loose, mpr)
                line_total = Decimal(str(item_in.unit_price)) * Decimal(str(rolls + (loose / mpr)))
            elif item_in.unit_sold == "meter":
                deduct_qty = Decimal(str(item_in.quantity or "0.00"))
                line_total = Decimal(str(item_in.unit_price)) * deduct_qty
            else:
                rolls = item_in.rolls_qty or 0
                loose = Decimal(str(item_in.loose_meters or "0.00"))
                mpr = prod.meters_per_roll or Decimal("100.00")
                deduct_qty = roll_count_to_meters(rolls, loose, mpr) if (rolls or loose) else Decimal(str(item_in.quantity or "0.00"))
                line_total = Decimal(str(item_in.unit_price)) * (deduct_qty / mpr)
        else:
            deduct_qty = Decimal(str(item_in.quantity or "1.00"))
            line_total = Decimal(str(item_in.unit_price)) * deduct_qty

        if deduct_qty <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid quantity for product {prod.name}")

        # Row-level lock on inventory
        inv = db.query(Inventory).filter(
            Inventory.product_id == prod.id,
            Inventory.store_id == store_id
        ).with_for_update().first()

        if not inv or inv.quantity < deduct_qty:
            available = inv.quantity if inv else Decimal("0.00")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for '{prod.name}'. Requested: {deduct_qty}, Available: {available}"
            )

        # Deduct inventory & record movement audit
        prev_qty = inv.quantity
        inv.quantity -= deduct_qty
        inv.last_updated = datetime.now(timezone.utc)

        mov = StockMovement(
            product_id=prod.id,
            store_id=store_id,
            type="sale",
            quantity=-deduct_qty,
            unit_sold=item_in.unit_sold,
            previous_quantity=prev_qty,
            new_quantity=inv.quantity,
            reference_id=invoice_no,
            note=f"POS Sale {invoice_no}",
            user_id=user_id
        )
        db.add(mov)

        # Tax calculation (tax-inclusive pricing extract)
        item_tax_rate = prod.tax_rate or Decimal("0.0000")
        if prod.is_taxable and item_tax_rate > 0:
            vat_val = line_total * item_tax_rate / (Decimal("1.00") + item_tax_rate)
            tax_amount += vat_val

        subtotal += line_total

        sale_item = SaleItem(
            product_id=prod.id,
            unit_type=prod.unit_type,
            unit_sold=item_in.unit_sold,
            quantity=deduct_qty,
            rolls_qty=item_in.rolls_qty,
            loose_meters=item_in.loose_meters,
            unit_price=item_in.unit_price,
            cost_price=prod.cost_price,
            tax_rate=item_tax_rate,
            total=line_total
        )
        line_items.append(sale_item)

    discount = Decimal(str(sale_in.discount_amount or "0.00"))
    total_amount = max(Decimal("0.00"), subtotal - discount)

    # 3. Process Payments (Supports split payment lines)
    payments_to_create = []
    if sale_in.payments:
        for p_in in sale_in.payments:
            payments_to_create.append(Payment(
                customer_id=sale_in.customer_id,
                store_id=store_id,
                amount=p_in.amount,
                payment_method=p_in.payment_method,
                reference=p_in.reference,
                notes=p_in.notes,
                user_id=user_id
            ))
    elif sale_in.payment_method and sale_in.payment_method != "credit":
        payments_to_create.append(Payment(
            customer_id=sale_in.customer_id,
            store_id=store_id,
            amount=total_amount,
            payment_method=sale_in.payment_method,
            reference=sale_in.payment_reference,
            notes=sale_in.notes,
            user_id=user_id
        ))

    total_paid_in_checkout = sum((p.amount for p in payments_to_create), Decimal("0.00"))

    # Enforce Customer Requirement for Credit or Partial Sales
    if total_paid_in_checkout < total_amount:
        if not sale_in.customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer selection is required for credit or partial sales"
            )

    # Determine primary payment method label
    if len(payments_to_create) > 1:
        primary_method = "split"
    elif len(payments_to_create) == 1:
        primary_method = payments_to_create[0].payment_method
    else:
        primary_method = "credit"

    clean_site_name = sale_in.site_name.strip() if sale_in.site_name else None

    sale = Sale(
        invoice_no=invoice_no,
        customer_id=sale_in.customer_id,
        store_id=store_id,
        user_id=user_id,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=discount,
        total_amount=total_amount,
        payment_method=primary_method,
        payment_reference=sale_in.payment_reference,
        status="paid" if total_paid_in_checkout >= total_amount else ("partial" if total_paid_in_checkout > 0 else "unpaid"),
        is_etr=sale_in.is_etr,
        site_name=clean_site_name,
        notes=sale_in.notes,
        items=line_items,
        payments=payments_to_create
    )
    db.add(sale)

    # Update customer balance for any unpaid amount
    if customer and total_paid_in_checkout < total_amount:
        customer.balance += (total_amount - total_paid_in_checkout)

    db.commit()
    db.refresh(sale)
    return sale


def record_sale_payment(
    db: Session, store_id: int, user_id: int, sale_id: int, pay_in: PaymentCreate
) -> Payment:
    sale = get_sale(db, store_id, sale_id)
    if sale.computed_status == "voided":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot record payment on a voided sale")

    pay = Payment(
        sale_id=sale.id,
        customer_id=sale.customer_id,
        store_id=store_id,
        amount=pay_in.amount,
        payment_method=pay_in.payment_method,
        reference=pay_in.reference,
        notes=pay_in.notes,
        user_id=user_id
    )
    db.add(pay)

    # Update customer balance if attached to sale
    if sale.customer_id:
        cust = db.query(Customer).filter(Customer.id == sale.customer_id).first()
        if cust:
            cust.balance = max(Decimal("0.00"), cust.balance - pay_in.amount)

    db.commit()
    db.refresh(pay)
    # Refresh sale status
    sale.status = sale.computed_status
    db.commit()
    return pay


def get_sale(db: Session, store_id: int, sale_id: int) -> Sale:
    sale = db.query(Sale).filter(Sale.id == sale_id, Sale.store_id == store_id).first()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    return sale


def list_sales(
    db: Session,
    store_id: int,
    q: Optional[str] = None,
    customer_id: Optional[int] = None,
    is_etr: Optional[bool] = None,
    status_filter: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    offset: int = 0,
    limit: int = 50
) -> List[Sale]:
    query = db.query(Sale).filter(Sale.store_id == store_id)
    
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.outerjoin(Customer, Sale.customer_id == Customer.id)\
                     .outerjoin(SaleItem, Sale.id == SaleItem.sale_id)\
                     .outerjoin(Product, SaleItem.product_id == Product.id)\
                     .outerjoin(Payment, Sale.id == Payment.sale_id)\
                     .filter(
                         or_(
                             Sale.invoice_no.ilike(term),
                             Sale.site_name.ilike(term),
                             Sale.notes.ilike(term),
                             Customer.name.ilike(term),
                             Customer.phone.ilike(term),
                             Product.name.ilike(term),
                             Product.sku.ilike(term),
                             Payment.reference.ilike(term),
                             Payment.notes.ilike(term)
                         )
                     ).distinct()

    if customer_id is not None:
        if customer_id == -1:
            # -1 represents Walk-in customer sales (no customer attached)
            query = query.filter(Sale.customer_id.is_(None))
        elif customer_id > 0:
            query = query.filter(Sale.customer_id == customer_id)

    if is_etr is not None:
        query = query.filter(Sale.is_etr.is_(is_etr))
    if status_filter and status_filter != "all":
        query = query.filter(Sale.status == status_filter)
    if date_from:
        dt_from = date_from.replace(tzinfo=None) if date_from.tzinfo else date_from
        query = query.filter(Sale.created_at >= dt_from)
    if date_to:
        dt_to = date_to.replace(tzinfo=None) if date_to.tzinfo else date_to
        query = query.filter(Sale.created_at <= dt_to)

    return query.order_by(desc(Sale.created_at), desc(Sale.id)).offset(offset).limit(limit).all()


def void_sale(db: Session, store_id: int, user_id: int, sale_id: int, reason: Optional[str] = None) -> Sale:
    sale = get_sale(db, store_id, sale_id)
    if sale.computed_status == "voided":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sale is already voided")

    # Restore inventory for each item
    for item in sale.items:
        inv = db.query(Inventory).filter(
            Inventory.product_id == item.product_id,
            Inventory.store_id == store_id
        ).with_for_update().first()

        if inv:
            prev_qty = inv.quantity
            inv.quantity += item.quantity
            inv.last_updated = datetime.now(timezone.utc)

            mov = StockMovement(
                product_id=item.product_id,
                store_id=store_id,
                type="void_return",
                quantity=item.quantity,
                unit_sold=item.unit_sold,
                previous_quantity=prev_qty,
                new_quantity=inv.quantity,
                reference_id=sale.invoice_no,
                note=f"Void Sale {sale.invoice_no}: {reason or 'Cancelled by cashier'}",
                user_id=user_id
            )
            db.add(mov)

    # If customer owes on this sale, reverse that debt portion
    if sale.customer_id and sale.balance_due > 0:
        cust = db.query(Customer).filter(Customer.id == sale.customer_id).first()
        if cust:
            cust.balance = max(Decimal("0.00"), cust.balance - sale.balance_due)

    sale.voided_at = datetime.now(timezone.utc)
    sale.void_reason = reason or "Cancelled by cashier"
    sale.voided_by_user_id = user_id
    sale.status = "voided"
    if reason:
        sale.notes = f"{sale.notes or ''} [VOIDED: {reason}]".strip()

    db.commit()
    db.refresh(sale)
    return sale


# =========================================================================
# Pre-Sale Documents (Quotations & Proformas)
# =========================================================================

def generate_document_number(db: Session, doc_type: str) -> str:
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = "QT" if doc_type == "quotation" else "PF"
    full_prefix = f"{prefix}-{today_str}-"
    
    last_doc = db.query(PreSaleDocument).filter(
        PreSaleDocument.document_no.like(f"{full_prefix}%")
    ).order_by(desc(PreSaleDocument.id)).first()
    
    if last_doc:
        try:
            last_seq = int(last_doc.document_no.split("-")[-1])
            new_seq = last_seq + 1
        except Exception:
            new_seq = 1
    else:
        new_seq = 1
        
    return f"{full_prefix}{new_seq:04d}"


def create_pre_sale_document(db: Session, store_id: int, user_id: int, doc_in: PreSaleDocumentCreate) -> PreSaleDocument:
    if not doc_in.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document must have at least one item")

    doc_no = generate_document_number(db, doc_in.type)
    line_items = []
    subtotal = Decimal("0.00")
    tax_amount = Decimal("0.00")

    for item_in in doc_in.items:
        prod = db.query(Product).filter(Product.id == item_in.product_id, Product.is_active.is_(True)).first()
        if not prod:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product #{item_in.product_id} not found")

        if prod.unit_type == "roll":
            if item_in.unit_sold == "roll":
                rolls = item_in.rolls_qty or 1
                loose = Decimal(str(item_in.loose_meters or "0.00"))
                mpr = prod.meters_per_roll or Decimal("100.00")
                qty = roll_count_to_meters(rolls, loose, mpr)
                line_total = Decimal(str(item_in.unit_price)) * Decimal(str(rolls + (loose / mpr)))
            else:
                qty = Decimal(str(item_in.quantity or "0.00"))
                line_total = Decimal(str(item_in.unit_price)) * qty
        else:
            qty = Decimal(str(item_in.quantity or "1.00"))
            line_total = Decimal(str(item_in.unit_price)) * qty

        item_tax_rate = prod.tax_rate or Decimal("0.0000")
        if prod.is_taxable and item_tax_rate > 0:
            tax_amount += line_total * item_tax_rate / (Decimal("1.00") + item_tax_rate)

        subtotal += line_total
        line_items.append(PreSaleItem(
            product_id=prod.id,
            unit_type=prod.unit_type,
            unit_sold=item_in.unit_sold,
            quantity=qty,
            rolls_qty=item_in.rolls_qty,
            loose_meters=item_in.loose_meters,
            unit_price=item_in.unit_price,
            tax_rate=item_tax_rate,
            total=line_total
        ))

    discount = Decimal(str(doc_in.discount_amount or "0.00"))
    total_amount = max(Decimal("0.00"), subtotal - discount)

    doc = PreSaleDocument(
        document_no=doc_no,
        type=doc_in.type,
        customer_id=doc_in.customer_id,
        store_id=store_id,
        user_id=user_id,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=discount,
        total_amount=total_amount,
        status="draft",
        site_name=doc_in.site_name.strip() if doc_in.site_name else None,
        valid_until=doc_in.valid_until,
        notes=doc_in.notes,
        items=line_items
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def list_pre_sale_documents(db: Session, store_id: int, doc_type: Optional[str] = None) -> List[PreSaleDocument]:
    query = db.query(PreSaleDocument).filter(PreSaleDocument.store_id == store_id)
    if doc_type:
        query = query.filter(PreSaleDocument.type == doc_type)
    return query.order_by(desc(PreSaleDocument.id)).all()


def get_pre_sale_document(db: Session, store_id: int, doc_id: int) -> PreSaleDocument:
    doc = db.query(PreSaleDocument).filter(PreSaleDocument.id == doc_id, PreSaleDocument.store_id == store_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


def convert_pre_sale_to_sale(db: Session, store_id: int, user_id: int, doc_id: int, payment_method: str = "cash") -> Sale:
    doc = get_pre_sale_document(db, store_id, doc_id)
    if doc.status == "converted":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document has already been converted to a sale")

    # Map pre-sale items to SaleCreate items
    sale_items_in = []
    for it in doc.items:
        sale_items_in.append(SaleItemCreate(
            product_id=it.product_id,
            unit_type=it.unit_type,
            unit_sold=it.unit_sold,
            quantity=it.quantity,
            rolls_qty=it.rolls_qty,
            loose_meters=it.loose_meters,
            unit_price=it.unit_price
        ))

    sale_in = SaleCreate(
        customer_id=doc.customer_id,
        payment_method=payment_method,
        discount_amount=doc.discount_amount,
        site_name=doc.site_name,
        notes=f"Converted from {doc.type.upper()} {doc.document_no}. {doc.notes or ''}".strip(),
        items=sale_items_in
    )

    sale = create_sale(db, store_id, user_id, sale_in)
    
    doc.status = "converted"
    doc.converted_sale_id = sale.id
    db.commit()
    return sale
