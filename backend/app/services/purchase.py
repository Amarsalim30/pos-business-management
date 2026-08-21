from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.purchase import PurchaseOrder, PurchaseItem, PurchaseExpense, GoodsReceivedNote, GoodsReceivedItem
from app.models.supplier import Supplier
from app.models.product import Product
from app.models.inventory import Inventory, StockMovement
from app.schemas.purchase import PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseExpenseCreate, PurchaseExpenseUpdate, GRNCreate, GRNUpdate


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


def update_purchase_order(db: Session, store_id: int, po_id: int, po_update: PurchaseOrderUpdate) -> PurchaseOrder:
    po = get_purchase_order_by_id(db, store_id, po_id)
    if po.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot edit a cancelled purchase order")

    if po_update.supplier_id is not None:
        supplier = db.query(Supplier).filter(Supplier.id == po_update.supplier_id, Supplier.store_id == store_id).first()
        if not supplier:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
        po.supplier_id = po_update.supplier_id

    if po_update.expected_delivery_date is not None:
        po.expected_delivery_date = po_update.expected_delivery_date

    if po_update.is_etr is not None:
        po.is_etr = po_update.is_etr

    if po_update.notes is not None:
        po.notes = po_update.notes.strip() if po_update.notes else None

    if po_update.items is not None:
        if not po_update.items:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Purchase order must contain at least one item")

        # Check existing received quantities to prevent invalid removals or reductions
        existing_received = {it.product_id: it.received_qty for it in po.items if it.received_qty > Decimal("0.00")}
        new_items_by_prod = {it.product_id: it for it in po_update.items}

        for prod_id, rec_qty in existing_received.items():
            if prod_id not in new_items_by_prod:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot remove product ID {prod_id} because {rec_qty} items have already been received via GRN"
                )
            if new_items_by_prod[prod_id].ordered_qty < rec_qty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ordered quantity for product ID {prod_id} cannot be less than already received quantity ({rec_qty})"
                )

        subtotal = Decimal("0.00")
        new_items = []
        for it in po_update.items:
            product = db.query(Product).filter(Product.id == it.product_id, Product.store_id == store_id).first()
            if not product:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with ID {it.product_id} not found")

            if it.ordered_qty <= Decimal("0.00"):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ordered quantity must be greater than zero")
            if it.unit_cost <= Decimal("0.00"):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unit cost must be greater than zero")

            line_total = it.ordered_qty * it.unit_cost
            subtotal += line_total
            rec_qty = existing_received.get(it.product_id, Decimal("0.00"))

            new_items.append(PurchaseItem(
                po_id=po_id,
                product_id=it.product_id,
                unit_type=it.unit_type or product.unit_type,
                ordered_qty=it.ordered_qty,
                received_qty=rec_qty,
                unit_cost=it.unit_cost,
                total_cost=line_total
            ))

        po.items.clear()
        po.items.extend(new_items)
        po.subtotal = subtotal
        po.tax_amount = Decimal("0.00")
        po.total_amount = subtotal + po.tax_amount

        # Re-evaluate PO status
        all_received = all(it.received_qty >= it.ordered_qty for it in new_items)
        any_received = any(it.received_qty > Decimal("0.00") for it in new_items)
        po.status = "received" if all_received else ("partial" if any_received else "ordered")

    db.commit()
    db.refresh(po)
    return po


def delete_purchase_order(db: Session, store_id: int, po_id: int) -> bool:
    po = get_purchase_order_by_id(db, store_id, po_id)

    any_received = any(it.received_qty > Decimal("0.00") for it in po.items)
    grn_count = db.query(GoodsReceivedNote).filter(GoodsReceivedNote.po_id == po_id).count()
    if any_received or grn_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete Purchase Order with received goods. Please delete the associated Goods Received Notes (GRNs) first."
        )

    # With cascade="all, delete-orphan", deleting po deletes items and expenses cleanly
    db.delete(po)
    db.commit()
    return True


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

    desc = expense_in.description.strip() if expense_in.description else f"Purchase expense ({expense_in.category})"

    expense = PurchaseExpense(
        po_id=po_id,
        store_id=store_id,
        user_id=user_id,
        category=expense_in.category,
        description=desc,
        amount=expense_in.amount,
        payment_method=expense_in.payment_method,
        reference=expense_in.reference.strip() if expense_in.reference else None
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


def add_grn_expense(db: Session, store_id: int, user_id: int, grn_id: int, expense_in: PurchaseExpenseCreate) -> PurchaseExpense:
    grn = get_grn_by_id(db, store_id, grn_id)

    if expense_in.amount <= Decimal("0.00"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Expense amount must be greater than zero")

    desc = expense_in.description.strip() if expense_in.description else f"GRN landed expense ({expense_in.category})"

    expense = PurchaseExpense(
        grn_id=grn.id,
        po_id=grn.po_id,
        store_id=store_id,
        user_id=user_id,
        category=expense_in.category,
        description=desc,
        amount=expense_in.amount,
        payment_method=expense_in.payment_method,
        reference=expense_in.reference.strip() if expense_in.reference else None
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


def update_purchase_expense(db: Session, store_id: int, expense_id: int, expense_in: PurchaseExpenseUpdate) -> PurchaseExpense:
    expense = db.query(PurchaseExpense).filter(
        PurchaseExpense.id == expense_id,
        PurchaseExpense.store_id == store_id
    ).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase expense not found")

    if expense_in.amount is not None:
        if expense_in.amount <= Decimal("0.00"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Expense amount must be greater than zero")
        expense.amount = expense_in.amount

    if expense_in.category is not None:
        expense.category = expense_in.category
    if expense_in.description is not None:
        expense.description = expense_in.description.strip() or expense.description
    if expense_in.payment_method is not None:
        expense.payment_method = expense_in.payment_method
    if expense_in.reference is not None:
        expense.reference = expense_in.reference.strip() if expense_in.reference else None

    db.commit()
    db.refresh(expense)
    return expense


def delete_purchase_expense(db: Session, store_id: int, expense_id: int) -> bool:
    expense = db.query(PurchaseExpense).filter(
        PurchaseExpense.id == expense_id,
        PurchaseExpense.store_id == store_id
    ).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase expense not found")

    db.delete(expense)
    db.commit()
    return True


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

    # Persist initial landed expenses if provided
    if getattr(grn_in, 'expenses', None):
        for exp_in in grn_in.expenses:
            if exp_in.amount and exp_in.amount > Decimal("0.00"):
                desc = exp_in.description.strip() if exp_in.description else f"GRN landed expense ({exp_in.category})"
                db.add(PurchaseExpense(
                    grn_id=grn.id,
                    po_id=grn.po_id,
                    store_id=store_id,
                    user_id=user_id,
                    category=exp_in.category,
                    description=desc,
                    amount=exp_in.amount,
                    payment_method=exp_in.payment_method,
                    reference=exp_in.reference.strip() if exp_in.reference else None
                ))

    db.commit()
    db.refresh(grn)
    return grn


def update_goods_received_note(
    db: Session,
    store_id: int,
    user_id: int,
    grn_id: int,
    grn_update: GRNUpdate
) -> GoodsReceivedNote:
    grn = get_grn_by_id(db, store_id, grn_id)
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == grn.po_id, PurchaseOrder.store_id == store_id).first() if grn.po_id else None
    supplier = db.query(Supplier).filter(Supplier.id == grn.supplier_id, Supplier.store_id == store_id).first() if grn.supplier_id else None

    if grn_update.invoice_number is not None:
        grn.invoice_number = grn_update.invoice_number.strip() if grn_update.invoice_number else None

    if grn_update.notes is not None:
        grn.notes = grn_update.notes.strip() if grn_update.notes else None

    if grn_update.items is not None:
        if not grn_update.items:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GRN must contain at least one item")

        old_items_map = {it.product_id: it for it in grn.items}
        all_prod_ids = sorted(list(set(list(old_items_map.keys()) + [it.product_id for it in grn_update.items])))

        locked_inventories = {
            inv.product_id: inv
            for inv in db.query(Inventory).filter(
                Inventory.store_id == store_id,
                Inventory.product_id.in_(all_prod_ids)
            ).with_for_update().all()
        }

        parsed_new_items = []
        total_new_amount = Decimal("0.00")

        for it in grn_update.items:
            product = db.query(Product).filter(Product.id == it.product_id, Product.store_id == store_id).first()
            if not product:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {it.product_id} not found")

            qty_received = it.quantity_received
            if qty_received is None or qty_received <= Decimal("0.00"):
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

            total_new_amount += line_total
            parsed_new_items.append((it, product, qty_received, line_total))

        # Calculate per-product new quantities
        new_prod_qty_map = {}
        for it, prod, q, lt in parsed_new_items:
            new_prod_qty_map[it.product_id] = new_prod_qty_map.get(it.product_id, Decimal("0.00")) + q

        # Apply stock deltas
        for prod_id in all_prod_ids:
            old_q = sum((it.quantity_received for it in grn.items if it.product_id == prod_id), Decimal("0.00"))
            new_q = new_prod_qty_map.get(prod_id, Decimal("0.00"))
            delta_q = new_q - old_q

            if delta_q != Decimal("0.00"):
                inv = locked_inventories.get(prod_id)
                if not inv:
                    inv = Inventory(product_id=prod_id, store_id=store_id, quantity=Decimal("0.00"))
                    db.add(inv)
                    db.flush()
                    locked_inventories[prod_id] = inv

                prev_qty = Decimal(str(inv.quantity or "0.00"))
                updated_qty = prev_qty + delta_q
                if updated_qty < Decimal("0.00"):
                    prod_obj = db.query(Product).filter(Product.id == prod_id).first()
                    p_name = prod_obj.name if prod_obj else f"ID {prod_id}"
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot reduce GRN quantity for '{p_name}' by {abs(delta_q)}: available stock would drop below zero (currently {prev_qty})"
                    )

                inv.quantity = updated_qty
                inv.last_updated = datetime.now(timezone.utc)

                product_obj = db.query(Product).filter(Product.id == prod_id).first()
                unit_sold = "meter" if product_obj and product_obj.unit_type == "roll" else "piece"
                mov_type = "in" if delta_q > 0 else "out"

                db.add(StockMovement(
                    product_id=prod_id,
                    store_id=store_id,
                    type=mov_type,
                    quantity=abs(delta_q),
                    unit_sold=unit_sold,
                    previous_quantity=prev_qty,
                    new_quantity=updated_qty,
                    reference_id=grn.grn_no,
                    note=f"GRN update adjustment ({grn.grn_no})",
                    user_id=user_id
                ))

                if po:
                    p_item = next((pi for pi in po.items if pi.product_id == prod_id), None)
                    if p_item:
                        p_item.received_qty = max(Decimal("0.00"), p_item.received_qty + delta_q)

        # Adjust supplier balance
        delta_total = total_new_amount - grn.total_amount
        if supplier and delta_total != Decimal("0.00"):
            supplier.balance = max(Decimal("0.00"), supplier.balance + delta_total)

        # Replace GRN items using relationship collection
        new_grn_items = []
        for it, product, qty_received, line_total in parsed_new_items:
            # Update product buying cost price if provided
            if it.unit_cost is not None and it.unit_cost > 0:
                product.cost_price = it.unit_cost
                if product.unit_type == "roll" and product.meters_per_roll:
                    product.cost_per_meter = Decimal(str(it.unit_cost)) / product.meters_per_roll

            new_grn_items.append(GoodsReceivedItem(
                grn_id=grn.id,
                product_id=it.product_id,
                unit_type=it.unit_type or product.unit_type,
                quantity_received=qty_received,
                rolls_received=it.rolls_received or 0,
                loose_meters_received=it.loose_meters_received or Decimal("0.00"),
                unit_cost=it.unit_cost,
                total_cost=line_total
            ))

        grn.items.clear()
        grn.items.extend(new_grn_items)
        grn.total_amount = total_new_amount

        # Re-evaluate PO status if linked
        if po:
            all_fully_received = all(p_it.received_qty >= p_it.ordered_qty for p_it in po.items)
            any_received = any(p_it.received_qty > Decimal("0.00") for p_it in po.items)
            po.status = "received" if all_fully_received else ("partial" if any_received else "ordered")

    db.commit()
    db.refresh(grn)
    return grn


def delete_goods_received_note(
    db: Session,
    store_id: int,
    user_id: int,
    grn_id: int
) -> bool:
    grn = get_grn_by_id(db, store_id, grn_id)
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == grn.po_id, PurchaseOrder.store_id == store_id).first() if grn.po_id else None
    supplier = db.query(Supplier).filter(Supplier.id == grn.supplier_id, Supplier.store_id == store_id).first() if grn.supplier_id else None

    sorted_prod_ids = sorted(list(set(it.product_id for it in grn.items)))
    locked_inventories = {
        inv.product_id: inv
        for inv in db.query(Inventory).filter(
            Inventory.store_id == store_id,
            Inventory.product_id.in_(sorted_prod_ids)
        ).with_for_update().all()
    }

    # Reverse physical stock and PO items
    for it in grn.items:
        inv = locked_inventories.get(it.product_id)
        if inv:
            prev_qty = Decimal(str(inv.quantity or "0.00"))
            new_qty = max(Decimal("0.00"), prev_qty - it.quantity_received)
            inv.quantity = new_qty
            inv.last_updated = datetime.now(timezone.utc)

            prod_obj = db.query(Product).filter(Product.id == it.product_id).first()
            unit_sold = "meter" if prod_obj and prod_obj.unit_type == "roll" else "piece"

            db.add(StockMovement(
                product_id=it.product_id,
                store_id=store_id,
                type="out",
                quantity=it.quantity_received,
                unit_sold=unit_sold,
                previous_quantity=prev_qty,
                new_quantity=new_qty,
                reference_id=grn.grn_no,
                note=f"GRN deletion stock reversal ({grn.grn_no})",
                user_id=user_id
            ))

        if po:
            matching_po_item = next((p_it for p_it in po.items if p_it.product_id == it.product_id), None)
            if matching_po_item:
                matching_po_item.received_qty = max(Decimal("0.00"), matching_po_item.received_qty - it.quantity_received)

    if po:
        all_fully_received = all(p_it.received_qty >= p_it.ordered_qty for p_it in po.items)
        any_received = any(p_it.received_qty > Decimal("0.00") for p_it in po.items)
        po.status = "received" if all_fully_received else ("partial" if any_received else "ordered")

    if supplier:
        supplier.balance = max(Decimal("0.00"), supplier.balance - grn.total_amount)

    db.delete(grn)
    db.commit()
    return True


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


def get_grn_by_id_or_no(db: Session, store_id: int, identifier: str) -> GoodsReceivedNote:
    query = db.query(GoodsReceivedNote).filter(GoodsReceivedNote.store_id == store_id)
    if identifier.isdigit():
        grn = query.filter((GoodsReceivedNote.id == int(identifier)) | (GoodsReceivedNote.grn_no == identifier)).first()
    else:
        grn = query.filter(GoodsReceivedNote.grn_no == identifier).first()
    if not grn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Goods Received Note '{identifier}' not found")
    return grn
