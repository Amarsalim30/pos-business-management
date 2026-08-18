from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status
from backend.app.models.product import Category, Product
from backend.app.models.inventory import Inventory, StockMovement
from backend.app.schemas.product import CategoryCreate, ProductCreate, ProductUpdate
from backend.app.utils.roll_conversion import format_roll_display


# =========================================================================
# Category Service
# =========================================================================

def list_categories(db: Session, store_id: int) -> List[Category]:
    return db.query(Category).filter(Category.store_id == store_id).order_by(Category.name.asc()).all()


def create_category(db: Session, store_id: int, category_in: CategoryCreate) -> Category:
    category = Category(
        name=category_in.name,
        parent_id=category_in.parent_id,
        store_id=store_id
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, store_id: int, category_id: int) -> bool:
    category = db.query(Category).filter(Category.id == category_id, Category.store_id == store_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    db.delete(category)
    db.commit()
    return True


# =========================================================================
# Product Service
# =========================================================================

def list_products(
    db: Session,
    store_id: int,
    query_str: Optional[str] = None,
    category_id: Optional[int] = None,
    low_stock_only: bool = False,
    is_active: bool = True
) -> List[Tuple[Product, Decimal, str, bool]]:
    query = (
        db.query(Product, Inventory.quantity)
        .outerjoin(Inventory, (Inventory.product_id == Product.id) & (Inventory.store_id == store_id))
        .filter(Product.store_id == store_id, Product.is_active == is_active)
    )

    if query_str:
        search_pattern = f"%{query_str}%"
        query = query.filter(
            or_(
                Product.name.ilike(search_pattern),
                Product.sku.ilike(search_pattern)
            )
        )

    if category_id is not None:
        query = query.filter(Product.category_id == category_id)

    results = query.order_by(Product.name.asc()).all()
    
    enriched = []
    for prod, stock_qty in results:
        current_qty = Decimal(str(stock_qty or "0.00"))
        formatted = format_roll_display(current_qty, prod.meters_per_roll) if prod.unit_type == "roll" else str(current_qty).rstrip("0").rstrip(".")
        is_low = current_qty <= prod.reorder_level
        
        if low_stock_only and not is_low:
            continue
            
        enriched.append((prod, current_qty, formatted, is_low))

    return enriched


def get_product(db: Session, store_id: int, product_id: int) -> Tuple[Product, Decimal, str, bool]:
    prod = db.query(Product).filter(Product.id == product_id, Product.store_id == store_id).first()
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    inv = db.query(Inventory).filter(Inventory.product_id == product_id, Inventory.store_id == store_id).first()
    current_qty = Decimal(str(inv.quantity if inv else "0.00"))
    formatted = format_roll_display(current_qty, prod.meters_per_roll) if prod.unit_type == "roll" else str(current_qty).rstrip("0").rstrip(".")
    is_low = current_qty <= prod.reorder_level
    
    return prod, current_qty, formatted, is_low


def create_product(db: Session, store_id: int, user_id: int, product_in: ProductCreate) -> Tuple[Product, Decimal, str, bool]:
    # Check duplicate SKU within the store only if SKU is provided
    sku_val = (product_in.sku or "").strip() or None
    if sku_val:
        existing = db.query(Product).filter(Product.store_id == store_id, Product.sku == sku_val).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Product with SKU '{sku_val}' already exists")

    # If roll product, default meters_per_roll to 100 if omitted
    meters_per_roll = product_in.meters_per_roll
    if product_in.unit_type == "roll" and not meters_per_roll:
        meters_per_roll = Decimal("100.00")

    product = Product(
        name=product_in.name,
        sku=sku_val,
        category_id=product_in.category_id,
        store_id=store_id,
        unit=product_in.unit,
        unit_type=product_in.unit_type,
        meters_per_roll=meters_per_roll,
        cost_price=product_in.cost_price,
        selling_price=product_in.selling_price,
        price_per_meter=product_in.price_per_meter,
        cost_per_meter=product_in.cost_per_meter,
        reorder_level=product_in.reorder_level,
        is_taxable=product_in.is_taxable,
        tax_rate=product_in.tax_rate,
        is_active=product_in.is_active
    )
    db.add(product)
    db.flush()

    # Initialize inventory
    initial_qty = Decimal(str(product_in.initial_stock or "0.00"))
    inv = Inventory(
        product_id=product.id,
        store_id=store_id,
        quantity=initial_qty
    )
    db.add(inv)
    
    # If initial stock > 0, log movement
    if initial_qty > 0:
        mov = StockMovement(
            product_id=product.id,
            store_id=store_id,
            type="in",
            quantity=initial_qty,
            previous_quantity=Decimal("0.00"),
            new_quantity=initial_qty,
            reference_id="INIT_STOCK",
            note="Initial opening stock",
            user_id=user_id
        )
        db.add(mov)

    db.commit()
    db.refresh(product)

    formatted = format_roll_display(initial_qty, product.meters_per_roll) if product.unit_type == "roll" else str(initial_qty).rstrip("0").rstrip(".")
    is_low = initial_qty <= product.reorder_level

    return product, initial_qty, formatted, is_low


def update_product(db: Session, store_id: int, product_id: int, product_in: ProductUpdate) -> Tuple[Product, Decimal, str, bool]:
    prod, current_qty, _, _ = get_product(db, store_id, product_id)

    if product_in.name is not None:
        prod.name = product_in.name
    if product_in.sku is not None:
        sku_val = product_in.sku.strip() or None
        if sku_val and sku_val != prod.sku:
            existing = db.query(Product).filter(Product.store_id == store_id, Product.sku == sku_val, Product.id != product_id).first()
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Duplicate SKU")
        prod.sku = sku_val
    if product_in.category_id is not None:
        prod.category_id = product_in.category_id
    if product_in.unit is not None:
        prod.unit = product_in.unit
    if product_in.unit_type is not None:
        prod.unit_type = product_in.unit_type
    if product_in.meters_per_roll is not None:
        prod.meters_per_roll = product_in.meters_per_roll
    if product_in.cost_price is not None:
        prod.cost_price = product_in.cost_price
    if product_in.selling_price is not None:
        prod.selling_price = product_in.selling_price
    if product_in.price_per_meter is not None:
        prod.price_per_meter = product_in.price_per_meter
    if product_in.cost_per_meter is not None:
        prod.cost_per_meter = product_in.cost_per_meter
    if product_in.reorder_level is not None:
        prod.reorder_level = product_in.reorder_level
    if product_in.is_taxable is not None:
        prod.is_taxable = product_in.is_taxable
    if product_in.tax_rate is not None:
        prod.tax_rate = product_in.tax_rate
    if product_in.is_active is not None:
        prod.is_active = product_in.is_active

    db.commit()
    db.refresh(prod)

    formatted = format_roll_display(current_qty, prod.meters_per_roll) if prod.unit_type == "roll" else str(current_qty).rstrip("0").rstrip(".")
    is_low = current_qty <= prod.reorder_level

    return prod, current_qty, formatted, is_low


def delete_product(db: Session, store_id: int, product_id: int) -> bool:
    prod = db.query(Product).filter(Product.id == product_id, Product.store_id == store_id).first()
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    prod.is_active = False
    db.commit()
    return True
