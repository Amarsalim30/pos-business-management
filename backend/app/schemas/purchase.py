from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from decimal import Decimal


# --- Purchase Item ---
class PurchaseItemCreate(BaseModel):
    product_id: int
    unit_type: str = "piece"  # 'piece' | 'roll'
    ordered_qty: Decimal
    unit_cost: Decimal


class PurchaseItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    po_id: int
    product_id: int
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    unit_type: str
    ordered_qty: Decimal
    received_qty: Decimal
    unit_cost: Decimal
    total_cost: Decimal


# --- Purchase Expense ---
class PurchaseExpenseCreate(BaseModel):
    category: str = "transport"  # 'transport', 'labour', 'customs', 'other'
    description: Optional[str] = None
    amount: Decimal
    payment_method: str = "cash"
    reference: Optional[str] = None


class PurchaseExpenseUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[Decimal] = None
    payment_method: Optional[str] = None
    reference: Optional[str] = None


class PurchaseExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    po_id: Optional[int] = None
    grn_id: Optional[int] = None
    store_id: int
    user_id: int
    category: str
    description: str
    amount: Decimal
    payment_method: str
    reference: Optional[str] = None
    created_at: datetime


# --- Purchase Order ---
class PurchaseOrderCreate(BaseModel):
    supplier_id: int
    expected_delivery_date: Optional[date] = None
    is_etr: bool = False
    notes: Optional[str] = None
    items: List[PurchaseItemCreate]


class PurchaseOrderUpdate(BaseModel):
    supplier_id: Optional[int] = None
    expected_delivery_date: Optional[date] = None
    is_etr: Optional[bool] = None
    notes: Optional[str] = None
    items: Optional[List[PurchaseItemCreate]] = None


class PurchaseOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    po_no: str
    supplier_id: int
    supplier_name: Optional[str] = None
    user_id: int
    authorizer_name: Optional[str] = None
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    status: str
    is_etr: bool
    notes: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    created_at: datetime
    cancelled_at: Optional[datetime] = None
    items: List[PurchaseItemResponse] = []
    expenses: List[PurchaseExpenseResponse] = []


# --- Goods Received Note (GRN) ---
class GRNItemCreate(BaseModel):
    product_id: int
    unit_type: str = "piece"
    quantity_received: Optional[Decimal] = None  # base units (meters / pieces)
    rolls_received: Optional[int] = 0
    loose_meters_received: Optional[Decimal] = Decimal("0.00")
    unit_cost: Decimal = Decimal("0.00")


class GRNItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    grn_id: int
    product_id: int
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    unit: Optional[str] = None
    meters_per_roll: Optional[Decimal] = None
    unit_type: str
    quantity_received: Decimal
    rolls_received: int
    loose_meters_received: Decimal
    unit_cost: Decimal
    total_cost: Decimal


class GRNCreate(BaseModel):
    po_id: Optional[int] = None
    supplier_id: Optional[int] = None
    invoice_number: Optional[str] = None
    notes: Optional[str] = None
    items: List[GRNItemCreate]
    expenses: Optional[List[PurchaseExpenseCreate]] = []


class GRNUpdate(BaseModel):
    invoice_number: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[List[GRNItemCreate]] = None


class GRNResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    grn_no: str
    po_id: Optional[int] = None
    po_no: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    user_id: int
    receiver_name: Optional[str] = None
    invoice_number: Optional[str] = None
    delivery_date: datetime
    total_amount: Decimal
    total_expenses: Decimal = Decimal("0.00")
    landed_cost: Decimal = Decimal("0.00")
    notes: Optional[str] = None
    created_at: datetime
    items: List[GRNItemResponse] = []
    expenses: List[PurchaseExpenseResponse] = []
