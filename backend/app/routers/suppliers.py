from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.supplier import (
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    SupplierPaymentCreate,
    SupplierPaymentResponse,
    SupplierLedgerResponse,
    SupplierSummaryResponse
)
from app.services import supplier as supplier_service
from app.dependencies import get_current_user, require_staff
from app.models.user import User

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.get("/summary", response_model=SupplierSummaryResponse)
def get_supplier_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    return supplier_service.get_suppliers_summary(db, target_store_id)


@router.get("/", response_model=List[SupplierResponse])
def get_suppliers(
    q: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: Optional[int] = None,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    suppliers = supplier_service.list_suppliers(
        db, target_store_id, q=q, is_active=is_active, limit=limit, offset=offset
    )
    return [SupplierResponse.model_validate(s) for s in suppliers]



@router.post("/", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def post_supplier(
    supplier_in: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    supplier = supplier_service.create_supplier(db, target_store_id, supplier_in)
    return SupplierResponse.model_validate(supplier)


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    supplier = supplier_service.get_supplier_by_id(db, target_store_id, supplier_id)
    return SupplierResponse.model_validate(supplier)


@router.put("/{supplier_id}", response_model=SupplierResponse)
def put_supplier(
    supplier_id: int,
    supplier_in: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    supplier = supplier_service.update_supplier(db, target_store_id, supplier_id, supplier_in)
    return SupplierResponse.model_validate(supplier)


@router.post("/{supplier_id}/payments", response_model=SupplierPaymentResponse, status_code=status.HTTP_201_CREATED)
def post_supplier_payment(
    supplier_id: int,
    payment_in: SupplierPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    payment = supplier_service.record_supplier_payment(db, target_store_id, current_user.id, supplier_id, payment_in)
    resp = SupplierPaymentResponse.model_validate(payment)
    if payment.supplier:
        resp.supplier_name = payment.supplier.name
    if payment.user:
        resp.authorizer_name = payment.user.full_name
    return resp


@router.get("/payments/{payment_id}", response_model=SupplierPaymentResponse)
def get_supplier_payment_detail(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    payment = supplier_service.get_supplier_payment_by_id(db, target_store_id, payment_id)
    resp = SupplierPaymentResponse.model_validate(payment)
    if payment.supplier:
        resp.supplier_name = payment.supplier.name
    if payment.user:
        resp.authorizer_name = payment.user.full_name
    return resp


@router.get("/{supplier_id}/ledger", response_model=SupplierLedgerResponse)
def get_supplier_ledger(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    return supplier_service.get_supplier_ledger(db, target_store_id, supplier_id)


@router.delete("/{supplier_id}")
def delete_supplier_by_id(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    return supplier_service.delete_supplier(db, target_store_id, supplier_id)

