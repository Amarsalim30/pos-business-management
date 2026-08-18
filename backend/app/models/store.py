from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    address = Column(Text, nullable=True)
    phone = Column(String(30), nullable=True)
    tax_id = Column(String(50), nullable=True)
    vat_rate = Column(Numeric(5, 4), default=0.1600, nullable=False)  # 16% standard VAT
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    users = relationship("User", back_populates="store")
    recurring_expenses = relationship("RecurringExpense", back_populates="store", cascade="all, delete-orphan")


class RecurringExpense(Base):
    __tablename__ = "recurring_expenses"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    name = Column(String(100), nullable=False)  # e.g., "Rent", "John Payroll"
    amount = Column(Numeric(12, 2), nullable=False)
    category = Column(String(30), nullable=False)  # "rent" | "payroll" | "other"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    store = relationship("Store", back_populates="recurring_expenses")
