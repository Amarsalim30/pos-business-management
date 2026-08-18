from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class StockMovementResponse(BaseModel):
    id: int
    product_id: int
    store_id: int
    type: str
    quantity: Decimal
    unit_sold: Optional[str] = None
    previous_quantity: Decimal
    new_quantity: Decimal
    reference_id: Optional[str] = None
    note: Optional[str] = None
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StockAdjustmentCreate(BaseModel):
    product_id: int
    adjusted_quantity: Decimal = Field(..., description="Quantity to add or subtract (signed)")
    note: str = Field(..., min_length=2, description="Reason for adjustment (e.g. Broken item, Found stock)")


class InventoryItemResponse(BaseModel):
    product_id: int
    product_name: str
    sku: str
    unit: str
    unit_type: str
    meters_per_roll: Optional[Decimal] = None
    cost_price: Decimal
    selling_price: Decimal
    reorder_level: Decimal
    quantity: Decimal
    formatted_stock: str
    is_low_stock: bool
    last_updated: datetime

    model_config = ConfigDict(from_attributes=True)


class StockTakeItemCreate(BaseModel):
    product_id: int
    counted_quantity: Optional[Decimal] = None  # direct total
    rolls_counted: Optional[int] = None        # roll helper
    loose_meters_counted: Optional[Decimal] = None


class StockTakeItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    expected_quantity: Decimal
    counted_quantity: Decimal
    variance: Decimal
    rolls_counted: Optional[int] = None
    loose_meters_counted: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)


class StockTakeCreate(BaseModel):
    notes: Optional[str] = None


class StockTakeResponse(BaseModel):
    id: int
    store_id: int
    user_id: int
    status: str
    notes: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    items: List[StockTakeItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
