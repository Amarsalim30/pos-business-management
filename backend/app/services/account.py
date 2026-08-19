from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from fastapi import HTTPException, status

from app.models.account import PettyCashEntry, BankAccount, BankTransaction, MpesaIncome
from app.schemas.account import (
    PettyCashCreate, PettyCashResponse, PettyCashSummaryResponse,
    BankAccountCreate, BankAccountUpdate, BankAccountResponse, BankAccountDetailResponse,
    BankTransactionCreate, BankTransactionResponse,
    MpesaIncomeCreate, MpesaIncomeResponse, AccountsOverviewResponse
)


# =========================================================================
# Petty Cash Services
# =========================================================================

def add_petty_cash_entry(
    db: Session, store_id: int, user_id: int, entry_in: PettyCashCreate
) -> PettyCashEntry:
    entry = PettyCashEntry(
        store_id=store_id,
        date=entry_in.date or datetime.now(timezone.utc),
        description=entry_in.description.strip(),
        amount=entry_in.amount,
        type=entry_in.type,
        category=entry_in.category,
        receipt_no=entry_in.receipt_no.strip() if entry_in.receipt_no else None,
        user_id=user_id
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def list_petty_cash_entries(
    db: Session,
    store_id: int,
    type_filter: Optional[str] = None,
    category: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: Optional[int] = None,
    offset: int = 0
) -> List[PettyCashEntry]:
    query = db.query(PettyCashEntry).filter(PettyCashEntry.store_id == store_id)

    if type_filter and type_filter != "all":
        query = query.filter(PettyCashEntry.type == type_filter)
    if category and category != "all":
        query = query.filter(PettyCashEntry.category == category)
    if date_from:
        query = query.filter(PettyCashEntry.date >= date_from)
    if date_to:
        query = query.filter(PettyCashEntry.date <= date_to)

    query = query.order_by(desc(PettyCashEntry.date))
    if limit is not None:
        query = query.offset(offset).limit(limit)
    return query.all()


def get_petty_cash_summary(
    db: Session, store_id: int, date_from: Optional[datetime] = None, date_to: Optional[datetime] = None
) -> PettyCashSummaryResponse:
    query = db.query(PettyCashEntry).filter(PettyCashEntry.store_id == store_id)
    if date_from:
        query = query.filter(PettyCashEntry.date >= date_from)
    if date_to:
        query = query.filter(PettyCashEntry.date <= date_to)

    total_in = Decimal("0.00")
    total_out = Decimal("0.00")
    entries_count = 0

    for e in query.all():
        entries_count += 1
        if e.type == "in":
            total_in += e.amount
        else:
            total_out += e.amount

    return PettyCashSummaryResponse(
        total_in=total_in,
        total_out=total_out,
        balance=total_in - total_out,
        entries_count=entries_count
    )


# =========================================================================
# Bank Accounts & Transactions
# =========================================================================

def create_bank_account(
    db: Session, store_id: int, account_in: BankAccountCreate
) -> BankAccount:
    account = BankAccount(
        store_id=store_id,
        name=account_in.name.strip(),
        bank_name=account_in.bank_name.strip(),
        account_number=account_in.account_number.strip(),
        balance=account_in.initial_balance,
        is_active=True
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def list_bank_accounts(
    db: Session, store_id: int, is_active: Optional[bool] = None
) -> List[BankAccount]:
    query = db.query(BankAccount).filter(BankAccount.store_id == store_id)
    if is_active is not None:
        query = query.filter(BankAccount.is_active == is_active)
    return query.order_by(BankAccount.name).all()


def get_bank_account(db: Session, store_id: int, account_id: int) -> BankAccount:
    account = db.query(BankAccount).filter(
        BankAccount.id == account_id,
        BankAccount.store_id == store_id
    ).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bank account not found")
    return account


def update_bank_account(
    db: Session, store_id: int, account_id: int, account_in: BankAccountUpdate
) -> BankAccount:
    account = get_bank_account(db, store_id, account_id)
    if account_in.name is not None:
        account.name = account_in.name.strip()
    if account_in.bank_name is not None:
        account.bank_name = account_in.bank_name.strip()
    if account_in.account_number is not None:
        account.account_number = account_in.account_number.strip()
    if account_in.is_active is not None:
        account.is_active = account_in.is_active
    db.commit()
    db.refresh(account)
    return account


def record_bank_transaction(
    db: Session, store_id: int, user_id: int, account_id: int, trans_in: BankTransactionCreate
) -> BankTransaction:
    account = get_bank_account(db, store_id, account_id)

    if trans_in.type == "withdrawal" and account.balance < trans_in.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient funds. Current balance: KES {account.balance:,.2f}"
        )

    if trans_in.type == "deposit":
        account.balance += trans_in.amount
    else:
        account.balance -= trans_in.amount

    trans = BankTransaction(
        bank_account_id=account.id,
        date=trans_in.date or datetime.now(timezone.utc),
        description=trans_in.description.strip(),
        amount=trans_in.amount,
        type=trans_in.type,
        reference=trans_in.reference.strip() if trans_in.reference else None,
        user_id=user_id
    )
    db.add(trans)
    db.commit()
    db.refresh(trans)
    return trans


def get_bank_account_detail(db: Session, store_id: int, account_id: int) -> BankAccountDetailResponse:
    account = get_bank_account(db, store_id, account_id)
    txs = db.query(BankTransaction).filter(
        BankTransaction.bank_account_id == account.id
    ).order_by(desc(BankTransaction.date)).all()

    tx_res = [
        BankTransactionResponse(
            id=t.id,
            bank_account_id=t.bank_account_id,
            date=t.date,
            description=t.description,
            amount=t.amount,
            type=t.type,
            reference=t.reference,
            user_id=t.user_id,
            user_name=t.user.full_name if t.user else None,
            created_at=t.created_at
        )
        for t in txs
    ]

    return BankAccountDetailResponse(
        id=account.id,
        store_id=account.store_id,
        name=account.name,
        bank_name=account.bank_name,
        account_number=account.account_number,
        balance=account.balance,
        is_active=account.is_active,
        created_at=account.created_at,
        transactions=tx_res
    )


# =========================================================================
# M-Pesa Agent Commissions
# =========================================================================

def record_mpesa_income(
    db: Session, store_id: int, user_id: int, mpesa_in: MpesaIncomeCreate
) -> MpesaIncome:
    record = MpesaIncome(
        store_id=store_id,
        date=mpesa_in.date or datetime.now(timezone.utc),
        description=mpesa_in.description.strip(),
        amount=mpesa_in.amount,
        reference=mpesa_in.reference.strip() if mpesa_in.reference else None,
        user_id=user_id
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def list_mpesa_incomes(
    db: Session,
    store_id: int,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: Optional[int] = None,
    offset: int = 0
) -> List[MpesaIncome]:
    query = db.query(MpesaIncome).filter(MpesaIncome.store_id == store_id)
    if date_from:
        query = query.filter(MpesaIncome.date >= date_from)
    if date_to:
        query = query.filter(MpesaIncome.date <= date_to)

    query = query.order_by(desc(MpesaIncome.date))
    if limit is not None:
        query = query.offset(offset).limit(limit)
    return query.all()


def get_accounts_overview(db: Session, store_id: int) -> AccountsOverviewResponse:
    petty_summary = get_petty_cash_summary(db, store_id)

    total_bank_bal = db.query(
        func.coalesce(func.sum(BankAccount.balance), Decimal("0.00"))
    ).filter(
        BankAccount.store_id == store_id,
        BankAccount.is_active == True
    ).scalar() or Decimal("0.00")

    active_banks_count = db.query(func.count(BankAccount.id)).filter(
        BankAccount.store_id == store_id,
        BankAccount.is_active == True
    ).scalar() or 0

    total_mpesa = db.query(
        func.coalesce(func.sum(MpesaIncome.amount), Decimal("0.00"))
    ).filter(
        MpesaIncome.store_id == store_id
    ).scalar() or Decimal("0.00")

    return AccountsOverviewResponse(
        petty_cash_balance=petty_summary.balance,
        total_bank_balances=Decimal(str(total_bank_bal)),
        total_mpesa_commission=Decimal(str(total_mpesa)),
        active_bank_accounts=active_banks_count
    )
