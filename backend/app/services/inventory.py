from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.product import Product
from app.models.inventory import Inventory, StockMovement, StockTake, StockTakeItem
from app.schemas.inventory import StockAdjustmentCreate, StockTakeItemCreate, InventoryItemResponse
from app.utils.roll_conversion import format_roll_display, roll_count_to_meters


# =========================================================================
# Inventory Queries & Deductions
# =========================================================================

def list_inventory(
    db: Session,
    store_id: int,
    low_stock_only: bool = False
) -> List[InventoryItemResponse]:
    query = (
        db.query(Product, Inventory)
        .join(Inventory, (Inventory.product_id == Product.id) & (Inventory.store_id == store_id))
        .filter(Product.store_id == store_id, Product.is_active == True)
    )

    results = query.order_by(Product.name.asc()).all()
    items = []
    for prod, inv in results:
        qty = Decimal(str(inv.quantity or "0.00"))
        is_low = qty <= prod.reorder_level
        if low_stock_only and not is_low:
            continue
        
        formatted = format_roll_display(qty, prod.meters_per_roll) if prod.unit_type == "roll" else str(qty).rstrip("0").rstrip(".")
        items.append(
            InventoryItemResponse(
                product_id=prod.id,
                product_name=prod.name,
                sku=prod.sku,
                unit=prod.unit,
                unit_type=prod.unit_type,
                meters_per_roll=prod.meters_per_roll,
                cost_price=prod.cost_price,
                selling_price=prod.selling_price,
                reorder_level=prod.reorder_level,
                quantity=qty,
                formatted_stock=formatted,
                is_low_stock=is_low,
                last_updated=inv.last_updated
            )
        )
    return items


def deduct_stock(
    db: Session,
    store_id: int,
    user_id: int,
    product_id: int,
    quantity: Decimal,
    unit_sold: str = "piece",  # 'piece', 'roll', 'meter'
    movement_type: str = "sale",
    reference_id: Optional[str] = None,
    note: Optional[str] = None
) -> Tuple[Decimal, Decimal]:
    """
    Concurrency-safe deduction using SELECT ... FOR UPDATE.
    Auto-converts roll units to decimal meters.
    Returns: (previous_quantity, new_quantity)
    """
    # 1. Fetch Product
    prod = db.query(Product).filter(Product.id == product_id, Product.store_id == store_id).first()
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    # 2. Convert quantity to base decimal units
    base_deduction = Decimal(str(quantity))
    if prod.unit_type == "roll":
        if unit_sold == "roll":
            mpr = prod.meters_per_roll or Decimal("100.00")
            base_deduction = Decimal(str(quantity)) * mpr
        # if unit_sold == 'meter', base_deduction is already in meters

    # 3. Lock Inventory Row
    inv = (
        db.query(Inventory)
        .filter(Inventory.product_id == product_id, Inventory.store_id == store_id)
        .with_for_update()
        .first()
    )

    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory record not found")

    prev_qty = Decimal(str(inv.quantity))
    if prev_qty < base_deduction:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock for '{prod.name}'. Requested: {base_deduction:.1f}, Available: {prev_qty:.1f}"
        )

    new_qty = prev_qty - base_deduction
    inv.quantity = new_qty
    inv.last_updated = datetime.utcnow()

    # 4. Record Movement
    mov = StockMovement(
        product_id=product_id,
        store_id=store_id,
        type=movement_type,
        quantity=-base_deduction,
        unit_sold=unit_sold,
        previous_quantity=prev_qty,
        new_quantity=new_qty,
        reference_id=reference_id,
        note=note,
        user_id=user_id
    )
    db.add(mov)
    db.commit()
    db.refresh(inv)

    return prev_qty, new_qty


def adjust_stock(
    db: Session,
    store_id: int,
    user_id: int,
    adj_in: StockAdjustmentCreate
) -> Tuple[Decimal, Decimal]:
    """Manual adjustment with signed quantity."""
    prod = db.query(Product).filter(Product.id == adj_in.product_id, Product.store_id == store_id).first()
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    inv = (
        db.query(Inventory)
        .filter(Inventory.product_id == adj_in.product_id, Inventory.store_id == store_id)
        .with_for_update()
        .first()
    )

    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory record not found")

    prev_qty = Decimal(str(inv.quantity))
    delta = Decimal(str(adj_in.adjusted_quantity))
    new_qty = prev_qty + delta

    if new_qty < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock cannot be adjusted below zero. Current: {prev_qty}, Delta: {delta}"
        )

    inv.quantity = new_qty
    inv.last_updated = datetime.utcnow()

    mov = StockMovement(
        product_id=prod.id,
        store_id=store_id,
        type="adjust",
        quantity=delta,
        unit_sold="meter" if prod.unit_type == "roll" else "piece",
        previous_quantity=prev_qty,
        new_quantity=new_qty,
        reference_id="MANUAL_ADJUST",
        note=adj_in.note,
        user_id=user_id
    )
    db.add(mov)
    db.commit()
    db.refresh(inv)

    return prev_qty, new_qty


def list_stock_movements(
    db: Session,
    store_id: int,
    product_id: Optional[int] = None,
    limit: int = 50
) -> List[StockMovement]:
    query = db.query(StockMovement).filter(StockMovement.store_id == store_id)
    if product_id is not None:
        query = query.filter(StockMovement.product_id == product_id)
    return query.order_by(StockMovement.created_at.desc()).limit(limit).all()


# =========================================================================
# Stock Take & Variance Auditor
# =========================================================================

def start_stock_take(db: Session, store_id: int, user_id: int, notes: Optional[str] = None) -> StockTake:
    # Check if there is already an in-progress stock take
    existing = db.query(StockTake).filter(StockTake.store_id == store_id, StockTake.status == "in_progress").first()
    if existing:
        return existing

    stock_take = StockTake(
        store_id=store_id,
        user_id=user_id,
        status="in_progress",
        notes=notes
    )
    db.add(stock_take)
    db.flush()

    # Snapshot all active products and their current quantities
    products = (
        db.query(Product, Inventory.quantity)
        .outerjoin(Inventory, (Inventory.product_id == Product.id) & (Inventory.store_id == store_id))
        .filter(Product.store_id == store_id, Product.is_active == True)
        .all()
    )

    for prod, expected_qty in products:
        exp = Decimal(str(expected_qty or "0.00"))
        item = StockTakeItem(
            stock_take_id=stock_take.id,
            product_id=prod.id,
            expected_quantity=exp,
            counted_quantity=exp,  # default to expected until counted
            variance=Decimal("0.00"),
            rolls_counted=None,
            loose_meters_counted=None
        )
        db.add(item)

    db.commit()
    db.refresh(stock_take)
    return stock_take


def get_stock_take(db: Session, store_id: int, stock_take_id: int) -> StockTake:
    st = db.query(StockTake).filter(StockTake.id == stock_take_id, StockTake.store_id == store_id).first()
    if not st:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock take not found")
    return st


def record_stock_take_count(
    db: Session,
    store_id: int,
    stock_take_id: int,
    item_count: StockTakeItemCreate
) -> StockTakeItem:
    st = get_stock_take(db, store_id, stock_take_id)
    if st.status != "in_progress":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stock take is closed or cancelled")

    item = db.query(StockTakeItem).filter(
        StockTakeItem.stock_take_id == stock_take_id,
        StockTakeItem.product_id == item_count.product_id
    ).first()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not in stock take")

    prod = db.query(Product).filter(Product.id == item_count.product_id).first()
    
    # Calculate counted quantity
    if item_count.counted_quantity is not None:
        total_counted = Decimal(str(item_count.counted_quantity))
        item.counted_quantity = total_counted
        item.rolls_counted = item_count.rolls_counted
        item.loose_meters_counted = item_count.loose_meters_counted
    elif prod and prod.unit_type == "roll" and (item_count.rolls_counted is not None or item_count.loose_meters_counted is not None):
        rolls = item_count.rolls_counted or 0
        loose = Decimal(str(item_count.loose_meters_counted or "0.00"))
        mpr = prod.meters_per_roll or Decimal("100.00")
        total_counted = roll_count_to_meters(rolls, loose, mpr)
        item.counted_quantity = total_counted
        item.rolls_counted = rolls
        item.loose_meters_counted = loose
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing count quantity")

    item.variance = item.counted_quantity - item.expected_quantity
    db.commit()
    db.refresh(item)
    return item


def reconcile_stock_take(db: Session, store_id: int, user_id: int, stock_take_id: int) -> StockTake:
    st = get_stock_take(db, store_id, stock_take_id)
    if st.status != "in_progress":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stock take is not in progress")

    for item in st.items:
        if item.variance != 0:
            # Adjust inventory to matched counted quantity
            inv = db.query(Inventory).filter(Inventory.product_id == item.product_id, Inventory.store_id == store_id).with_for_update().first()
            if inv:
                prev_qty = inv.quantity
                inv.quantity = item.counted_quantity
                inv.last_updated = datetime.utcnow()

                mov = StockMovement(
                    product_id=item.product_id,
                    store_id=store_id,
                    type="stock_take",
                    quantity=item.variance,
                    previous_quantity=prev_qty,
                    new_quantity=item.counted_quantity,
                    reference_id=f"STOCK_TAKE_{st.id}",
                    note=f"Reconciliation variance: {item.variance:+f}",
                    user_id=user_id
                )
                db.add(mov)

    st.status = "completed"
    st.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(st)
    return st
