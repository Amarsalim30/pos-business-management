from typing import Optional, List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.sale import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    CustomerPaymentCreate, CustomerPaymentResponse, CustomerLedgerResponse,
    CustomerSummaryResponse
)
from app.services import sale as sale_service


router = APIRouter(prefix="/customers", tags=["Customers & Debt Ledgers"])


@router.get("/summary", response_model=CustomerSummaryResponse)
def get_customer_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return sale_service.get_customers_summary(db)


@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_new_customer(
    cust_in: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return sale_service.create_customer(db, cust_in)


@router.get("/", response_model=List[CustomerResponse])
def get_customers(
    q: Optional[str] = None,
    active_only: bool = True,
    limit: Optional[int] = None,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return sale_service.list_customers(db, q=q, active_only=active_only, limit=limit, offset=offset)



@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer_by_id(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return sale_service.get_customer(db, customer_id)


@router.get("/{customer_id}/ledger", response_model=CustomerLedgerResponse)
def get_customer_account_ledger(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return sale_service.get_customer_ledger(db, customer_id)


@router.get("/{customer_id}/sites", response_model=List[str])
def get_customer_sites_list(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return sale_service.get_customer_sites(db, customer_id)


@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer_details(
    customer_id: int,
    cust_in: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return sale_service.update_customer(db, customer_id, cust_in)


@router.post("/{customer_id}/payments", response_model=CustomerPaymentResponse, status_code=status.HTTP_201_CREATED)
def record_payment(
    customer_id: int,
    pay_in: CustomerPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return sale_service.record_customer_payment(db, customer_id, current_user.id, pay_in)


@router.delete("/{customer_id}")
def delete_customer_by_id(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return sale_service.delete_customer(db, customer_id)


