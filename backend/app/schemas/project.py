from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    client_name: str = Field(..., min_length=1, max_length=200)
    client_phone: Optional[str] = None
    description: Optional[str] = None
    quoted_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: str = "active"  # 'active', 'completed', 'cancelled'


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    description: Optional[str] = None
    quoted_amount: Optional[Decimal] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None


class ProjectExpenseCreate(BaseModel):
    source: str = "external"  # 'external'
    category: str = "labor"  # 'labor', 'transport', 'subcontract', 'materials', 'other'
    amount: Decimal = Field(..., gt=0)
    description: Optional[str] = None
    vendor: Optional[str] = None
    receipt_no: Optional[str] = None
    date: Optional[datetime] = None


class ProjectMaterialAllocationCreate(BaseModel):
    product_id: int
    unit_sold: str = "piece"  # 'piece', 'roll', 'meter'
    quantity: Decimal = Field(..., gt=0)  # Count of pieces, rolls, or meters
    unit_price: Decimal = Field(..., ge=0)  # Billed unit price to client
    description: Optional[str] = None


class ProjectExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    source: str
    category: str
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_sold: Optional[str] = None
    unit_price: Optional[Decimal] = None
    amount: Decimal
    cost_price: Optional[Decimal] = None
    cost_amount: Optional[Decimal] = None
    description: Optional[str] = None
    vendor: Optional[str] = None
    receipt_no: Optional[str] = None
    date: datetime
    created_by: int
    creator_name: Optional[str] = None
    created_at: datetime


class ProjectIncomeCreate(BaseModel):
    description: str
    amount: Decimal = Field(..., gt=0)
    source: str = "client_payment"  # 'client_payment'
    payment_method: str = "cash"  # 'cash', 'mpesa', 'bank', 'other'
    reference: Optional[str] = None
    date: Optional[datetime] = None


class ProjectIncomeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    description: str
    amount: Decimal
    source: str
    payment_method: Optional[str] = None
    reference: Optional[str] = None
    date: datetime
    created_by: int
    creator_name: Optional[str] = None
    created_at: datetime


class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    created_by: int
    creator_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    total_income: Decimal = Decimal("0.00")
    total_expenses: Decimal = Decimal("0.00")
    net_profit: Decimal = Decimal("0.00")


class ProjectDetailResponse(ProjectResponse):
    expenses: List[ProjectExpenseResponse] = []
    incomes: List[ProjectIncomeResponse] = []
    materials_cost: Decimal = Decimal("0.00")
    materials_billed: Decimal = Decimal("0.00")
    materials_profit: Decimal = Decimal("0.00")
    external_expenses_total: Decimal = Decimal("0.00")
    client_payments_total: Decimal = Decimal("0.00")


class ProjectSummaryResponse(BaseModel):
    total_projects: int
    active_projects: int
    completed_projects: int
    total_quoted_value: Decimal
    total_project_income: Decimal
    total_project_cost: Decimal
    total_net_profit: Decimal
