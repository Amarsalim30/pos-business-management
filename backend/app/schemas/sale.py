from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


# =========================================================================
# Payment Schemas
# =========================================================================

class PaymentCreate(BaseModel):
    amount: Decimal = Field(..., gt=0)
    payment_method: str = Field("cash", max_length=30)  # 'cash', 'mpesa', 'card', 'bank', 'cheque'
    reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    sale_id: Optional[int] = None


class PaymentResponse(BaseModel):
    id: int
    sale_id: Optional[int] = None
    customer_id: Optional[int] = None
    amount: Decimal
    payment_method: str
    reference: Optional[str] = None
    notes: Optional[str] = None
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Backwards-compatible aliases
CustomerPaymentCreate = PaymentCreate
CustomerPaymentResponse = PaymentResponse


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


class CustomerLedgerEntry(BaseModel):
    id: str  # e.g. "sale-1" or "pay-2" or "void-1"
    date: datetime
    entry_type: str  # 'sale', 'payment', 'void'
    reference: str  # e.g. "INV-20260819-0041" or "Payment (M-Pesa)"
    site_name: Optional[str] = None
    notes: Optional[str] = None
    debit: Optional[Decimal] = None
    credit: Optional[Decimal] = None
    running_balance: Decimal
    sale_id: Optional[int] = None
    items_count: Optional[int] = None
    items_summary: Optional[str] = None
    payment_method: Optional[str] = None


class CustomerLedgerResponse(BaseModel):
    customer_id: int
    customer_name: str
    phone: Optional[str] = None
    total_debt: Decimal
    entries: List[CustomerLedgerEntry] = []


class CustomerSummaryResponse(BaseModel):
    total_customers: int
    active_customers: int
    total_receivables_debt: Decimal
    customers_with_debt: int



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
    payment_method: Optional[str] = "cash"  # 'cash', 'mpesa', 'card', 'bank', 'credit', 'split'
    payment_reference: Optional[str] = None
    payments: Optional[List[PaymentCreate]] = None  # Multiple split payments at checkout
    discount_amount: Decimal = Field(Decimal("0.00"), ge=0)
    is_etr: bool = False
    site_name: Optional[str] = None
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
    total_paid: Decimal = Decimal("0.00")
    balance_due: Decimal = Decimal("0.00")
    payment_method: str
    payment_reference: Optional[str] = None
    status: str  # computed status ('paid', 'partial', 'unpaid', 'voided')
    is_etr: bool
    site_name: Optional[str] = None
    notes: Optional[str] = None
    voided_at: Optional[datetime] = None
    void_reason: Optional[str] = None
    created_at: datetime
    items: List[SaleItemResponse] = []
    payments: List[PaymentResponse] = []

    model_config = ConfigDict(from_attributes=True)


class VoidSaleRequest(BaseModel):
    reason: Optional[str] = None


class SaleUpdate(BaseModel):
    customer_id: Optional[int] = None
    site_name: Optional[str] = None
    notes: Optional[str] = None
    discount_amount: Optional[Decimal] = Field(None, ge=0)
    is_etr: Optional[bool] = None
    payment_reference: Optional[str] = None
    items: Optional[List[SaleItemCreate]] = None



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
    site_name: Optional[str] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[PreSaleItemCreate] = Field(..., min_length=1)


class PreSaleDocumentUpdate(BaseModel):
    type: Optional[str] = None
    customer_id: Optional[int] = None
    discount_amount: Optional[Decimal] = Field(None, ge=0)
    site_name: Optional[str] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    items: Optional[List[PreSaleItemCreate]] = None



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
    site_name: Optional[str] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    converted_sale_id: Optional[int] = None
    created_at: datetime
    items: List[PreSaleItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
