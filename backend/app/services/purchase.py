from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.purchase import PurchaseOrder, PurchaseItem, PurchaseExpense, GoodsReceivedNote, GoodsReceivedItem
from app.models.supplier import Supplier
from app.models.product import Product
from app.models.inventory import Inventory, StockMovement
from app.schemas.purchase import PurchaseOrderCreate, PurchaseExpenseCreate, GRNCreate


def _generate_po_number(db: Session, store_id: int) -> str:
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = db.query(PurchaseOrder).filter(
        PurchaseOrder.store_id == store_id,
        PurchaseOrder.po_no.like(f"PO-{today_str}-%")
    ).count() + 1
    return f"PO-{today_str}-{count:04d}"


def _generate_grn_number(db: Session, store_id: int) -> str:
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = db.query(GoodsReceivedNote).filter(
        GoodsReceivedNote.store_id == store_id,
        GoodsReceivedNote.grn_no.like(f"GRN-{today_str}-%")
    ).count() + 1
    return f"GRN-{today_str}-{count:04d}"


def create_purchase_order(db: Session, store_id: int, user_id: int, po_in: PurchaseOrderCreate) -> PurchaseOrder:
    if not po_in.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Purchase order must contain at least one item")

    supplier = db.query(Supplier).filter(Supplier.id == po_in.supplier_id, Supplier.store_id == store_id).first()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    subtotal = Decimal("0.00")
    items_to_create = []

    for it in po_in.items:
        product = db.query(Product).filter(Product.id == it.product_id, Product.store_id == store_id).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with ID {it.product_id} not found")

        if it.ordered_qty <= Decimal("0.00"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ordered quantity must be greater than zero")
        if it.unit_cost <= Decimal("0.00"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unit cost must be greater than zero")

        line_total = it.ordered_qty * it.unit_cost
        subtotal += line_total

        items_to_create.append(PurchaseItem(
            product_id=it.product_id,
            unit_type=it.unit_type or product.unit_type,
            ordered_qty=it.ordered_qty,
            received_qty=Decimal("0.00"),
            unit_cost=it.unit_cost,
            total_cost=line_total
        ))

    tax_amount = Decimal("0.00")
    total_amount = subtotal + tax_amount

    po = PurchaseOrder(
        store_id=store_id,
        po_no=_generate_po_number(db, store_id),
        supplier_id=po_in.supplier_id,
        user_id=user_id,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total_amount=total_amount,
        status="ordered",
        is_etr=po_in.is_etr,
        notes=po_in.notes.strip() if po_in.notes else None,
        expected_delivery_date=po_in.expected_delivery_date,
        items=items_to_create
    )
    db.add(po)
    db.commit()
    db.refresh(po)
    return po


def list_purchase_orders(
    db: Session,
    store_id: int,
    supplier_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    is_etr: Optional[bool] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0
) -> List[PurchaseOrder]:
    query = db.query(PurchaseOrder).filter(PurchaseOrder.store_id == store_id)

    if supplier_id:
        query = query.filter(PurchaseOrder.supplier_id == supplier_id)
    if status_filter and status_filter != "all":
        query = query.filter(PurchaseOrder.status == status_filter)
    if is_etr is not None:
        query = query.filter(PurchaseOrder.is_etr == is_etr)
    if date_from:
        query = query.filter(PurchaseOrder.created_at >= date_from)
    if date_to:
        query = query.filter(PurchaseOrder.created_at <= date_to)

    return query.order_by(PurchaseOrder.created_at.desc()).offset(offset).limit(limit).all()


def get_purchase_order_by_id(db: Session, store_id: int, po_id: int) -> PurchaseOrder:
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id, PurchaseOrder.store_id == store_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    return po


def add_purchase_expense(db: Session, store_id: int, user_id: int, po_id: int, expense_in: PurchaseExpenseCreate) -> PurchaseExpense:
    po = get_purchase_order_by_id(db, store_id, po_id)
    if po.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot add expenses to a cancelled purchase order")

    if expense_in.amount <= Decimal("0.00"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Expense amount must be greater than zero")

    expense = PurchaseExpense(
        po_id=po_id,
        store_id=store_id,
        user_id=user_id,
        category=expense_in.category,
        description=expense_in.description.strip(),
        amount=expense_in.amount,
        payment_method=expense_in.payment_method,
        reference=expense_in.reference.strip() if expense_in.reference else None
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


def cancel_purchase_order(db: Session, store_id: int, po_id: int) -> PurchaseOrder:
    po = get_purchase_order_by_id(db, store_id, po_id)
    if po.status == "cancelled":
        return po

    # Guardrail: If any items have already been received, prevent cancellation
    any_received = any(item.received_qty > Decimal("0.00") for item in po.items)
    if any_received:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot cancel a purchase order that has already received inventory via GRN")

    po.status = "cancelled"
    po.cancelled_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(po)
    return po


def receive_goods_grn(db: Session, store_id: int, user_id: int, grn_in: GRNCreate) -> GoodsReceivedNote:
    if not grn_in.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GRN must contain at least one item")

    po = None
    if grn_in.po_id:
        po = get_purchase_order_by_id(db, store_id, grn_in.po_id)
        if po.status == "cancelled":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot receive goods against a cancelled purchase order")

    supplier_id = grn_in.supplier_id or (po.supplier_id if po else None)
    supplier = None
    if supplier_id:
        supplier = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.store_id == store_id).first()

    # Sort product IDs to prevent deadlocks during inventory row locking
    sorted_product_ids = sorted(list(set(it.product_id for it in grn_in.items)))
    locked_inventories = {
        inv.product_id: inv
        for inv in db.query(Inventory).filter(
            Inventory.store_id == store_id,
            Inventory.product_id.in_(sorted_product_ids)
        ).with_for_update().all()
    }

    grn_items = []
    stock_movements = []
    total_grn_amount = Decimal("0.00")

    for it in grn_in.items:
        product = db.query(Product).filter(Product.id == it.product_id, Product.store_id == store_id).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {it.product_id} not found")

        qty_received = it.quantity_received
        if (qty_received is None or qty_received <= Decimal("0.00")):
            if product.unit_type == "roll":
                from app.services.inventory import roll_count_to_meters
                qty_received = roll_count_to_meters(it.rolls_received or 0, it.loose_meters_received or Decimal("0.00"), product.meters_per_roll)
            elif it.rolls_received:
                qty_received = Decimal(str(it.rolls_received))

        if not qty_received or qty_received <= Decimal("0.00"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Quantity received for '{product.name}' must be greater than zero")

        if product.unit_type == "roll" and product.meters_per_roll and product.meters_per_roll > 0:
            line_total = (qty_received / product.meters_per_roll) * it.unit_cost
        else:
            line_total = qty_received * it.unit_cost
        total_grn_amount += line_total

        # 1. Update/create physical stock in Inventory
        inv = locked_inventories.get(it.product_id)
        if not inv:
            inv = Inventory(
                product_id=it.product_id,
                store_id=store_id,
                quantity=Decimal("0.00")
            )
            db.add(inv)
            db.flush()
            locked_inventories[it.product_id] = inv

        prev_qty = Decimal(str(inv.quantity or "0.00"))
        new_qty = prev_qty + qty_received
        inv.quantity = new_qty
        inv.last_updated = datetime.now(timezone.utc)

        # Update product buying cost price if provided
        if it.unit_cost is not None and it.unit_cost > 0:
            product.cost_price = it.unit_cost
            if product.unit_type == "roll" and product.meters_per_roll:
                product.cost_per_meter = Decimal(str(it.unit_cost)) / product.meters_per_roll

        # 2. Add GRN Item
        grn_items.append(GoodsReceivedItem(
            product_id=it.product_id,
            unit_type=it.unit_type or product.unit_type,
            quantity_received=qty_received,
            rolls_received=it.rolls_received or 0,
            loose_meters_received=it.loose_meters_received or Decimal("0.00"),
            unit_cost=it.unit_cost,
            total_cost=line_total
        ))

        # 3. If linked to a PO, update the matching PurchaseItem.received_qty
        if po:
            matching_po_item = next((p_it for p_it in po.items if p_it.product_id == it.product_id), None)
            if matching_po_item:
                matching_po_item.received_qty += qty_received

        stock_movements.append({
            "product_id": it.product_id,
            "quantity": qty_received,
            "unit_sold": "meter" if product.unit_type == "roll" else "piece",
            "previous_quantity": prev_qty,
            "new_quantity": new_qty
        })

    # Create GRN Header
    grn = GoodsReceivedNote(
        store_id=store_id,
        grn_no=_generate_grn_number(db, store_id),
        po_id=grn_in.po_id,
        supplier_id=supplier_id,
        user_id=user_id,
        invoice_number=grn_in.invoice_number.strip() if grn_in.invoice_number else None,
        delivery_date=datetime.now(timezone.utc),
        total_amount=total_grn_amount,
        notes=grn_in.notes.strip() if grn_in.notes else None,
        items=grn_items
    )
    db.add(grn)
    db.flush()

    # Log Stock Movements with enriched notes
    supplier_label = f" | Supplier: {supplier.name}" if supplier else ""
    inv_label = f" (Inv/DN: {grn.invoice_number})" if grn.invoice_number else ""
    note_label = f" | {grn.notes}" if grn.notes else ""
    for mov_data in stock_movements:
        db.add(StockMovement(
            product_id=mov_data["product_id"],
            store_id=store_id,
            type="in",
            quantity=mov_data["quantity"],
            unit_sold=mov_data["unit_sold"],
            previous_quantity=mov_data["previous_quantity"],
            new_quantity=mov_data["new_quantity"],
            reference_id=grn.grn_no,
            note=f"Inbound GRN receipt ({grn.grn_no}){inv_label}{supplier_label}{note_label}",
            user_id=user_id
        ))

    # Update PO status if all items are fully received
    if po:
        all_fully_received = all(p_it.received_qty >= p_it.ordered_qty for p_it in po.items)
        po.status = "received" if all_fully_received else "partial"

    # Increase supplier liability balance
    if supplier:
        supplier.balance += total_grn_amount

    db.commit()
    db.refresh(grn)
    return grn


def list_goods_received_notes(
    db: Session,
    store_id: int,
    po_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0
) -> List[GoodsReceivedNote]:
    query = db.query(GoodsReceivedNote).filter(GoodsReceivedNote.store_id == store_id)
    if po_id:
        query = query.filter(GoodsReceivedNote.po_id == po_id)
    if supplier_id:
        query = query.filter(GoodsReceivedNote.supplier_id == supplier_id)
    return query.order_by(GoodsReceivedNote.created_at.desc()).offset(offset).limit(limit).all()


def get_grn_by_id(db: Session, store_id: int, grn_id: int) -> GoodsReceivedNote:
    grn = db.query(GoodsReceivedNote).filter(GoodsReceivedNote.id == grn_id, GoodsReceivedNote.store_id == store_id).first()
    if not grn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods Received Note not found")
    return grn
