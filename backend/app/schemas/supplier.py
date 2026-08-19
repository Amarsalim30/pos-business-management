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
    supplier_name: Optional[str] = None
    po_id: Optional[int] = None
    user_id: int
    authorizer_name: Optional[str] = None
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
    id: str  # e.g. 'grn-2', 'payment-5'
    date: datetime
    type: str  # 'po', 'grn', 'payment', 'expense'
    reference: str
    debit: Decimal   # Payments reduce liability (Debit in vendor ledger)
    credit: Decimal  # Inbound GRNs increase liability (Credit in vendor ledger)
    running_balance: Decimal
    notes: Optional[str] = None
    grn_id: Optional[int] = None
    grn_no: Optional[str] = None
    payment_id: Optional[int] = None
    payment_method: Optional[str] = None
    po_id: Optional[int] = None
    po_no: Optional[str] = None
    items_count: Optional[int] = None
    items_summary: Optional[str] = None


class SupplierLedgerResponse(BaseModel):
    supplier_id: int
    supplier_name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_pin: Optional[str] = None
    current_balance: Decimal
    total_invoiced: Decimal = Decimal("0.00")
    total_paid: Decimal = Decimal("0.00")
    entries: List[SupplierLedgerEntry]


class SupplierSummaryResponse(BaseModel):
    total_suppliers: int
    active_suppliers: int
    total_payables_debt: Decimal
    suppliers_with_balance: int

