from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=1, max_length=100)
    role: str = Field("staff", pattern="^(owner|staff|accountant|storekeeper|project_manager|admin|cashier)$")
    store_id: Optional[int] = None
    is_active: bool = True
    permissions: Optional[List[str]] = None


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=1, max_length=100)
    role: str = Field("staff", pattern="^(owner|staff|accountant|storekeeper|project_manager|admin|cashier)$")
    store_id: Optional[int] = None
    permissions: Optional[List[str]] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    role: Optional[str] = Field(None, pattern="^(owner|staff|accountant|storekeeper|project_manager|admin|cashier)$")
    store_id: Optional[int] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6)
    permissions: Optional[List[str]] = None


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    permissions: Optional[List[str]] = None
    effective_permissions: List[str] = []
    store_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
