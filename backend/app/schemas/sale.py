from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


# =========================================================================
# Customer Schemas
# =========================================================================

class CustomerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    is_active: Optional[bool] = None


class CustomerResponse(CustomerBase):
    id: int
    balance: Decimal
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerPaymentCreate(BaseModel):
    amount: Decimal = Field(..., gt=0)
    payment_method: str = Field("cash", max_length=30)  # 'cash', 'mpesa', 'bank', 'cheque'
    reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class CustomerPaymentResponse(BaseModel):
    id: int
    customer_id: int
    amount: Decimal
    payment_method: str
    reference: Optional[str] = None
    notes: Optional[str] = None
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================================================================
# Sale & Line Item Schemas
# =========================================================================

class SaleItemCreate(BaseModel):
    product_id: int
    unit_type: str = Field("piece")  # 'piece' or 'roll'
    unit_sold: str = Field("piece")  # 'piece', 'roll', 'meter'
    quantity: Optional[Decimal] = None  # Base units (meters for rolls, pieces for piece items)
    rolls_qty: Optional[int] = Field(None, ge=0)
    loose_meters: Optional[Decimal] = Field(None, ge=0)
    unit_price: Decimal = Field(..., ge=0)


class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    sku: Optional[str] = None
    unit_type: str
    unit_sold: str
    quantity: Decimal
    rolls_qty: Optional[int] = None
    loose_meters: Optional[Decimal] = None
    unit_price: Decimal
    cost_price: Decimal
    tax_rate: Decimal
    total: Decimal

    model_config = ConfigDict(from_attributes=True)


class SaleCreate(BaseModel):
    customer_id: Optional[int] = None
    payment_method: str = Field("cash")  # 'cash', 'mpesa', 'card', 'bank', 'credit'
    payment_reference: Optional[str] = None
    discount_amount: Decimal = Field(Decimal("0.00"), ge=0)
    is_etr: bool = False
    notes: Optional[str] = None
    items: List[SaleItemCreate] = Field(..., min_length=1)


class SaleResponse(BaseModel):
    id: int
    invoice_no: str
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    store_id: int
    user_id: int
    cashier_name: Optional[str] = None
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    payment_method: str
    payment_reference: Optional[str] = None
    status: str
    is_etr: bool
    notes: Optional[str] = None
    created_at: datetime
    items: List[SaleItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class VoidSaleRequest(BaseModel):
    reason: Optional[str] = None


# =========================================================================
# Pre-Sale Document Schemas (Quotations & Proformas)
# =========================================================================

class PreSaleItemCreate(BaseModel):
    product_id: int
    unit_type: str = Field("piece")
    unit_sold: str = Field("piece")
    quantity: Optional[Decimal] = None
    rolls_qty: Optional[int] = Field(None, ge=0)
    loose_meters: Optional[Decimal] = Field(None, ge=0)
    unit_price: Decimal = Field(..., ge=0)


class PreSaleItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    sku: Optional[str] = None
    unit_type: str
    unit_sold: str
    quantity: Decimal
    rolls_qty: Optional[int] = None
    loose_meters: Optional[Decimal] = None
    unit_price: Decimal
    tax_rate: Decimal
    total: Decimal

    model_config = ConfigDict(from_attributes=True)


class PreSaleDocumentCreate(BaseModel):
    type: str = Field("quotation")  # 'quotation' or 'proforma'
    customer_id: Optional[int] = None
    discount_amount: Decimal = Field(Decimal("0.00"), ge=0)
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[PreSaleItemCreate] = Field(..., min_length=1)


class PreSaleDocumentResponse(BaseModel):
    id: int
    document_no: str
    type: str
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    store_id: int
    user_id: int
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    status: str
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    converted_sale_id: Optional[int] = None
    created_at: datetime
    items: List[PreSaleItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
