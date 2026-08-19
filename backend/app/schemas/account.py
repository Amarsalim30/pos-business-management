from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class PettyCashCreate(BaseModel):
    description: str = Field(..., min_length=1)
    amount: Decimal = Field(..., gt=0)
    type: str = Field("out", pattern="^(in|out)$")
    category: Optional[str] = "general"  # 'office', 'transport', 'tea_snacks', 'cleaning', 'repairs', 'general', 'float_deposit'
    receipt_no: Optional[str] = None
    date: Optional[datetime] = None


class PettyCashResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    date: datetime
    description: str
    amount: Decimal
    type: str
    category: Optional[str] = None
    receipt_no: Optional[str] = None
    user_id: int
    user_name: Optional[str] = None
    created_at: datetime


class PettyCashSummaryResponse(BaseModel):
    total_in: Decimal
    total_out: Decimal
    balance: Decimal
    entries_count: int


class BankAccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    bank_name: str = Field(..., min_length=1, max_length=100)
    account_number: str = Field(..., min_length=1, max_length=100)
    initial_balance: Decimal = Field(default=Decimal("0.00"), ge=0)


class BankAccountUpdate(BaseModel):
    name: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    is_active: Optional[bool] = None


class BankTransactionCreate(BaseModel):
    amount: Decimal = Field(..., gt=0)
    type: str = Field("deposit", pattern="^(deposit|withdrawal)$")
    description: str = Field(..., min_length=1)
    reference: Optional[str] = None
    date: Optional[datetime] = None


class BankTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    bank_account_id: int
    date: datetime
    description: str
    amount: Decimal
    type: str
    reference: Optional[str] = None
    user_id: int
    user_name: Optional[str] = None
    created_at: datetime


class BankAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    name: str
    bank_name: str
    account_number: str
    balance: Decimal
    is_active: bool
    created_at: datetime


class BankAccountDetailResponse(BankAccountResponse):
    transactions: List[BankTransactionResponse] = []


class MpesaIncomeCreate(BaseModel):
    description: str = Field(..., min_length=1)
    amount: Decimal = Field(..., gt=0)
    reference: Optional[str] = None
    date: Optional[datetime] = None


class MpesaIncomeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    date: datetime
    description: str
    amount: Decimal
    reference: Optional[str] = None
    user_id: int
    user_name: Optional[str] = None
    created_at: datetime


class AccountsOverviewResponse(BaseModel):
    petty_cash_balance: Decimal
    total_bank_balances: Decimal
    total_mpesa_commission: Decimal
    active_bank_accounts: int
