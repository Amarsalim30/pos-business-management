from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user, require_staff
from app.models.user import User
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectDetailResponse,
    ProjectExpenseCreate, ProjectExpenseResponse,
    ProjectMaterialAllocationCreate,
    ProjectIncomeCreate, ProjectIncomeResponse, ProjectSummaryResponse
)
from app.services import project as project_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/summary", response_model=ProjectSummaryResponse)
def get_projects_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    return project_service.get_projects_summary(db, target_store_id)


@router.get("/", response_model=List[ProjectResponse])
def get_projects(
    status: Optional[str] = None,
    q: Optional[str] = None,
    limit: Optional[int] = None,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    projects = project_service.list_projects(
        db, target_store_id, status_filter=status, q=q, limit=limit, offset=offset
    )
    return [project_service.format_project_detail(p) for p in projects]


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    project = project_service.create_project(db, target_store_id, current_user.id, project_in)
    return project_service.format_project_detail(project)


@router.get("/{project_id}", response_model=ProjectDetailResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_store_id = current_user.store_id or 1
    project = project_service.get_project_by_id(db, target_store_id, project_id)
    return project_service.format_project_detail(project)


@router.put("/{project_id}", response_model=ProjectDetailResponse)
def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    project = project_service.update_project(db, target_store_id, project_id, project_in)
    return project_service.format_project_detail(project)


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    return project_service.delete_project(db, target_store_id, project_id)


@router.post("/{project_id}/materials", response_model=ProjectExpenseResponse, status_code=status.HTTP_201_CREATED)
def allocate_materials(
    project_id: int,
    alloc_in: ProjectMaterialAllocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    expense = project_service.allocate_project_material(
        db, target_store_id, current_user.id, project_id, alloc_in
    )
    return ProjectExpenseResponse(
        id=expense.id,
        project_id=expense.project_id,
        source=expense.source,
        category=expense.category,
        product_id=expense.product_id,
        product_name=expense.product.name if expense.product else None,
        quantity=expense.quantity,
        unit_sold=expense.unit_sold,
        unit_price=expense.unit_price,
        amount=expense.amount,
        cost_price=expense.cost_price,
        cost_amount=expense.cost_amount,
        description=expense.description,
        vendor=expense.vendor,
        receipt_no=expense.receipt_no,
        date=expense.date,
        created_by=expense.created_by,
        creator_name=current_user.full_name,
        created_at=expense.created_at
    )


@router.post("/{project_id}/expenses", response_model=ProjectExpenseResponse, status_code=status.HTTP_201_CREATED)
def add_expense(
    project_id: int,
    exp_in: ProjectExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    expense = project_service.add_project_expense(
        db, target_store_id, current_user.id, project_id, exp_in
    )
    return ProjectExpenseResponse(
        id=expense.id,
        project_id=expense.project_id,
        source=expense.source,
        category=expense.category,
        amount=expense.amount,
        cost_amount=expense.cost_amount,
        description=expense.description,
        vendor=expense.vendor,
        receipt_no=expense.receipt_no,
        date=expense.date,
        created_by=expense.created_by,
        creator_name=current_user.full_name,
        created_at=expense.created_at
    )


@router.post("/{project_id}/incomes", response_model=ProjectIncomeResponse, status_code=status.HTTP_201_CREATED)
def add_income(
    project_id: int,
    inc_in: ProjectIncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    target_store_id = current_user.store_id or 1
    income = project_service.add_project_income(
        db, target_store_id, current_user.id, project_id, inc_in
    )
    return ProjectIncomeResponse(
        id=income.id,
        project_id=income.project_id,
        description=income.description,
        amount=income.amount,
        source=income.source,
        payment_method=income.payment_method,
        reference=income.reference,
        date=income.date,
        created_by=income.created_by,
        creator_name=current_user.full_name,
        created_at=income.created_at
    )
