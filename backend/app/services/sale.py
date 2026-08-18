from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from fastapi import HTTPException, status

from app.models.sale import Customer, Sale, SaleItem, CustomerPayment, PreSaleDocument, PreSaleItem
from app.models.inventory import Inventory, StockMovement
from app.models.product import Product
from app.schemas.sale import (
    CustomerCreate, CustomerUpdate, CustomerPaymentCreate,
    SaleCreate, SaleItemCreate, PreSaleDocumentCreate
)
from app.utils.roll_conversion import roll_count_to_meters


# =========================================================================
# Customer Services
# =========================================================================

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


def get_customer(db: Session, customer_id: int) -> Customer:
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return cust


def list_customers(db: Session, q: Optional[str] = None, active_only: bool = True) -> List[Customer]:
    query = db.query(Customer)
    if active_only:
        query = query.filter(Customer.is_active.is_(True))
    if q:
        query = query.filter(
            Customer.name.ilike(f"%{q.strip()}%") | 
            Customer.phone.ilike(f"%{q.strip()}%")
        )
    return query.order_by(Customer.name.asc()).all()


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


def record_customer_payment(db: Session, customer_id: int, user_id: int, pay_in: CustomerPaymentCreate) -> CustomerPayment:
    cust = get_customer(db, customer_id)
    
    pay = CustomerPayment(
        customer_id=cust.id,
        amount=pay_in.amount,
        payment_method=pay_in.payment_method,
        reference=pay_in.reference,
        notes=pay_in.notes,
        user_id=user_id
    )
    db.add(pay)
    
    # Reduce customer's outstanding balance
    cust.balance -= pay_in.amount
    db.commit()
    db.refresh(pay)
    return pay


# =========================================================================
# Sales Checkout Engine (Atomic & Concurrency-Safe)
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

    # 1. Validate customer if credit sale
    customer = None
    if sale_in.payment_method == "credit":
        if not sale_in.customer_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Customer is required for credit sales")
        customer = get_customer(db, sale_in.customer_id)
    elif sale_in.customer_id:
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
                # If pricing was entered per roll, calculate line total
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

    sale = Sale(
        invoice_no=invoice_no,
        customer_id=sale_in.customer_id,
        store_id=store_id,
        user_id=user_id,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=discount,
        total_amount=total_amount,
        payment_method=sale_in.payment_method,
        payment_reference=sale_in.payment_reference,
        status="paid" if sale_in.payment_method != "credit" else "unpaid",
        is_etr=sale_in.is_etr,
        notes=sale_in.notes,
        items=line_items
    )
    db.add(sale)

    # Increase customer balance if credit sale
    if sale_in.payment_method == "credit" and customer:
        customer.balance += total_amount

    db.commit()
    db.refresh(sale)
    return sale


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
    limit: int = 50
) -> List[Sale]:
    query = db.query(Sale).filter(Sale.store_id == store_id)
    if q:
        query = query.filter(Sale.invoice_no.ilike(f"%{q.strip()}%"))
    if customer_id:
        query = query.filter(Sale.customer_id == customer_id)
    if is_etr is not None:
        query = query.filter(Sale.is_etr.is_(is_etr))
    if status_filter:
        query = query.filter(Sale.status == status_filter)

    return query.order_by(desc(Sale.id)).limit(limit).all()


def void_sale(db: Session, store_id: int, user_id: int, sale_id: int, reason: Optional[str] = None) -> Sale:
    sale = get_sale(db, store_id, sale_id)
    if sale.status == "voided":
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

    # If credit sale, reverse the customer balance
    if sale.payment_method == "credit" and sale.customer_id:
        cust = db.query(Customer).filter(Customer.id == sale.customer_id).first()
        if cust:
            cust.balance -= sale.total_amount

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
        notes=f"Converted from {doc.type.upper()} {doc.document_no}. {doc.notes or ''}".strip(),
        items=sale_items_in
    )

    sale = create_sale(db, store_id, user_id, sale_in)
    
    doc.status = "converted"
    doc.converted_sale_id = sale.id
    db.commit()
    return sale
