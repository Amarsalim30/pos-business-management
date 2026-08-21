from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class StockMovementResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    sku: Optional[str] = None
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
    note: Optional[str] = Field(None, description="Reason for adjustment (optional)")


class StockReceiveCreate(BaseModel):
    product_id: int
    quantity: Optional[Decimal] = Field(None, gt=0, description="Direct piece/meter quantity")
    rolls_received: Optional[int] = Field(None, ge=0, description="Roll helper: full rolls received")
    loose_meters_received: Optional[Decimal] = Field(None, ge=0, description="Roll helper: loose meters received")
    unit_cost: Optional[Decimal] = Field(None, ge=0, description="Optional new buying cost price")
    reference_id: Optional[str] = Field(None, max_length=100, description="Supplier Delivery Note # / PO # / Invoice #")
    note: Optional[str] = Field(None, description="Receiving notes or supplier name")


class BatchStockReceiveItem(BaseModel):
    product_id: int
    quantity: Optional[Decimal] = Field(None, gt=0, description="Direct piece/meter quantity")
    rolls_received: Optional[int] = Field(None, ge=0, description="Roll helper: full rolls received")
    loose_meters_received: Optional[Decimal] = Field(None, ge=0, description="Roll helper: loose meters received")
    unit_cost: Optional[Decimal] = Field(None, ge=0, description="Optional new buying cost price")
    note: Optional[str] = None


class BatchStockReceiveCreate(BaseModel):
    reference_id: Optional[str] = Field(None, max_length=100, description="Supplier Delivery Note # / PO # / Invoice #")
    supplier_name: Optional[str] = Field(None, max_length=150, description="Supplier / Vendor Business Name")
    note: Optional[str] = Field(None, description="General GRN remarks")
    items: List[BatchStockReceiveItem] = Field(..., min_length=1, description="List of delivered items")


class InventoryItemResponse(BaseModel):
    product_id: int
    product_name: str
    sku: Optional[str] = None
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
    stock_take_id: int
    product_id: int
    product_name: str
    product_sku: Optional[str] = None
    category_name: Optional[str] = None
    unit: str = "pcs"
    unit_type: str = "piece"
    meters_per_roll: Optional[Decimal] = None
    cost_price: Decimal = Decimal("0.00")
    expected_quantity: Decimal
    counted_quantity: Decimal
    variance: Decimal
    variance_value: Decimal = Decimal("0.00")
    is_counted: bool = False
    rolls_counted: Optional[int] = None
    loose_meters_counted: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)


class StockTakeCreate(BaseModel):
    notes: Optional[str] = None
    category_id: Optional[int] = None


class StockTakeSummaryResponse(BaseModel):
    id: int
    store_id: int
    user_id: int
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    total_items: int = 0
    counted_items: int = 0
    discrepancy_count: int = 0
    total_variance_value: Decimal = Decimal("0.00")

    model_config = ConfigDict(from_attributes=True)


class StockTakeItemsPaginatedResponse(BaseModel):
    items: List[StockTakeItemResponse]
    total: int
    limit: int
    offset: int
    has_more: bool
    total_items: int
    counted_items: int
    discrepancy_count: int
    total_variance_value: Decimal


class StockTakeResponse(BaseModel):
    id: int
    store_id: int
    user_id: int
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    total_items: int = 0
    counted_items: int = 0
    discrepancy_count: int = 0
    total_variance_value: Decimal = Decimal("0.00")
    items: List[StockTakeItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
