from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    parent_id: Optional[int] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    id: int
    store_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    sku: Optional[str] = Field(None, max_length=50)
    category_id: Optional[int] = None
    unit: str = "pcs"
    unit_type: str = Field("piece", pattern="^(piece|roll)$")
    meters_per_roll: Optional[Decimal] = Field(None, gt=0)
    cost_price: Decimal = Field(..., ge=0)
    selling_price: Decimal = Field(..., ge=0)
    price_per_meter: Optional[Decimal] = Field(None, ge=0)
    cost_per_meter: Optional[Decimal] = Field(None, ge=0)
    reorder_level: Decimal = Field(default=Decimal("5.00"), ge=0)
    is_taxable: bool = True
    is_active: bool = True


class ProductCreate(ProductBase):
    initial_stock: Optional[Decimal] = Field(Decimal("0.00"), ge=0)


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    sku: Optional[str] = Field(None, min_length=1, max_length=50)
    category_id: Optional[int] = None
    unit: Optional[str] = None
    unit_type: Optional[str] = Field(None, pattern="^(piece|roll)$")
    meters_per_roll: Optional[Decimal] = Field(None, gt=0)
    cost_price: Optional[Decimal] = Field(None, ge=0)
    selling_price: Optional[Decimal] = Field(None, ge=0)
    price_per_meter: Optional[Decimal] = Field(None, ge=0)
    cost_per_meter: Optional[Decimal] = Field(None, ge=0)
    reorder_level: Optional[Decimal] = Field(None, ge=0)
    is_taxable: Optional[bool] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: int
    store_id: int
    sku: Optional[str] = None
    current_stock: Optional[Decimal] = Decimal("0.00")
    formatted_stock: Optional[str] = None
    is_low_stock: Optional[bool] = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
