from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.purchase import (
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    PurchaseOrderResponse,
    PurchaseExpenseCreate,
    PurchaseExpenseResponse,
    GRNCreate,
    GRNUpdate,
    GRNResponse
)
from app.services import purchase as purchase_service
from app.dependencies import get_current_user, require_staff
from app.models.user import User

router = APIRouter(prefix="/purchases", tags=["purchases"])


def _format_po(po) -> PurchaseOrderResponse:
    return PurchaseOrderResponse(
        id=po.id,
        store_id=po.store_id,
        po_no=po.po_no,
        supplier_id=po.supplier_id,
        supplier_name=po.supplier.name if po.supplier else None,
        user_id=po.user_id,
        authorizer_name=po.user.full_name if po.user else None,
        subtotal=po.subtotal,
        tax_amount=po.tax_amount,
        total_amount=po.total_amount,
        status=po.status,
        is_etr=po.is_etr,
        notes=po.notes,
        expected_delivery_date=po.expected_delivery_date,
        created_at=po.created_at,
        cancelled_at=po.cancelled_at,
        items=[
            {
                "id": it.id,
                "po_id": it.po_id,
                "product_id": it.product_id,
                "product_name": it.product.name if it.product else None,
                "product_sku": it.product.sku if it.product else None,
                "unit_type": it.unit_type,
                "ordered_qty": it.ordered_qty,
                "received_qty": it.received_qty,
                "unit_cost": it.unit_cost,
                "total_cost": it.total_cost
            }
            for it in po.items
        ],
        expenses=[
            {
                "id": ex.id,
                "po_id": ex.po_id,
                "store_id": ex.store_id,
                "user_id": ex.user_id,
                "category": ex.category,
                "description": ex.description,
                "amount": ex.amount,
                "payment_method": ex.payment_method,
                "reference": ex.reference,
                "created_at": ex.created_at
            }
            for ex in po.expenses
        ]
    )


def _format_grn(grn) -> GRNResponse:
    return GRNResponse(
        id=grn.id,
        store_id=grn.store_id,
        grn_no=grn.grn_no,
        po_id=grn.po_id,
        po_no=grn.purchase_order.po_no if grn.purchase_order else None,
        supplier_id=grn.supplier_id,
        supplier_name=grn.supplier.name if grn.supplier else None,
        user_id=grn.user_id,
        receiver_name=grn.user.full_name if grn.user else None,
        invoice_number=grn.invoice_number,
        delivery_date=grn.delivery_date,
        total_amount=grn.total_amount,
        notes=grn.notes,
        created_at=grn.created_at,
        items=[
            {
                "id": it.id,
                "grn_id": it.grn_id,
                "product_id": it.product_id,
                "product_name": it.product.name if it.product else None,
                "product_sku": it.product.sku if it.product else None,
                "unit": it.product.unit if it.product else "pcs",
                "meters_per_roll": it.product.meters_per_roll if it.product else None,
                "unit_type": it.unit_type,
                "quantity_received": it.quantity_received,
                "rolls_received": it.rolls_received,
                "loose_meters_received": it.loose_meters_received,
                "unit_cost": it.unit_cost,
                "total_cost": it.total_cost
            }
            for it in grn.items
        ]
    )


# --- Purchase Orders Endpoints ---

@router.get("/orders", response_model=List[PurchaseOrderResponse])
def get_orders(
    supplier_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    is_etr: Optional[bool] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    orders = purchase_service.list_purchase_orders(
        db, target_store_id,
        supplier_id=supplier_id,
        status_filter=status_filter,
        is_etr=is_etr,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset
    )
    return [_format_po(po) for po in orders]


@router.post("/orders", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def post_order(
    po_in: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    po = purchase_service.create_purchase_order(db, target_store_id, current_user.id, po_in)
    return _format_po(po)


@router.get("/orders/{po_id}", response_model=PurchaseOrderResponse)
def get_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    po = purchase_service.get_purchase_order_by_id(db, target_store_id, po_id)
    return _format_po(po)


@router.put("/orders/{po_id}", response_model=PurchaseOrderResponse)
def put_order(
    po_id: int,
    po_update: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    po = purchase_service.update_purchase_order(db, target_store_id, po_id, po_update)
    return _format_po(po)


@router.delete("/orders/{po_id}")
def delete_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    purchase_service.delete_purchase_order(db, target_store_id, po_id)
    return {"message": "Purchase order deleted successfully"}


@router.post("/orders/{po_id}/expenses", response_model=PurchaseExpenseResponse, status_code=status.HTTP_201_CREATED)
def post_order_expense(
    po_id: int,
    expense_in: PurchaseExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    expense = purchase_service.add_purchase_expense(db, target_store_id, current_user.id, po_id, expense_in)
    return PurchaseExpenseResponse.model_validate(expense)


@router.post("/orders/{po_id}/cancel", response_model=PurchaseOrderResponse)
def post_cancel_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    po = purchase_service.cancel_purchase_order(db, target_store_id, po_id)
    return _format_po(po)


# --- Goods Received Note (GRN) Endpoints ---

@router.get("/grn", response_model=List[GRNResponse])
def get_grns(
    po_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    grns = purchase_service.list_goods_received_notes(db, target_store_id, po_id=po_id, supplier_id=supplier_id, limit=limit, offset=offset)
    return [_format_grn(g) for g in grns]


@router.post("/grn", response_model=GRNResponse, status_code=status.HTTP_201_CREATED)
def post_grn(
    grn_in: GRNCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    grn = purchase_service.receive_goods_grn(db, target_store_id, current_user.id, grn_in)
    return _format_grn(grn)


@router.get("/grn/{grn_id}", response_model=GRNResponse)
def get_grn_detail(
    grn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    grn = purchase_service.get_grn_by_id_or_no(db, target_store_id, grn_id)
    return _format_grn(grn)


@router.put("/grn/{grn_id}", response_model=GRNResponse)
def put_grn(
    grn_id: int,
    grn_update: GRNUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    grn = purchase_service.update_goods_received_note(db, target_store_id, current_user.id, grn_id, grn_update)
    return _format_grn(grn)


@router.delete("/grn/{grn_id}")
def delete_grn(
    grn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    purchase_service.delete_goods_received_note(db, target_store_id, current_user.id, grn_id)
    return {"message": "Goods received note deleted successfully"}
