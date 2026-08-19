from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash


def create_user(db: Session, user_in: UserCreate, current_user_id: Optional[int] = None) -> User:
    existing = db.query(User).filter(User.username == user_in.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already registered"
        )
    
    user = User(
        username=user_in.username,
        password_hash=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        permissions=user_in.permissions,
        store_id=user_in.store_id,
        is_active=True
    )
    db.add(user)
    db.flush()
    
    audit = AuditLog(
        user_id=current_user_id,
        action="create",
        table_name="users",
        record_id=user.id,
        changes={"username": user.username, "role": user.role, "full_name": user.full_name, "permissions": user.permissions}
    )
    db.add(audit)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def list_users(db: Session, store_id: Optional[int] = None) -> List[User]:
    query = db.query(User)
    if store_id is not None:
        query = query.filter(User.store_id == store_id)
    return query.order_by(User.id.asc()).all()


def update_user(db: Session, user_id: int, user_update: UserUpdate, current_user_id: int) -> User:
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Check if modifying the last active owner
    if user.role == "owner":
        if (user_update.role is not None and user_update.role != "owner") or user_update.is_active is False:
            active_owners = db.query(User).filter(
                User.role == "owner",
                User.is_active == True,
                User.id != user_id
            ).count()
            if active_owners == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot demote or deactivate the last active owner"
                )

    changes = {}
    if user_update.full_name is not None:
        changes["full_name"] = [user.full_name, user_update.full_name]
        user.full_name = user_update.full_name
    if user_update.role is not None:
        changes["role"] = [user.role, user_update.role]
        user.role = user_update.role
    if user_update.permissions is not None:
        changes["permissions"] = [user.permissions, user_update.permissions]
        user.permissions = user_update.permissions
    if user_update.store_id is not None:
        changes["store_id"] = [user.store_id, user_update.store_id]
        user.store_id = user_update.store_id
    if user_update.is_active is not None:
        changes["is_active"] = [user.is_active, user_update.is_active]
        user.is_active = user_update.is_active
    if user_update.password:
        user.password_hash = get_password_hash(user_update.password)
        changes["password"] = ["***", "***"]
        
    audit = AuditLog(
        user_id=current_user_id,
        action="update",
        table_name="users",
        record_id=user.id,
        changes=changes
    )
    db.add(audit)
    db.commit()
    db.refresh(user)
    return user


def deactivate_user(db: Session, user_id: int, current_user_id: int) -> User:
    return update_user(db, user_id, UserUpdate(is_active=False), current_user_id)
