from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class StoreBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    address: Optional[str] = None
    phone: Optional[str] = None
    tax_id: Optional[str] = None
    vat_rate: Decimal = Field(default=Decimal("0.1600"), ge=0, le=1)
    is_active: bool = True


class StoreCreate(StoreBase):
    pass


class StoreUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    address: Optional[str] = None
    phone: Optional[str] = None
    tax_id: Optional[str] = None
    vat_rate: Optional[Decimal] = Field(None, ge=0, le=1)
    is_active: Optional[bool] = None


class StoreResponse(StoreBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecurringExpenseBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    amount: Decimal = Field(..., gt=0)
    category: str = Field("other", pattern="^(rent|payroll|other)$")
    is_active: bool = True


class RecurringExpenseCreate(RecurringExpenseBase):
    pass


class RecurringExpenseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    amount: Optional[Decimal] = Field(None, gt=0)
    category: Optional[str] = Field(None, pattern="^(rent|payroll|other)$")
    is_active: Optional[bool] = None


class RecurringExpenseResponse(RecurringExpenseBase):
    id: int
    store_id: int

    model_config = ConfigDict(from_attributes=True)
