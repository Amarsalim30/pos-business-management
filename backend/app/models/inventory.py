from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, UniqueConstraint, Boolean, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    quantity = Column(Numeric(12, 2), default=0.00, nullable=False)  # Base decimal: meters for rolls, units for pieces
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("product_id", "store_id", name="uq_product_store"),
    )

    product = relationship("Product", back_populates="inventory")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    type = Column(String(30), nullable=False)  # 'in', 'sale', 'adjust', 'void_return', 'project_allocation', 'stock_take'
    quantity = Column(Numeric(12, 2), nullable=False)  # Positive or negative delta in base units
    unit_sold = Column(String(20), nullable=True)  # 'piece', 'roll', 'meter'
    previous_quantity = Column(Numeric(12, 2), nullable=False)
    new_quantity = Column(Numeric(12, 2), nullable=False)
    reference_id = Column(String(100), nullable=True)  # Invoice #, PO #, StockTake ID, etc.
    note = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    product = relationship("Product", back_populates="movements")
    user = relationship("User")


class StockTake(Base):
    __tablename__ = "stock_takes"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # Null = whole store, set = cycle count
    status = Column(String(20), default="in_progress", nullable=False)  # 'in_progress', 'completed', 'cancelled'
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)

    items = relationship("StockTakeItem", back_populates="stock_take", cascade="all, delete-orphan")
    user = relationship("User")
    category = relationship("Category")


class StockTakeItem(Base):
    __tablename__ = "stock_take_items"

    id = Column(Integer, primary_key=True, index=True)
    stock_take_id = Column(Integer, ForeignKey("stock_takes.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    expected_quantity = Column(Numeric(12, 2), nullable=False)
    counted_quantity = Column(Numeric(12, 2), nullable=False)
    variance = Column(Numeric(12, 2), nullable=False)  # counted - expected
    is_counted = Column(Boolean, default=False, nullable=False, index=True)
    rolls_counted = Column(Integer, nullable=True)
    loose_meters_counted = Column(Numeric(10, 2), nullable=True)

    __table_args__ = (
        Index("idx_st_items_st_prod", "stock_take_id", "product_id"),
        Index("idx_st_items_st_var", "stock_take_id", "variance"),
        Index("idx_st_items_st_counted", "stock_take_id", "is_counted"),
    )

    stock_take = relationship("StockTake", back_populates="items")
    product = relationship("Product")
