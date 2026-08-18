from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.schemas.inventory import (
    InventoryItemResponse,
    StockAdjustmentCreate,
    StockMovementResponse,
    StockTakeCreate,
    StockTakeItemCreate,
    StockTakeResponse,
    StockTakeItemResponse
)
from backend.app.services import inventory as inventory_service
from backend.app.dependencies import get_current_user, require_owner, require_staff
from backend.app.models.user import User

inventory_router = APIRouter(prefix="/inventory", tags=["inventory"])
stock_takes_router = APIRouter(prefix="/stock-takes", tags=["stock-takes"])


# =========================================================================
# Inventory Endpoints
# =========================================================================

@inventory_router.get("/", response_model=List[InventoryItemResponse])
def get_inventory(
    low_stock_only: bool = False,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    return inventory_service.list_inventory(db, target_store_id, low_stock_only=low_stock_only)


@inventory_router.post("/adjust", status_code=status.HTTP_200_OK)
def post_stock_adjustment(
    adj_in: StockAdjustmentCreate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = store_id or current_user.store_id or 1
    prev_qty, new_qty = inventory_service.adjust_stock(db, target_store_id, current_user.id, adj_in)
    return {
        "message": "Stock adjusted successfully",
        "previous_quantity": prev_qty,
        "new_quantity": new_qty
    }


@inventory_router.get("/movements", response_model=List[StockMovementResponse])
def get_stock_movements(
    product_id: Optional[int] = None,
    limit: int = 50,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    movements = inventory_service.list_stock_movements(db, target_store_id, product_id=product_id, limit=limit)
    return [StockMovementResponse.model_validate(m) for m in movements]


# =========================================================================
# Stock Take Endpoints
# =========================================================================

@stock_takes_router.get("/", response_model=List[StockTakeResponse])
def get_stock_takes(
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    sessions = inventory_service.list_stock_takes(db, target_store_id)
    result = []
    for st in sessions:
        items = [
            StockTakeItemResponse(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name if item.product else f"Product #{item.product_id}",
                expected_quantity=item.expected_quantity,
                counted_quantity=item.counted_quantity,
                variance=item.variance,
                rolls_counted=item.rolls_counted,
                loose_meters_counted=item.loose_meters_counted
            )
            for item in st.items
        ]
        result.append(
            StockTakeResponse(
                id=st.id,
                store_id=st.store_id,
                user_id=st.user_id,
                status=st.status,
                notes=st.notes,
                created_at=st.created_at,
                completed_at=st.completed_at,
                items=items
            )
        )
    return result


@stock_takes_router.post("/", response_model=StockTakeResponse, status_code=status.HTTP_201_CREATED)
def post_stock_take(
    st_in: StockTakeCreate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = store_id or current_user.store_id or 1
    st = inventory_service.start_stock_take(db, target_store_id, current_user.id, notes=st_in.notes)
    
    items = [
        StockTakeItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product.name if item.product else f"Product #{item.product_id}",
            expected_quantity=item.expected_quantity,
            counted_quantity=item.counted_quantity,
            variance=item.variance,
            rolls_counted=item.rolls_counted,
            loose_meters_counted=item.loose_meters_counted
        )
        for item in st.items
    ]
    return StockTakeResponse(
        id=st.id,
        store_id=st.store_id,
        user_id=st.user_id,
        status=st.status,
        notes=st.notes,
        created_at=st.created_at,
        completed_at=st.completed_at,
        items=items
    )


@stock_takes_router.get("/{stock_take_id}", response_model=StockTakeResponse)
def get_stock_take_by_id(
    stock_take_id: int,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    st = inventory_service.get_stock_take(db, target_store_id, stock_take_id)
    items = [
        StockTakeItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product.name if item.product else f"Product #{item.product_id}",
            expected_quantity=item.expected_quantity,
            counted_quantity=item.counted_quantity,
            variance=item.variance,
            rolls_counted=item.rolls_counted,
            loose_meters_counted=item.loose_meters_counted
        )
        for item in st.items
    ]
    return StockTakeResponse(
        id=st.id,
        store_id=st.store_id,
        user_id=st.user_id,
        status=st.status,
        notes=st.notes,
        created_at=st.created_at,
        completed_at=st.completed_at,
        items=items
    )


@stock_takes_router.post("/{stock_take_id}/items", response_model=StockTakeItemResponse)
def post_stock_take_count(
    stock_take_id: int,
    item_count: StockTakeItemCreate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    item = inventory_service.record_stock_take_count(db, target_store_id, stock_take_id, item_count)
    return StockTakeItemResponse(
        id=item.id,
        product_id=item.product_id,
        product_name=item.product.name,
        expected_quantity=item.expected_quantity,
        counted_quantity=item.counted_quantity,
        variance=item.variance,
        rolls_counted=item.rolls_counted,
        loose_meters_counted=item.loose_meters_counted
    )


@stock_takes_router.post("/{stock_take_id}/reconcile", response_model=StockTakeResponse)
def post_reconcile_stock_take(
    stock_take_id: int,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = store_id or current_user.store_id or 1
    st = inventory_service.reconcile_stock_take(db, target_store_id, current_user.id, stock_take_id)
    items = [
        StockTakeItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product.name if item.product else f"Product #{item.product_id}",
            expected_quantity=item.expected_quantity,
            counted_quantity=item.counted_quantity,
            variance=item.variance,
            rolls_counted=item.rolls_counted,
            loose_meters_counted=item.loose_meters_counted
        )
        for item in st.items
    ]
    return StockTakeResponse(
        id=st.id,
        store_id=st.store_id,
        user_id=st.user_id,
        status=st.status,
        notes=st.notes,
        created_at=st.created_at,
        completed_at=st.completed_at,
        items=items
    )
