from decimal import Decimal
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user, require_permission
from app.models.user import User
from app.schemas.account import (
    PettyCashCreate, PettyCashResponse, PettyCashSummaryResponse,
    BankAccountCreate, BankAccountUpdate, BankAccountResponse, BankAccountDetailResponse,
    BankTransactionCreate, BankTransactionResponse,
    MpesaIncomeCreate, MpesaIncomeResponse, AccountsOverviewResponse
)
from app.services import account as account_service

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("/overview", response_model=AccountsOverviewResponse)
def get_accounts_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    overview = account_service.get_accounts_overview(db, target_store_id)

    # Sanitize banking and float data if user lacks banking_mpesa permission
    is_owner = current_user.role in ("owner", "admin")
    can_banking = is_owner or "*" in current_user.effective_permissions or "accounts:banking_mpesa" in current_user.effective_permissions

    if not can_banking:
        overview.total_bank_balances = Decimal("0.00")
        overview.total_mpesa_commission = Decimal("0.00")
        overview.active_bank_accounts = 0

    return overview


# =========================================================================
# Petty Cash Endpoints
# =========================================================================

@router.get("/petty-cash/summary", response_model=PettyCashSummaryResponse)
def get_petty_cash_summary(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounts:petty_cash"))
):
    target_store_id = current_user.store_id or 1
    return account_service.get_petty_cash_summary(db, target_store_id, date_from=date_from, date_to=date_to)


@router.get("/petty-cash", response_model=List[PettyCashResponse])
def get_petty_cash_entries(
    type: Optional[str] = None,
    category: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: Optional[int] = None,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounts:petty_cash"))
):
    target_store_id = current_user.store_id or 1
    entries = account_service.list_petty_cash_entries(
        db, target_store_id, type_filter=type, category=category,
        date_from=date_from, date_to=date_to, limit=limit, offset=offset
    )
    return [
        PettyCashResponse(
            id=e.id,
            store_id=e.store_id,
            date=e.date,
            description=e.description,
            amount=e.amount,
            type=e.type,
            category=e.category,
            receipt_no=e.receipt_no,
            user_id=e.user_id,
            user_name=e.user.full_name if e.user else None,
            created_at=e.created_at
        )
        for e in entries
    ]


@router.post("/petty-cash", response_model=PettyCashResponse, status_code=status.HTTP_201_CREATED)
def create_petty_cash_entry(
    entry_in: PettyCashCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounts:petty_cash"))
):
    target_store_id = current_user.store_id or 1
    entry = account_service.add_petty_cash_entry(db, target_store_id, current_user.id, entry_in)
    return PettyCashResponse(
        id=entry.id,
        store_id=entry.store_id,
        date=entry.date,
        description=entry.description,
        amount=entry.amount,
        type=entry.type,
        category=entry.category,
        receipt_no=entry.receipt_no,
        user_id=entry.user_id,
        user_name=current_user.full_name,
        created_at=entry.created_at
    )


# =========================================================================
# Bank Accounts Endpoints
# =========================================================================

@router.get("/bank-accounts", response_model=List[BankAccountResponse])
def get_bank_accounts(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounts:banking_mpesa"))
):
    target_store_id = current_user.store_id or 1
    return account_service.list_bank_accounts(db, target_store_id, is_active=is_active)


@router.post("/bank-accounts", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
def create_bank_account(
    account_in: BankAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounts:banking_mpesa"))
):
    target_store_id = current_user.store_id or 1
    return account_service.create_bank_account(db, target_store_id, account_in)


@router.get("/bank-accounts/{account_id}", response_model=BankAccountDetailResponse)
def get_bank_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounts:banking_mpesa"))
):
    target_store_id = current_user.store_id or 1
    return account_service.get_bank_account_detail(db, target_store_id, account_id)


@router.put("/bank-accounts/{account_id}", response_model=BankAccountResponse)
def update_bank_account(
    account_id: int,
    account_in: BankAccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounts:banking_mpesa"))
):
    target_store_id = current_user.store_id or 1
    return account_service.update_bank_account(db, target_store_id, account_id, account_in)


@router.post("/bank-accounts/{account_id}/transactions", response_model=BankTransactionResponse, status_code=status.HTTP_201_CREATED)
def record_bank_transaction(
    account_id: int,
    trans_in: BankTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounts:banking_mpesa"))
):
    target_store_id = current_user.store_id or 1
    trans = account_service.record_bank_transaction(db, target_store_id, current_user.id, account_id, trans_in)
    return BankTransactionResponse(
        id=trans.id,
        bank_account_id=trans.bank_account_id,
        date=trans.date,
        description=trans.description,
        amount=trans.amount,
        type=trans.type,
        reference=trans.reference,
        user_id=trans.user_id,
        user_name=current_user.full_name,
        created_at=trans.created_at
    )


# =========================================================================
# M-Pesa Income Endpoints
# =========================================================================

@router.get("/mpesa-income", response_model=List[MpesaIncomeResponse])
def get_mpesa_income(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: Optional[int] = None,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounts:banking_mpesa"))
):
    target_store_id = current_user.store_id or 1
    records = account_service.list_mpesa_incomes(
        db, target_store_id, date_from=date_from, date_to=date_to, limit=limit, offset=offset
    )
    return [
        MpesaIncomeResponse(
            id=r.id,
            store_id=r.store_id,
            date=r.date,
            description=r.description,
            amount=r.amount,
            reference=r.reference,
            user_id=r.user_id,
            user_name=r.user.full_name if r.user else None,
            created_at=r.created_at
        )
        for r in records
    ]


@router.post("/mpesa-income", response_model=MpesaIncomeResponse, status_code=status.HTTP_201_CREATED)
def create_mpesa_income(
    mpesa_in: MpesaIncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounts:banking_mpesa"))
):
    target_store_id = current_user.store_id or 1
    record = account_service.record_mpesa_income(db, target_store_id, current_user.id, mpesa_in)
    return MpesaIncomeResponse(
        id=record.id,
        store_id=record.store_id,
        date=record.date,
        description=record.description,
        amount=record.amount,
        reference=record.reference,
        user_id=record.user_id,
        user_name=current_user.full_name,
        created_at=record.created_at
    )
