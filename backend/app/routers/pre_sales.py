from typing import Optional, List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.sale import (
    PreSaleDocumentCreate, PreSaleDocumentResponse, PreSaleItemResponse, SaleResponse
)
from app.routers.sales import _format_sale_response
from app.services import sale as sale_service


router = APIRouter(prefix="/pre-sales", tags=["Pre-Sale Documents (Quotations / Proformas)"])


def _format_document_response(doc) -> PreSaleDocumentResponse:
    items = []
    for it in doc.items:
        items.append(PreSaleItemResponse(
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
            tax_rate=it.tax_rate,
            total=it.total
        ))

    return PreSaleDocumentResponse(
        id=doc.id,
        document_no=doc.document_no,
        type=doc.type,
        customer_id=doc.customer_id,
        customer_name=doc.customer.name if doc.customer else None,
        store_id=doc.store_id,
        user_id=doc.user_id,
        subtotal=doc.subtotal,
        tax_amount=doc.tax_amount,
        discount_amount=doc.discount_amount,
        total_amount=doc.total_amount,
        status=doc.status,
        site_name=doc.site_name,
        valid_until=doc.valid_until,
        notes=doc.notes,
        converted_sale_id=doc.converted_sale_id,
        created_at=doc.created_at,
        items=items
    )


@router.post("/", response_model=PreSaleDocumentResponse, status_code=status.HTTP_201_CREATED)
def create_pre_sale(
    doc_in: PreSaleDocumentCreate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    doc = sale_service.create_pre_sale_document(db, target_store_id, current_user.id, doc_in)
    return _format_document_response(doc)


@router.get("/", response_model=List[PreSaleDocumentResponse])
def get_pre_sale_documents(
    doc_type: Optional[str] = None,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    docs = sale_service.list_pre_sale_documents(db, target_store_id, doc_type=doc_type)
    return [_format_document_response(d) for d in docs]


@router.get("/{doc_id}", response_model=PreSaleDocumentResponse)
def get_pre_sale_by_id(
    doc_id: int,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    doc = sale_service.get_pre_sale_document(db, target_store_id, doc_id)
    return _format_document_response(doc)


@router.put("/{doc_id}", response_model=PreSaleDocumentResponse)
def update_pre_sale(
    doc_id: int,
    doc_in: PreSaleDocumentCreate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    doc = sale_service.update_pre_sale_document(db, target_store_id, current_user.id, doc_id, doc_in)
    return _format_document_response(doc)


@router.delete("/{doc_id}", status_code=status.HTTP_200_OK)
def delete_pre_sale(
    doc_id: int,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    sale_service.delete_pre_sale_document(db, target_store_id, doc_id)
    return {"success": True, "detail": f"Document #{doc_id} deleted successfully"}


@router.post("/{doc_id}/convert-to-sale", response_model=SaleResponse)
def convert_to_sale(
    doc_id: int,
    payment_method: str = "cash",
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    sale = sale_service.convert_pre_sale_to_sale(db, target_store_id, current_user.id, doc_id, payment_method=payment_method)
    return _format_sale_response(sale)

