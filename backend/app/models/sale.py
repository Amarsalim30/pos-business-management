from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.core.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    phone = Column(String(50), nullable=True, index=True)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    balance = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)  # Outstanding credit debt
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    sales = relationship("Sale", back_populates="customer")
    payments = relationship("Payment", back_populates="customer", order_by="Payment.created_at")
    pre_sales = relationship("PreSaleDocument", back_populates="customer")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    invoice_no = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    subtotal = Column(Numeric(12, 2), nullable=False)
    tax_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    discount_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    
    payment_method = Column(String(30), nullable=False)  # Primary payment method or 'split'
    payment_reference = Column(String(100), nullable=True)  # Mpesa code, cheque #, etc.
    status = Column(String(20), default="paid", nullable=False)  # 'paid', 'unpaid', 'partial', 'voided'
    is_etr = Column(Boolean, default=False, nullable=False)
    site_name = Column(String(200), nullable=True, index=True)
    notes = Column(Text, nullable=True)
    
    # Void Tracking
    voided_at = Column(DateTime, nullable=True)
    void_reason = Column(Text, nullable=True)
    voided_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    customer = relationship("Customer", back_populates="sales")
    user = relationship("User", foreign_keys=[user_id])
    voided_by = relationship("User", foreign_keys=[voided_by_user_id])
    store = relationship("Store")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="sale", cascade="all, delete-orphan", order_by="Payment.created_at")

    @property
    def total_paid(self) -> Decimal:
        if not self.payments:
            return self.total_amount if self.status == "paid" else Decimal("0.00")
        return sum((p.amount for p in self.payments), Decimal("0.00"))

    @property
    def balance_due(self) -> Decimal:
        if self.computed_status == "voided":
            return Decimal("0.00")
        return max(Decimal("0.00"), self.total_amount - self.total_paid)

    @property
    def computed_status(self) -> str:
        if self.voided_at is not None or self.status == "voided":
            return "voided"
        if not self.payments:
            return self.status or ("unpaid" if self.customer_id else "paid")
        paid = self.total_paid
        if paid >= self.total_amount:
            return "paid"
        elif paid > Decimal("0.00"):
            return "partial"
        else:
            return "unpaid"


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    
    unit_type = Column(String(20), default="piece", nullable=False)  # 'piece' or 'roll'
    unit_sold = Column(String(20), nullable=False)  # 'piece', 'roll', 'meter'
    quantity = Column(Numeric(12, 2), nullable=False)  # Total base quantity (meters for rolls, pcs for pieces)
    rolls_qty = Column(Integer, nullable=True)  # Number of rolls if sold by roll
    loose_meters = Column(Numeric(12, 2), nullable=True)  # Loose meters if sold with loose
    
    unit_price = Column(Numeric(12, 2), nullable=False)  # Actual selling price per unit
    cost_price = Column(Numeric(12, 2), nullable=False)  # Cost price (BP snapshot for margin analysis)
    tax_rate = Column(Numeric(5, 4), default=Decimal("0.0000"), nullable=False)
    total = Column(Numeric(12, 2), nullable=False)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(30), nullable=False)  # 'cash', 'mpesa', 'card', 'bank', 'cheque'
    reference = Column(String(100), nullable=True)  # Mpesa code, cheque #, etc.
    notes = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    sale = relationship("Sale", back_populates="payments")
    customer = relationship("Customer", back_populates="payments")
    user = relationship("User")
    store = relationship("Store")


# Alias for backward compatibility
CustomerPayment = Payment


class PreSaleDocument(Base):
    __tablename__ = "pre_sale_documents"

    id = Column(Integer, primary_key=True, index=True)
    document_no = Column(String(50), unique=True, nullable=False, index=True)
    type = Column(String(20), nullable=False)  # 'quotation' or 'proforma'
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    subtotal = Column(Numeric(12, 2), nullable=False)
    tax_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    discount_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    
    status = Column(String(20), default="draft", nullable=False)  # 'draft', 'accepted', 'converted', 'expired'
    site_name = Column(String(200), nullable=True)
    valid_until = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    converted_sale_id = Column(Integer, ForeignKey("sales.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    customer = relationship("Customer", back_populates="pre_sales")
    user = relationship("User")
    items = relationship("PreSaleItem", back_populates="document", cascade="all, delete-orphan")
    converted_sale = relationship("Sale")


class PreSaleItem(Base):
    __tablename__ = "pre_sale_items"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("pre_sale_documents.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    
    unit_type = Column(String(20), default="piece", nullable=False)
    unit_sold = Column(String(20), nullable=False)
    quantity = Column(Numeric(12, 2), nullable=False)
    rolls_qty = Column(Integer, nullable=True)
    loose_meters = Column(Numeric(12, 2), nullable=True)
    
    unit_price = Column(Numeric(12, 2), nullable=False)
    tax_rate = Column(Numeric(5, 4), default=Decimal("0.0000"), nullable=False)
    total = Column(Numeric(12, 2), nullable=False)

    document = relationship("PreSaleDocument", back_populates="items")
    product = relationship("Product")
