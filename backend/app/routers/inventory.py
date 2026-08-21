from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.inventory import (
    InventoryItemResponse,
    StockAdjustmentCreate,
    StockReceiveCreate,
    BatchStockReceiveCreate,
    StockMovementResponse,
    StockTakeCreate,
    StockTakeItemCreate,
    StockTakeResponse,
    StockTakeItemResponse,
    StockTakeSummaryResponse,
    StockTakeItemsPaginatedResponse
)
from app.services import inventory as inventory_service
from app.dependencies import get_current_user, require_permission
from app.models.user import User

inventory_router = APIRouter(prefix="/inventory", tags=["inventory"])
stock_takes_router = APIRouter(prefix="/stock-takes", tags=["stock-takes"])


# =========================================================================
# Inventory Endpoints
# =========================================================================

@inventory_router.get("/", response_model=List[InventoryItemResponse])
def get_inventory(
    low_stock_only: bool = False,
    limit: Optional[int] = None,
    offset: int = 0,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view"))
):
    target_store_id = store_id or current_user.store_id or 1
    return inventory_service.list_inventory(db, target_store_id, low_stock_only=low_stock_only, limit=limit, offset=offset)


@inventory_router.post("/adjust", status_code=status.HTTP_200_OK)
def post_stock_adjustment(
    adj_in: StockAdjustmentCreate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:adjust"))
):
    target_store_id = store_id or current_user.store_id or 1
    prev_qty, new_qty = inventory_service.adjust_stock(db, target_store_id, current_user.id, adj_in)
    return {
        "message": "Stock adjusted successfully",
        "previous_quantity": prev_qty,
        "new_quantity": new_qty
    }


@inventory_router.post("/receive", status_code=status.HTTP_200_OK)
def post_stock_receive(
    rec_in: StockReceiveCreate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchases:receive_grn"))
):
    target_store_id = store_id or current_user.store_id or 1
    prev_qty, received_qty, new_qty = inventory_service.receive_stock(db, target_store_id, current_user.id, rec_in)
    return {
        "message": "Stock received successfully",
        "previous_quantity": prev_qty,
        "received_quantity": received_qty,
        "new_quantity": new_qty
    }


@inventory_router.post("/receive-batch", status_code=status.HTTP_200_OK)
def post_batch_stock_receive(
    batch_in: BatchStockReceiveCreate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchases:receive_grn"))
):
    target_store_id = store_id or current_user.store_id or 1
    results = inventory_service.receive_batch_stock(db, target_store_id, current_user.id, batch_in)
    return {
        "message": f"Successfully received {len(results)} items into inventory",
        "items": results
    }


@inventory_router.get("/movements", response_model=List[StockMovementResponse])
def get_stock_movements(
    product_id: Optional[int] = None,
    limit: Optional[int] = 50,
    offset: int = 0,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view"))
):
    target_store_id = store_id or current_user.store_id or 1
    movements = inventory_service.list_stock_movements(db, target_store_id, product_id=product_id, limit=limit, offset=offset)
    res = []
    for m in movements:
        item = StockMovementResponse.model_validate(m)
        if m.product:
            item.product_name = m.product.name
            item.sku = m.product.sku
        res.append(item)
    return res


# =========================================================================
# Stock Take Endpoints (Scaled for 10,000+ Products)
# =========================================================================

@stock_takes_router.get("/", response_model=List[StockTakeSummaryResponse])
def get_stock_takes(
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:stock_take"))
):
    target_store_id = store_id or current_user.store_id or 1
    return inventory_service.list_stock_takes(db, target_store_id)


@stock_takes_router.post("/", response_model=StockTakeSummaryResponse, status_code=status.HTTP_201_CREATED)
def post_stock_take(
    st_in: StockTakeCreate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:stock_take"))
):
    target_store_id = store_id or current_user.store_id or 1
    st = inventory_service.start_stock_take(
        db,
        target_store_id,
        current_user.id,
        notes=st_in.notes,
        category_id=st_in.category_id
    )
    return inventory_service.get_stock_take_summary(db, target_store_id, st.id)


@stock_takes_router.get("/{stock_take_id}", response_model=StockTakeSummaryResponse)
def get_stock_take_by_id(
    stock_take_id: int,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:stock_take"))
):
    target_store_id = store_id or current_user.store_id or 1
    return inventory_service.get_stock_take_summary(db, target_store_id, stock_take_id)


@stock_takes_router.get("/{stock_take_id}/items", response_model=StockTakeItemsPaginatedResponse)
def get_stock_take_items(
    stock_take_id: int,
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:stock_take"))
):
    target_store_id = store_id or current_user.store_id or 1
    return inventory_service.get_stock_take_items_paginated(
        db=db,
        store_id=target_store_id,
        stock_take_id=stock_take_id,
        limit=limit,
        offset=offset,
        search=search,
        category_id=category_id,
        status_filter=status_filter
    )


@stock_takes_router.post("/{stock_take_id}/items", response_model=StockTakeItemResponse)
def post_stock_take_count(
    stock_take_id: int,
    item_count: StockTakeItemCreate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:stock_take"))
):
    target_store_id = store_id or current_user.store_id or 1
    item = inventory_service.record_stock_take_count(db, target_store_id, stock_take_id, item_count)
    cost = item.product.cost_price if item.product else 0
    return StockTakeItemResponse(
        id=item.id,
        stock_take_id=item.stock_take_id,
        product_id=item.product_id,
        product_name=item.product.name if item.product else f"Product #{item.product_id}",
        product_sku=item.product.sku if item.product else None,
        category_name=item.product.category.name if item.product and item.product.category else None,
        unit=item.product.unit if item.product else "pcs",
        unit_type=item.product.unit_type if item.product else "piece",
        meters_per_roll=item.product.meters_per_roll if item.product else None,
        cost_price=cost,
        expected_quantity=item.expected_quantity,
        counted_quantity=item.counted_quantity,
        variance=item.variance,
        variance_value=item.variance * cost,
        is_counted=item.is_counted,
        rolls_counted=item.rolls_counted,
        loose_meters_counted=item.loose_meters_counted
    )


@stock_takes_router.post("/{stock_take_id}/reconcile", response_model=StockTakeSummaryResponse)
def post_reconcile_stock_take(
    stock_take_id: int,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:stock_take"))
):
    target_store_id = store_id or current_user.store_id or 1
    st = inventory_service.reconcile_stock_take(db, target_store_id, current_user.id, stock_take_id)
    return inventory_service.get_stock_take_summary(db, target_store_id, st.id)


@stock_takes_router.post("/{stock_take_id}/cancel", response_model=StockTakeSummaryResponse)
def post_cancel_stock_take(
    stock_take_id: int,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:stock_take"))
):
    target_store_id = store_id or current_user.store_id or 1
    st = inventory_service.cancel_stock_take(db, target_store_id, current_user.id, stock_take_id)
    return inventory_service.get_stock_take_summary(db, target_store_id, st.id)
