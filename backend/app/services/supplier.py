from typing import List, Optional
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status
from app.models.supplier import Supplier, SupplierPayment
from app.models.purchase import GoodsReceivedNote, PurchaseOrder
from app.schemas.supplier import (
    SupplierCreate, SupplierUpdate, SupplierPaymentCreate,
    SupplierLedgerResponse, SupplierLedgerEntry, SupplierSummaryResponse
)


def create_supplier(db: Session, store_id: int, supplier_in: SupplierCreate) -> Supplier:
    supplier = Supplier(
        store_id=store_id,
        name=supplier_in.name.strip(),
        contact_person=supplier_in.contact_person.strip() if supplier_in.contact_person else None,
        phone=supplier_in.phone.strip() if supplier_in.phone else None,
        email=supplier_in.email.strip() if supplier_in.email else None,
        address=supplier_in.address.strip() if supplier_in.address else None,
        tax_pin=supplier_in.tax_pin.strip() if supplier_in.tax_pin else None,
        balance=Decimal("0.00"),
        is_active=True
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


def list_suppliers(
    db: Session,
    store_id: int,
    q: Optional[str] = None,
    is_active: Optional[bool] = None,
    has_balance: Optional[bool] = None,
    sort_by: Optional[str] = "name_asc",
    limit: Optional[int] = None,
    offset: int = 0
) -> List[Supplier]:
    query = db.query(Supplier).filter(Supplier.store_id == store_id)
    if is_active is not None:
        query = query.filter(Supplier.is_active == is_active)
    if has_balance is True:
        query = query.filter(Supplier.balance > 0)
    elif has_balance is False:
        query = query.filter(Supplier.balance <= 0)
    if q:
        search = f"%{q.strip()}%"
        query = query.filter(
            (Supplier.name.ilike(search)) |
            (Supplier.phone.ilike(search)) |
            (Supplier.tax_pin.ilike(search))
        )
    if sort_by == "balance_desc":
        query = query.order_by(Supplier.balance.desc(), Supplier.name.asc())
    elif sort_by == "recent":
        query = query.order_by(Supplier.created_at.desc(), Supplier.id.desc())
    else:
        query = query.order_by(Supplier.name.asc())

    if offset:
        query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)
    return query.all()


def calculate_supplier_balance(db: Session, store_id: int, supplier_id: int) -> Decimal:
    """Dynamically compute exact net supplier balance (Total GRN Invoiced - Total Payments)."""
    grns = db.query(GoodsReceivedNote).filter(
        GoodsReceivedNote.store_id == store_id,
        GoodsReceivedNote.supplier_id == supplier_id
    ).all()
    total_invoiced = sum((Decimal(str(g.total_amount or "0.00")) for g in grns), Decimal("0.00"))
    
    payments = db.query(SupplierPayment).filter(
        SupplierPayment.store_id == store_id,
        SupplierPayment.supplier_id == supplier_id
    ).all()
    total_paid = sum((Decimal(str(p.amount or "0.00")) for p in payments), Decimal("0.00"))
    
    return total_invoiced - total_paid


def get_supplier_by_id(db: Session, store_id: int, supplier_id: int) -> Supplier:
    supplier = db.query(Supplier).filter(
        Supplier.id == supplier_id,
        Supplier.store_id == store_id
    ).first()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    
    calc_bal = calculate_supplier_balance(db, store_id, supplier.id)
    if supplier.balance != calc_bal:
        supplier.balance = calc_bal
        db.commit()
        db.refresh(supplier)
    return supplier


def update_supplier(db: Session, store_id: int, supplier_id: int, supplier_in: SupplierUpdate) -> Supplier:
    supplier = get_supplier_by_id(db, store_id, supplier_id)
    update_data = supplier_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if isinstance(val, str):
            val = val.strip()
        setattr(supplier, field, val)
    db.commit()
    db.refresh(supplier)
    return supplier


def record_supplier_payment(db: Session, store_id: int, user_id: int, supplier_id: int, payment_in: SupplierPaymentCreate) -> SupplierPayment:
    supplier = get_supplier_by_id(db, store_id, supplier_id)
    if payment_in.amount <= Decimal("0.00"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment amount must be greater than zero")

    payment = SupplierPayment(
        store_id=store_id,
        supplier_id=supplier_id,
        po_id=payment_in.po_id,
        user_id=user_id,
        amount=payment_in.amount,
        payment_method=payment_in.payment_method,
        reference=payment_in.reference.strip() if payment_in.reference else None,
        notes=payment_in.notes.strip() if payment_in.notes else None
    )
    db.add(payment)

    # Payments to suppliers reduce our outstanding liability/balance
    supplier.balance = Decimal(str(supplier.balance)) - Decimal(str(payment_in.amount))

    db.commit()
    db.refresh(payment)
    return payment


def get_supplier_payment_by_id(db: Session, store_id: int, payment_id: int) -> SupplierPayment:
    payment = db.query(SupplierPayment).filter(
        SupplierPayment.id == payment_id,
        SupplierPayment.store_id == store_id
    ).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier payment not found")
    return payment


def get_supplier_ledger(db: Session, store_id: int, supplier_id: int) -> SupplierLedgerResponse:
    supplier = get_supplier_by_id(db, store_id, supplier_id)

    # 1. Fetch GRNs for this supplier (Goods Received increase payables)
    grns = db.query(GoodsReceivedNote).filter(
        GoodsReceivedNote.store_id == store_id,
        GoodsReceivedNote.supplier_id == supplier_id
    ).all()

    # 2. Fetch Supplier Payments (Payments reduce payables)
    payments = db.query(SupplierPayment).filter(
        SupplierPayment.store_id == store_id,
        SupplierPayment.supplier_id == supplier_id
    ).all()

    total_invoiced = Decimal("0.00")
    total_paid = Decimal("0.00")

    timeline = []
    for g in grns:
        total_invoiced += Decimal(str(g.total_amount or "0.00"))
        
        # Build item summary string
        item_names = []
        for it in g.items:
            if it.product and it.product.name:
                item_names.append(it.product.name)
        
        items_summary = None
        if item_names:
            items_summary = ", ".join(item_names[:3])
            if len(item_names) > 3:
                items_summary += f" (+{len(item_names) - 3} more)"

        timeline.append({
            "id": f"grn-{g.id}",
            "date": g.created_at,
            "type": "grn",
            "reference": g.grn_no + (f" (Inv: {g.invoice_number})" if g.invoice_number else ""),
            "debit": Decimal("0.00"),
            "credit": Decimal(str(g.total_amount)),
            "notes": g.notes or "Goods Received Note",
            "grn_id": g.id,
            "grn_no": g.grn_no,
            "payment_id": None,
            "payment_method": None,
            "po_id": g.po_id,
            "po_no": g.purchase_order.po_no if g.purchase_order else None,
            "items_count": len(g.items),
            "items_summary": items_summary
        })

    for p in payments:
        total_paid += Decimal(str(p.amount or "0.00"))
        timeline.append({
            "id": f"payment-{p.id}",
            "date": p.created_at,
            "type": "payment",
            "reference": f"Payment ({p.payment_method.upper()})" + (f": {p.reference}" if p.reference else ""),
            "debit": Decimal(str(p.amount)),
            "credit": Decimal("0.00"),
            "notes": p.notes or f"Paid via {p.payment_method.upper()}",
            "grn_id": None,
            "grn_no": None,
            "payment_id": p.id,
            "payment_method": p.payment_method,
            "po_id": p.po_id,
            "po_no": None,
            "items_count": None,
            "items_summary": None
        })

    # Sort chronologically
    timeline.sort(key=lambda x: x["date"])

    running_bal = Decimal("0.00")
    entries: List[SupplierLedgerEntry] = []
    for item in timeline:
        running_bal += item["credit"]  # Inbound goods increase liability
        running_bal -= item["debit"]   # Payments decrease liability

        entries.append(SupplierLedgerEntry(
            id=item["id"],
            date=item["date"],
            type=item["type"],
            reference=item["reference"],
            debit=item["debit"],
            credit=item["credit"],
            running_balance=running_bal,
            notes=item["notes"],
            grn_id=item["grn_id"],
            grn_no=item["grn_no"],
            payment_id=item["payment_id"],
            payment_method=item["payment_method"],
            po_id=item["po_id"],
            po_no=item["po_no"],
            items_count=item["items_count"],
            items_summary=item["items_summary"]
        ))

    return SupplierLedgerResponse(
        supplier_id=supplier.id,
        supplier_name=supplier.name,
        contact_person=supplier.contact_person,
        phone=supplier.phone,
        email=supplier.email,
        tax_pin=supplier.tax_pin,
        current_balance=supplier.balance,
        total_invoiced=total_invoiced,
        total_paid=total_paid,
        entries=entries
    )


def delete_supplier(db: Session, store_id: int, supplier_id: int) -> dict:
    supplier = get_supplier_by_id(db, store_id, supplier_id)
    if Decimal(str(supplier.balance)) > Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete supplier with an outstanding payable balance of KES {Decimal(str(supplier.balance)):,.2f}. Please settle payable first."
        )

    # Check for purchase orders, GRNs, or payments
    has_pos = db.query(PurchaseOrder).filter(PurchaseOrder.supplier_id == supplier.id).first() is not None
    has_grns = db.query(GoodsReceivedNote).filter(GoodsReceivedNote.supplier_id == supplier.id).first() is not None
    has_payments = db.query(SupplierPayment).filter(SupplierPayment.supplier_id == supplier.id).first() is not None

    if has_pos or has_grns or has_payments:
        supplier.is_active = False
        db.commit()
        return {"detail": "Supplier has purchase transaction history and has been deactivated."}
    else:
        db.delete(supplier)
        db.commit()
        return {"detail": "Supplier deleted successfully."}


def get_suppliers_summary(db: Session, store_id: int) -> SupplierSummaryResponse:
    total_suppliers = db.query(func.count(Supplier.id)).filter(
        Supplier.store_id == store_id
    ).scalar() or 0

    active_suppliers = db.query(func.count(Supplier.id)).filter(
        Supplier.store_id == store_id,
        Supplier.is_active == True
    ).scalar() or 0

    total_payables_debt = db.query(
        func.coalesce(func.sum(Supplier.balance), Decimal("0.00"))
    ).filter(
        Supplier.store_id == store_id
    ).scalar() or Decimal("0.00")

    suppliers_with_balance = db.query(func.count(Supplier.id)).filter(
        Supplier.store_id == store_id,
        Supplier.balance > Decimal("0.00")
    ).scalar() or 0

    return SupplierSummaryResponse(
        total_suppliers=total_suppliers,
        active_suppliers=active_suppliers,
        total_payables_debt=Decimal(str(total_payables_debt)),
        suppliers_with_balance=suppliers_with_balance
    )


