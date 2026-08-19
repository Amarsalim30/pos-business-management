from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    name = Column(String(100), nullable=False, index=True)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(30), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    tax_pin = Column(String(30), nullable=True)
    balance = Column(Numeric(12, 2), default=0.00, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    store = relationship("Store")
    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")
    payments = relationship("SupplierPayment", back_populates="supplier", cascade="all, delete-orphan")


class SupplierPayment(Base):
    __tablename__ = "supplier_payments"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    po_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(30), nullable=False)  # 'bank', 'mpesa', 'cash', 'cheque'
    reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    supplier = relationship("Supplier", back_populates="payments")
    store = relationship("Store")
    user = relationship("User")
    purchase_order = relationship("PurchaseOrder")
