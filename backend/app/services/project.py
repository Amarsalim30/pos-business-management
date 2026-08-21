from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from fastapi import HTTPException, status

from app.models.project import Project, ProjectExpense, ProjectIncome
from app.models.product import Product
from app.models.sale import Customer
from app.models.inventory import Inventory, StockMovement
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectExpenseCreate,
    ProjectMaterialAllocationCreate, ProjectMaterialBatchAllocationCreate, ProjectIncomeCreate,
    ProjectResponse, ProjectDetailResponse, ProjectExpenseResponse,
    ProjectIncomeResponse, ProjectSummaryResponse
)
from app.utils.roll_conversion import roll_count_to_meters


def create_project(db: Session, store_id: int, user_id: int, project_in: ProjectCreate) -> Project:
    client_name = project_in.client_name.strip()
    client_phone = project_in.client_phone.strip() if project_in.client_phone else None

    # Auto-populate from registered customer if linked
    if project_in.customer_id:
        cust = db.query(Customer).filter(Customer.id == project_in.customer_id).first()
        if cust:
            if not client_name:
                client_name = cust.name
            if not client_phone and cust.phone:
                client_phone = cust.phone

    project = Project(
        store_id=store_id,
        name=project_in.name.strip(),
        client_name=client_name,
        client_phone=client_phone,
        customer_id=project_in.customer_id,
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
    if project_in.customer_id is not None:
        project.customer_id = project_in.customer_id
        if project_in.customer_id:
            cust = db.query(Customer).filter(Customer.id == project_in.customer_id).first()
            if cust:
                if not project_in.client_name:
                    project.client_name = cust.name
                if not project_in.client_phone and cust.phone:
                    project.client_phone = cust.phone
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



def delete_project(db: Session, store_id: int, project_id: int, user_id: Optional[int] = None) -> dict:
    project = get_project_by_id(db, store_id, project_id)

    # Return any allocated inventory materials back to store stock
    for expense in project.expenses:
        if expense.source == "inventory" and expense.product_id:
            product = db.query(Product).filter(Product.id == expense.product_id).first()
            if product:
                if product.unit_type == "roll" and expense.unit_sold == "roll":
                    meters_per_roll = Decimal(str(product.meters_per_roll or 100))
                    base_return = expense.quantity * meters_per_roll
                else:
                    base_return = expense.quantity

                inv = db.query(Inventory).filter(
                    Inventory.product_id == product.id,
                    Inventory.store_id == store_id
                ).first()

                if inv:
                    prev_qty = inv.quantity
                    inv.quantity += base_return
                    movement = StockMovement(
                        product_id=product.id,
                        store_id=store_id,
                        type="project_return",
                        quantity=base_return,
                        unit_sold=expense.unit_sold,
                        previous_quantity=prev_qty,
                        new_quantity=inv.quantity,
                        reference_id=f"PROJ-{project_id}",
                        note=f"Project #{project_id} deleted - material returned",
                        user_id=user_id or project.created_by
                    )
                    db.add(movement)

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


def allocate_project_materials_batch(
    db: Session, store_id: int, user_id: int, project_id: int, batch_in: ProjectMaterialBatchAllocationCreate
) -> List[ProjectExpense]:
    project = get_project_by_id(db, store_id, project_id)

    # 1. Pre-validate all products and inventory sufficiency
    product_demands = {}  # product_id -> total base units required
    validated_items = []

    for item in batch_in.items:
        product = db.query(Product).filter(Product.id == item.product_id, Product.store_id == store_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID #{item.product_id} not found in this store"
            )

        inv = db.query(Inventory).filter(
            Inventory.product_id == product.id,
            Inventory.store_id == store_id
        ).first()

        current_stock = inv.quantity if inv else Decimal("0.00")

        # Determine base stock deduction
        if product.unit_type == "roll":
            meters_per_roll = Decimal(str(product.meters_per_roll or 100))
            if item.unit_sold == "roll":
                base_qty = item.quantity * meters_per_roll
            else:
                base_qty = item.quantity
        else:
            base_qty = item.quantity

        product_demands[product.id] = product_demands.get(product.id, Decimal("0.00")) + base_qty
        validated_items.append((product, inv, current_stock, item, base_qty))

    # Check aggregated stock sufficiency
    for product_id, total_needed in product_demands.items():
        inv = db.query(Inventory).filter(
            Inventory.product_id == product_id,
            Inventory.store_id == store_id
        ).first()
        current_stock = inv.quantity if inv else Decimal("0.00")
        if current_stock < total_needed:
            prod_name = db.query(Product.name).filter(Product.id == product_id).scalar() or f"#{product_id}"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient inventory for {prod_name}. Available: {current_stock}, Required: {total_needed}"
            )

    # 2. Deduct inventory, log stock movement, create ProjectExpense and ProjectIncome atomically
    created_expenses = []

    for product, inv, _, item, base_qty in validated_items:
        if not inv:
            inv = Inventory(product_id=product.id, store_id=store_id, quantity=Decimal("0.00"))
            db.add(inv)

        prev_qty = inv.quantity
        inv.quantity -= base_qty
        new_qty = inv.quantity

        movement = StockMovement(
            product_id=product.id,
            store_id=store_id,
            type="project_out",
            quantity=base_qty,
            unit_sold=item.unit_sold,
            previous_quantity=prev_qty,
            new_quantity=new_qty,
            reference_id=f"PROJ-{project.id}",
            note=f"Batch allocation to project #{project.id} ({project.name})",
            user_id=user_id
        )
        db.add(movement)

        # Calculate cost price per unit
        if product.unit_type == "roll":
            meters_per_roll = Decimal(str(product.meters_per_roll or 100))
            if item.unit_sold == "roll":
                unit_cost = product.cost_price or (product.cost_per_meter * meters_per_roll if product.cost_per_meter else Decimal("0.00"))
            else:
                unit_cost = product.cost_per_meter or (product.cost_price / meters_per_roll if product.cost_price else Decimal("0.00"))
        else:
            unit_cost = product.cost_price or Decimal("0.00")

        total_cost = unit_cost * item.quantity
        total_billed = item.unit_price * item.quantity

        expense = ProjectExpense(
            project_id=project.id,
            source="inventory",
            category="materials",
            product_id=product.id,
            quantity=item.quantity,
            unit_sold=item.unit_sold,
            unit_price=item.unit_price,
            amount=total_billed,
            cost_price=unit_cost,
            cost_amount=total_cost,
            description=item.description or f"Material: {product.name}",
            date=datetime.now(timezone.utc),
            created_by=user_id
        )
        db.add(expense)
        created_expenses.append(expense)

        income = ProjectIncome(
            project_id=project.id,
            description=f"Materials: {product.name} ({item.quantity} {item.unit_sold})",
            amount=total_billed,
            source="materials",
            date=datetime.now(timezone.utc),
            created_by=user_id
        )
        db.add(income)

    db.commit()
    for exp in created_expenses:
        db.refresh(exp)

    return created_expenses


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
        customer_id=project.customer_id,
        customer_name=project.customer.name if project.customer else None,
        customer_phone=project.customer.phone if project.customer else None,
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


def delete_project_expense(
    db: Session, store_id: int, user_id: int, project_id: int, expense_id: int
) -> dict:
    get_project_by_id(db, store_id, project_id)
    expense = db.query(ProjectExpense).filter(
        ProjectExpense.id == expense_id,
        ProjectExpense.project_id == project_id
    ).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project expense not found")

    # If inventory material, return stock to inventory and log movement
    if expense.source == "inventory" and expense.product_id:
        product = db.query(Product).filter(Product.id == expense.product_id).first()
        if product:
            if product.unit_type == "roll" and expense.unit_sold == "roll":
                meters_per_roll = Decimal(str(product.meters_per_roll or 100))
                base_return = expense.quantity * meters_per_roll
            else:
                base_return = expense.quantity

            inv = db.query(Inventory).filter(
                Inventory.product_id == product.id,
                Inventory.store_id == store_id
            ).first()

            if inv:
                prev_qty = inv.quantity
                inv.quantity += base_return
                new_qty = inv.quantity

                movement = StockMovement(
                    product_id=product.id,
                    store_id=store_id,
                    type="project_return",
                    quantity=base_return,
                    unit_sold=expense.unit_sold,
                    previous_quantity=prev_qty,
                    new_quantity=new_qty,
                    reference_id=f"PROJ-{project_id}",
                    note=f"Material allocation deleted from project #{project_id}",
                    user_id=user_id
                )
                db.add(movement)

        # Remove companion material income entry
        companion_income = db.query(ProjectIncome).filter(
            ProjectIncome.project_id == project_id,
            ProjectIncome.source == "materials",
            ProjectIncome.amount == expense.amount
        ).first()
        if companion_income:
            db.delete(companion_income)

    db.delete(expense)
    db.commit()
    return {"detail": "Project expense removed successfully"}


def delete_project_income(
    db: Session, store_id: int, project_id: int, income_id: int
) -> dict:
    get_project_by_id(db, store_id, project_id)
    income = db.query(ProjectIncome).filter(
        ProjectIncome.id == income_id,
        ProjectIncome.project_id == project_id
    ).first()
    if not income:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project income not found")

    db.delete(income)
    db.commit()
    return {"detail": "Project income removed successfully"}

