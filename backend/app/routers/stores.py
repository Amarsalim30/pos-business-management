from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.store import (
    StoreUpdate,
    StoreResponse,
    RecurringExpenseCreate,
    RecurringExpenseUpdate,
    RecurringExpenseResponse
)
from app.services.store import (
    get_store,
    update_store,
    list_recurring_expenses,
    create_recurring_expense,
    update_recurring_expense,
    delete_recurring_expense
)
from app.dependencies import require_owner, get_current_user
from app.models.user import User

router = APIRouter(prefix="/stores", tags=["stores"])


@router.get("/settings", response_model=StoreResponse)
def get_store_settings(
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id
    store = get_store(db, target_store_id)
    return StoreResponse.model_validate(store)


@router.patch("/settings", response_model=StoreResponse)
def patch_store_settings(
    store_in: StoreUpdate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    target_store_id = store_id or current_user.store_id or 1
    store = update_store(db, target_store_id, store_in, current_user_id=current_user.id)
    return StoreResponse.model_validate(store)


@router.get("/recurring-expenses", response_model=List[RecurringExpenseResponse])
def get_expenses(
    store_id: Optional[int] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = store_id or current_user.store_id or 1
    expenses = list_recurring_expenses(db, target_store_id, include_inactive=include_inactive)
    return [RecurringExpenseResponse.model_validate(e) for e in expenses]


@router.post("/recurring-expenses", response_model=RecurringExpenseResponse, status_code=status.HTTP_201_CREATED)
def post_expense(
    expense_in: RecurringExpenseCreate,
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    target_store_id = store_id or current_user.store_id or 1
    expense = create_recurring_expense(db, target_store_id, expense_in, current_user_id=current_user.id)
    return RecurringExpenseResponse.model_validate(expense)


@router.patch("/recurring-expenses/{expense_id}", response_model=RecurringExpenseResponse)
def patch_expense(
    expense_id: int,
    expense_in: RecurringExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    expense = update_recurring_expense(db, expense_id, expense_in, current_user_id=current_user.id)
    return RecurringExpenseResponse.model_validate(expense)


@router.delete("/recurring-expenses/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    delete_recurring_expense(db, expense_id, current_user_id=current_user.id)
    return {"message": "Recurring expense deleted"}
