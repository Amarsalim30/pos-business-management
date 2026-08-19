from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    name = Column(String(200), nullable=False, index=True)
    client_name = Column(String(200), nullable=False)
    client_phone = Column(String(50), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    description = Column(Text, nullable=True)
    quoted_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    status = Column(String(20), default="active", nullable=False)  # 'draft', 'active', 'commissioning', 'completed', 'cancelled'
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    store = relationship("Store")
    customer = relationship("Customer")
    creator = relationship("User", foreign_keys=[created_by])
    expenses = relationship("ProjectExpense", back_populates="project", cascade="all, delete-orphan")
    incomes = relationship("ProjectIncome", back_populates="project", cascade="all, delete-orphan")



class ProjectExpense(Base):
    __tablename__ = "project_expenses"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    source = Column(String(20), nullable=False)  # 'inventory' or 'external'
    category = Column(String(50), nullable=False)  # 'labor', 'materials', 'transport', 'subcontract', 'other'
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Numeric(12, 2), nullable=True)
    unit_sold = Column(String(20), nullable=True)  # 'piece', 'roll', 'meter'
    unit_price = Column(Numeric(12, 2), nullable=True)  # Client billed unit price (SP)
    amount = Column(Numeric(12, 2), nullable=False)  # Total client charge for item or external expense cost
    cost_price = Column(Numeric(12, 2), nullable=True)  # Store buying price (BP) snapshot
    cost_amount = Column(Numeric(12, 2), nullable=True)  # Actual cost to store (cost_price * quantity)
    description = Column(Text, nullable=True)
    vendor = Column(String(200), nullable=True)
    receipt_no = Column(String(100), nullable=True)
    date = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    project = relationship("Project", back_populates="expenses")
    product = relationship("Product")
    creator = relationship("User", foreign_keys=[created_by])


class ProjectIncome(Base):
    __tablename__ = "project_incomes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    description = Column(Text, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    source = Column(String(30), nullable=False)  # 'client_payment' or 'materials'
    payment_method = Column(String(30), default="cash", nullable=True)  # 'cash', 'mpesa', 'bank', 'other'
    reference = Column(String(100), nullable=True)
    date = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    project = relationship("Project", back_populates="incomes")
    creator = relationship("User", foreign_keys=[created_by])
