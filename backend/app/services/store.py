from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.store import Store, RecurringExpense
from app.models.audit import AuditLog
from app.schemas.store import StoreUpdate, RecurringExpenseCreate, RecurringExpenseUpdate


def get_store(db: Session, store_id: Optional[int] = None) -> Store:
    if store_id:
        store = db.query(Store).filter(Store.id == store_id).first()
    else:
        store = db.query(Store).first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not configured")
    return store


def update_store(db: Session, store_id: int, store_in: StoreUpdate, current_user_id: int) -> Store:
    store = get_store(db, store_id)
    changes = {}
    if store_in.name is not None:
        changes["name"] = [store.name, store_in.name]
        store.name = store_in.name
    if store_in.address is not None:
        changes["address"] = [store.address, store_in.address]
        store.address = store_in.address
    if store_in.phone is not None:
        changes["phone"] = [store.phone, store_in.phone]
        store.phone = store_in.phone
    if store_in.tax_id is not None:
        changes["tax_id"] = [store.tax_id, store_in.tax_id]
        store.tax_id = store_in.tax_id
    if store_in.vat_rate is not None:
        changes["vat_rate"] = [str(store.vat_rate), str(store_in.vat_rate)]
        store.vat_rate = store_in.vat_rate
    if store_in.is_active is not None:
        changes["is_active"] = [store.is_active, store_in.is_active]
        store.is_active = store_in.is_active

    audit = AuditLog(
        user_id=current_user_id,
        action="update",
        table_name="stores",
        record_id=store.id,
        changes=changes
    )
    db.add(audit)
    db.commit()
    db.refresh(store)
    return store


def list_recurring_expenses(db: Session, store_id: int, include_inactive: bool = False) -> List[RecurringExpense]:
    query = db.query(RecurringExpense).filter(RecurringExpense.store_id == store_id)
    if not include_inactive:
        query = query.filter(RecurringExpense.is_active == True)
    return query.order_by(RecurringExpense.id.asc()).all()


def create_recurring_expense(db: Session, store_id: int, expense_in: RecurringExpenseCreate, current_user_id: int) -> RecurringExpense:
    # Ensure store exists
    get_store(db, store_id)
    
    expense = RecurringExpense(
        store_id=store_id,
        name=expense_in.name,
        amount=expense_in.amount,
        category=expense_in.category,
        is_active=expense_in.is_active
    )
    db.add(expense)
    db.flush()
    
    audit = AuditLog(
        user_id=current_user_id,
        action="create",
        table_name="recurring_expenses",
        record_id=expense.id,
        changes={"name": expense.name, "amount": str(expense.amount), "category": expense.category}
    )
    db.add(audit)
    db.commit()
    db.refresh(expense)
    return expense


def update_recurring_expense(db: Session, expense_id: int, expense_in: RecurringExpenseUpdate, current_user_id: int) -> RecurringExpense:
    expense = db.query(RecurringExpense).filter(RecurringExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring expense not found")
        
    changes = {}
    if expense_in.name is not None:
        changes["name"] = [expense.name, expense_in.name]
        expense.name = expense_in.name
    if expense_in.amount is not None:
        changes["amount"] = [str(expense.amount), str(expense_in.amount)]
        expense.amount = expense_in.amount
    if expense_in.category is not None:
        changes["category"] = [expense.category, expense_in.category]
        expense.category = expense_in.category
    if expense_in.is_active is not None:
        changes["is_active"] = [expense.is_active, expense_in.is_active]
        expense.is_active = expense_in.is_active
        
    audit = AuditLog(
        user_id=current_user_id,
        action="update",
        table_name="recurring_expenses",
        record_id=expense.id,
        changes=changes
    )
    db.add(audit)
    db.commit()
    db.refresh(expense)
    return expense


def delete_recurring_expense(db: Session, expense_id: int, current_user_id: int) -> bool:
    expense = db.query(RecurringExpense).filter(RecurringExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring expense not found")
        
    audit = AuditLog(
        user_id=current_user_id,
        action="delete",
        table_name="recurring_expenses",
        record_id=expense.id,
        changes={"name": expense.name, "amount": str(expense.amount)}
    )
    db.add(audit)
    db.delete(expense)
    db.commit()
    return True
