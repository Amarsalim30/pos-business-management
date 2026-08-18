from typing import Optional, List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.sale import (
    SaleCreate, SaleResponse, SaleItemResponse, VoidSaleRequest
)
from app.services import sale as sale_service


router = APIRouter(prefix="/sales", tags=["Sales & POS"])


def _format_sale_response(s) -> SaleResponse:
    items = []
    for it in s.items:
        items.append(SaleItemResponse(
            id=it.id,
            product_id=it.product_id,
            product_name=it.product.name if it.product else f"Product #{it.product_id}",
            sku=it.product.sku if it.product else None,
            unit_type=it.unit_type,
            unit_sold=it.unit_sold,
            quantity=it.quantity,
            rolls_qty=it.rolls_qty,
            loose_meters=it.loose_meters,
            unit_price=it.unit_price,
            cost_price=it.cost_price,
            tax_rate=it.tax_rate,
            total=it.total
        ))

    return SaleResponse(
        id=s.id,
        invoice_no=s.invoice_no,
        customer_id=s.customer_id,
        customer_name=s.customer.name if s.customer else None,
        store_id=s.store_id,
        user_id=s.user_id,
        cashier_name=s.user.full_name if s.user else None,
        subtotal=s.subtotal,
        tax_amount=s.tax_amount,
        discount_amount=s.discount_amount,
        total_amount=s.total_amount,
        payment_method=s.payment_method,
        payment_reference=s.payment_reference,
        status=s.status,
        is_etr=s.is_etr,
        notes=s.notes,
        created_at=s.created_at,
        items=items
    )


@router.post("/", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
def checkout_sale(
    sale_in: SaleCreate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    sale = sale_service.create_sale(db, target_store_id, current_user.id, sale_in)
    return _format_sale_response(sale)


@router.get("/", response_model=List[SaleResponse])
def get_sales(
    q: Optional[str] = None,
    customer_id: Optional[int] = None,
    is_etr: Optional[bool] = None,
    status_filter: Optional[str] = None,
    limit: int = 50,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    sales = sale_service.list_sales(
        db, target_store_id, q=q, customer_id=customer_id,
        is_etr=is_etr, status_filter=status_filter, limit=limit
    )
    return [_format_sale_response(s) for s in sales]


@router.get("/{sale_id}", response_model=SaleResponse)
def get_sale_detail(
    sale_id: int,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    sale = sale_service.get_sale(db, target_store_id, sale_id)
    return _format_sale_response(sale)


@router.post("/{sale_id}/void", response_model=SaleResponse)
def void_sale_transaction(
    sale_id: int,
    void_in: VoidSaleRequest,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    sale = sale_service.void_sale(db, target_store_id, current_user.id, sale_id, reason=void_in.reason)
    return _format_sale_response(sale)
