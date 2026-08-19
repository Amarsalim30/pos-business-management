from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from fastapi import HTTPException, status

from app.models.project import Project, ProjectExpense, ProjectIncome
from app.models.product import Product
from app.models.inventory import Inventory, StockMovement
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectExpenseCreate,
    ProjectMaterialAllocationCreate, ProjectIncomeCreate,
    ProjectResponse, ProjectDetailResponse, ProjectExpenseResponse,
    ProjectIncomeResponse, ProjectSummaryResponse
)
from app.utils.roll_conversion import roll_count_to_meters


def create_project(db: Session, store_id: int, user_id: int, project_in: ProjectCreate) -> Project:
    project = Project(
        store_id=store_id,
        name=project_in.name.strip(),
        client_name=project_in.client_name.strip(),
        client_phone=project_in.client_phone.strip() if project_in.client_phone else None,
        description=project_in.description.strip() if project_in.description else None,
        quoted_amount=project_in.quoted_amount,
        start_date=project_in.start_date,
        end_date=project_in.end_date,
        status=project_in.status,
        created_by=user_id
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_project_by_id(db: Session, store_id: int, project_id: int) -> Project:
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.store_id == store_id
    ).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def list_projects(
    db: Session,
    store_id: int,
    status_filter: Optional[str] = None,
    q: Optional[str] = None,
    limit: Optional[int] = None,
    offset: int = 0
) -> List[Project]:
    query = db.query(Project).filter(Project.store_id == store_id)

    if status_filter and status_filter != "all":
        query = query.filter(Project.status == status_filter)

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            (Project.name.ilike(term)) |
            (Project.client_name.ilike(term)) |
            (Project.client_phone.ilike(term))
        )

    query = query.order_by(desc(Project.created_at))
    if limit is not None:
        query = query.offset(offset).limit(limit)
    return query.all()


def update_project(db: Session, store_id: int, project_id: int, project_in: ProjectUpdate) -> Project:
    project = get_project_by_id(db, store_id, project_id)

    if project_in.name is not None:
        project.name = project_in.name.strip()
    if project_in.client_name is not None:
        project.client_name = project_in.client_name.strip()
    if project_in.client_phone is not None:
        project.client_phone = project_in.client_phone.strip() if project_in.client_phone else None
    if project_in.description is not None:
        project.description = project_in.description.strip() if project_in.description else None
    if project_in.quoted_amount is not None:
        project.quoted_amount = project_in.quoted_amount
    if project_in.start_date is not None:
        project.start_date = project_in.start_date
    if project_in.end_date is not None:
        project.end_date = project_in.end_date
    if project_in.status is not None:
        project.status = project_in.status

    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, store_id: int, project_id: int) -> dict:
    project = get_project_by_id(db, store_id, project_id)
    db.delete(project)
    db.commit()
    return {"detail": "Project deleted successfully"}


def allocate_project_material(
    db: Session, store_id: int, user_id: int, project_id: int, alloc_in: ProjectMaterialAllocationCreate
) -> ProjectExpense:
    project = get_project_by_id(db, store_id, project_id)
    product = db.query(Product).filter(Product.id == alloc_in.product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    # Determine base deduction quantity
    if product.unit_type == "roll":
        meters_per_roll = Decimal(str(product.meters_per_roll or 100))
        if alloc_in.unit_sold == "roll":
            base_deduct = alloc_in.quantity * meters_per_roll
        else:
            base_deduct = alloc_in.quantity
    else:
        base_deduct = alloc_in.quantity

    # Fetch and verify inventory
    inv = db.query(Inventory).filter(
        Inventory.product_id == product.id,
        Inventory.store_id == store_id
    ).first()

    if not inv or inv.quantity < base_deduct:
        avail = inv.quantity if inv else Decimal("0.00")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient inventory for {product.name}. Available: {avail}, Requested: {base_deduct}"
        )

    prev_qty = inv.quantity
    inv.quantity -= base_deduct
    new_qty = inv.quantity

    # Log stock movement
    movement = StockMovement(
        product_id=product.id,
        store_id=store_id,
        type="project_allocation",
        quantity=-base_deduct,
        unit_sold=alloc_in.unit_sold,
        previous_quantity=prev_qty,
        new_quantity=new_qty,
        reference_id=f"PROJ-{project.id}",
        note=f"Allocated to project: {project.name}",
        user_id=user_id
    )
    db.add(movement)

    # Calculate financial values
    unit_cost = product.cost_price or Decimal("0.00")
    total_cost = unit_cost * alloc_in.quantity
    total_billed = alloc_in.unit_price * alloc_in.quantity

    expense = ProjectExpense(
        project_id=project.id,
        source="inventory",
        category="materials",
        product_id=product.id,
        quantity=alloc_in.quantity,
        unit_sold=alloc_in.unit_sold,
        unit_price=alloc_in.unit_price,
        amount=total_billed,
        cost_price=unit_cost,
        cost_amount=total_cost,
        description=alloc_in.description or f"Material: {product.name}",
        date=datetime.now(timezone.utc),
        created_by=user_id
    )
    db.add(expense)

    # Auto-create material income
    income = ProjectIncome(
        project_id=project.id,
        description=f"Materials: {product.name} ({alloc_in.quantity} {alloc_in.unit_sold})",
        amount=total_billed,
        source="materials",
        date=datetime.now(timezone.utc),
        created_by=user_id
    )
    db.add(income)

    db.commit()
    db.refresh(expense)
    return expense


def add_project_expense(
    db: Session, store_id: int, user_id: int, project_id: int, exp_in: ProjectExpenseCreate
) -> ProjectExpense:
    project = get_project_by_id(db, store_id, project_id)

    expense = ProjectExpense(
        project_id=project.id,
        source="external",
        category=exp_in.category,
        amount=exp_in.amount,
        cost_amount=exp_in.amount,
        description=exp_in.description,
        vendor=exp_in.vendor,
        receipt_no=exp_in.receipt_no,
        date=exp_in.date or datetime.now(timezone.utc),
        created_by=user_id
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


def add_project_income(
    db: Session, store_id: int, user_id: int, project_id: int, inc_in: ProjectIncomeCreate
) -> ProjectIncome:
    project = get_project_by_id(db, store_id, project_id)

    income = ProjectIncome(
        project_id=project.id,
        description=inc_in.description,
        amount=inc_in.amount,
        source=inc_in.source,
        payment_method=inc_in.payment_method,
        reference=inc_in.reference,
        date=inc_in.date or datetime.now(timezone.utc),
        created_by=user_id
    )
    db.add(income)
    db.commit()
    db.refresh(income)
    return income


def format_project_detail(project: Project) -> ProjectDetailResponse:
    expenses_res = []
    materials_cost = Decimal("0.00")
    materials_billed = Decimal("0.00")
    external_expenses = Decimal("0.00")

    for e in project.expenses:
        if e.source == "inventory":
            materials_cost += (e.cost_amount or Decimal("0.00"))
            materials_billed += (e.amount or Decimal("0.00"))
        else:
            external_expenses += (e.amount or Decimal("0.00"))

        expenses_res.append(ProjectExpenseResponse(
            id=e.id,
            project_id=e.project_id,
            source=e.source,
            category=e.category,
            product_id=e.product_id,
            product_name=e.product.name if e.product else None,
            quantity=e.quantity,
            unit_sold=e.unit_sold,
            unit_price=e.unit_price,
            amount=e.amount,
            cost_price=e.cost_price,
            cost_amount=e.cost_amount,
            description=e.description,
            vendor=e.vendor,
            receipt_no=e.receipt_no,
            date=e.date,
            created_by=e.created_by,
            creator_name=e.creator.full_name if e.creator else None,
            created_at=e.created_at
        ))

    incomes_res = []
    total_income = Decimal("0.00")
    client_payments = Decimal("0.00")

    for i in project.incomes:
        total_income += i.amount
        if i.source == "client_payment":
            client_payments += i.amount

        incomes_res.append(ProjectIncomeResponse(
            id=i.id,
            project_id=i.project_id,
            description=i.description,
            amount=i.amount,
            source=i.source,
            payment_method=i.payment_method,
            reference=i.reference,
            date=i.date,
            created_by=i.created_by,
            creator_name=i.creator.full_name if i.creator else None,
            created_at=i.created_at
        ))

    # Total cost = actual store costs (materials_cost + external_expenses)
    total_cost = materials_cost + external_expenses
    materials_profit = materials_billed - materials_cost
    net_profit = total_income - total_cost

    return ProjectDetailResponse(
        id=project.id,
        store_id=project.store_id,
        name=project.name,
        client_name=project.client_name,
        client_phone=project.client_phone,
        description=project.description,
        quoted_amount=project.quoted_amount,
        start_date=project.start_date,
        end_date=project.end_date,
        status=project.status,
        created_by=project.created_by,
        creator_name=project.creator.full_name if project.creator else None,
        created_at=project.created_at,
        updated_at=project.updated_at,
        total_income=total_income,
        total_expenses=total_cost,
        net_profit=net_profit,
        expenses=expenses_res,
        incomes=incomes_res,
        materials_cost=materials_cost,
        materials_billed=materials_billed,
        materials_profit=materials_profit,
        external_expenses_total=external_expenses,
        client_payments_total=client_payments
    )


def get_projects_summary(db: Session, store_id: int) -> ProjectSummaryResponse:
    total_projects = db.query(func.count(Project.id)).filter(Project.store_id == store_id).scalar() or 0
    active_projects = db.query(func.count(Project.id)).filter(Project.store_id == store_id, Project.status == "active").scalar() or 0
    completed_projects = db.query(func.count(Project.id)).filter(Project.store_id == store_id, Project.status == "completed").scalar() or 0
    total_quoted = db.query(func.coalesce(func.sum(Project.quoted_amount), Decimal("0.00"))).filter(Project.store_id == store_id).scalar() or Decimal("0.00")

    # Aggregate incomes across store projects
    total_income = db.query(func.coalesce(func.sum(ProjectIncome.amount), Decimal("0.00"))).join(
        Project, ProjectIncome.project_id == Project.id
    ).filter(Project.store_id == store_id).scalar() or Decimal("0.00")

    # Aggregate actual cost amount across store projects
    total_cost = db.query(func.coalesce(func.sum(ProjectExpense.cost_amount), Decimal("0.00"))).join(
        Project, ProjectExpense.project_id == Project.id
    ).filter(Project.store_id == store_id).scalar() or Decimal("0.00")

    net_profit = total_income - total_cost

    return ProjectSummaryResponse(
        total_projects=total_projects,
        active_projects=active_projects,
        completed_projects=completed_projects,
        total_quoted_value=Decimal(str(total_quoted)),
        total_project_income=Decimal(str(total_income)),
        total_project_cost=Decimal(str(total_cost)),
        total_net_profit=Decimal(str(net_profit))
    )
