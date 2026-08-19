from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from decimal import Decimal


class SupplierBase(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    tax_pin: Optional[str] = None


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    tax_pin: Optional[str] = None
    is_active: Optional[bool] = None


class SupplierPaymentCreate(BaseModel):
    amount: Decimal
    payment_method: str = "bank"  # 'bank', 'mpesa', 'cash', 'cheque'
    reference: Optional[str] = None
    notes: Optional[str] = None
    po_id: Optional[int] = None


class SupplierPaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    supplier_id: int
    po_id: Optional[int] = None
    user_id: int
    amount: Decimal
    payment_method: str
    reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class SupplierResponse(SupplierBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    balance: Decimal
    is_active: bool
    created_at: datetime


class SupplierLedgerEntry(BaseModel):
    date: datetime
    type: str  # 'po', 'grn', 'payment', 'expense'
    reference: str
    debit: Decimal   # Payments reduce liability (Debit in vendor ledger)
    credit: Decimal  # Inbound GRNs increase liability (Credit in vendor ledger)
    running_balance: Decimal
    notes: Optional[str] = None


class SupplierLedgerResponse(BaseModel):
    supplier_id: int
    supplier_name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    current_balance: Decimal
    entries: List[SupplierLedgerEntry]
