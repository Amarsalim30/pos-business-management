from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    po_no = Column(String(50), unique=True, nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    tax_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), default="ordered", nullable=False)  # 'draft', 'ordered', 'partial', 'received', 'cancelled'
    is_etr = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    expected_delivery_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    cancelled_at = Column(DateTime, nullable=True)

    supplier = relationship("Supplier", back_populates="purchase_orders")
    user = relationship("User")
    store = relationship("Store")
    items = relationship("PurchaseItem", back_populates="purchase_order", cascade="all, delete-orphan")
    expenses = relationship("PurchaseExpense", back_populates="purchase_order", cascade="all, delete-orphan")
    goods_received_notes = relationship("GoodsReceivedNote", back_populates="purchase_order")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id = Column(Integer, primary_key=True, index=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    unit_type = Column(String(20), default="piece", nullable=False)  # 'piece' | 'roll'
    ordered_qty = Column(Numeric(12, 2), nullable=False)  # meters for rolls, units for pieces
    received_qty = Column(Numeric(12, 2), default=0.00, nullable=False)
    unit_cost = Column(Numeric(12, 2), nullable=False)
    total_cost = Column(Numeric(12, 2), nullable=False)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    product = relationship("Product")


class PurchaseExpense(Base):
    __tablename__ = "purchase_expenses"

    id = Column(Integer, primary_key=True, index=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(String(30), default="transport", nullable=False)  # 'transport', 'labour', 'customs', 'other'
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(30), default="cash", nullable=False)
    reference = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    purchase_order = relationship("PurchaseOrder", back_populates="expenses")
    user = relationship("User")
    store = relationship("Store")


class GoodsReceivedNote(Base):
    __tablename__ = "goods_received_notes"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    grn_no = Column(String(50), unique=True, nullable=False, index=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invoice_number = Column(String(100), nullable=True)  # Supplier delivery / invoice #
    delivery_date = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    total_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    purchase_order = relationship("PurchaseOrder", back_populates="goods_received_notes")
    supplier = relationship("Supplier")
    user = relationship("User")
    store = relationship("Store")
    items = relationship("GoodsReceivedItem", back_populates="grn", cascade="all, delete-orphan")


class GoodsReceivedItem(Base):
    __tablename__ = "goods_received_items"

    id = Column(Integer, primary_key=True, index=True)
    grn_id = Column(Integer, ForeignKey("goods_received_notes.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    unit_type = Column(String(20), default="piece", nullable=False)
    quantity_received = Column(Numeric(12, 2), nullable=False)  # base units (meters / pieces)
    rolls_received = Column(Integer, default=0, nullable=False)
    loose_meters_received = Column(Numeric(12, 2), default=0.00, nullable=False)
    unit_cost = Column(Numeric(12, 2), nullable=False)
    total_cost = Column(Numeric(12, 2), nullable=False)

    grn = relationship("GoodsReceivedNote", back_populates="items")
    product = relationship("Product")
