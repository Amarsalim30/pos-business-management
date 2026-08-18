from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.services.user import (
    create_user,
    list_users,
    get_user_by_id,
    update_user,
    deactivate_user
)
from app.dependencies import require_owner
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=List[UserResponse])
def get_users(
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    users = list_users(db, store_id=store_id)
    return [UserResponse.model_validate(u) for u in users]


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def post_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    user = create_user(db, user_in, current_user_id=current_user.id)
    return UserResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    user = get_user_by_id(db, user_id)
    return UserResponse.model_validate(user)


@router.patch("/{user_id}", response_model=UserResponse)
def patch_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    user = update_user(db, user_id, user_in, current_user_id=current_user.id)
    return UserResponse.model_validate(user)


@router.delete("/{user_id}", response_model=UserResponse)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    user = deactivate_user(db, user_id, current_user_id=current_user.id)
    return UserResponse.model_validate(user)
