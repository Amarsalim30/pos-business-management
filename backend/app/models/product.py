from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, Text, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    parent = relationship("Category", remote_side=[id], backref="subcategories")
    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    sku = Column(String(50), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    unit = Column(String(20), default="pcs", nullable=False)  # 'pcs', 'meters', 'kg', 'set'
    unit_type = Column(String(20), default="piece", nullable=False)  # 'piece' | 'roll'
    meters_per_roll = Column(Numeric(10, 2), nullable=True)  # e.g., 100.00, 50.00
    cost_price = Column(Numeric(12, 2), nullable=False)  # BP (Buying Price per piece or per roll)
    selling_price = Column(Numeric(12, 2), nullable=False)  # SP (Selling Price per piece or per roll)
    price_per_roll = Column(Numeric(12, 2), nullable=True)  # Explicit SP per roll (equals selling_price for rolls)
    price_per_meter = Column(Numeric(12, 2), nullable=True)  # SP per loose meter
    cost_per_meter = Column(Numeric(12, 2), nullable=True)  # BP per loose meter
    reorder_level = Column(Numeric(10, 2), default=5.00, nullable=False)
    is_taxable = Column(Boolean, default=True, nullable=False)
    tax_rate = Column(Numeric(5, 4), default=0.1600, nullable=False)  # 0.16 (16%), 0.08 (8%), 0.00 (Zero-rated / Exempt)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("store_id", "sku", name="uq_store_sku"),
    )

    category = relationship("Category", back_populates="products")
    inventory = relationship("Inventory", back_populates="product", uselist=False, cascade="all, delete-orphan")
    movements = relationship("StockMovement", back_populates="product", cascade="all, delete-orphan")
