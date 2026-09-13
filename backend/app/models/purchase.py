from sqlalchemy import Column, String, ForeignKey, Integer, Float, Text, Date, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimeStampedModel

class Purchase(Base, TimeStampedModel):
    __tablename__ = "purchases"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False, index=True)
    
    invoice_number = Column(String(100), nullable=False, index=True) # Supplier's invoice number
    invoice_date = Column(Date, nullable=False)
    
    subtotal = Column(Float, default=0.0, nullable=False)
    discount = Column(Float, default=0.0, nullable=False)
    gst_amount = Column(Float, default=0.0, nullable=False)
    total_amount = Column(Float, default=0.0, nullable=False)
    
    paid_amount = Column(Float, default=0.0, nullable=False)
    balance_due = Column(Float, default=0.0, nullable=False)
    payment_status = Column(String(30), default="PAID", nullable=False) # PAID, PARTIAL, UNPAID
    payment_method = Column(String(30), default="BANK") # BANK, CASH, UPI, CREDIT
    
    notes = Column(Text, nullable=True)

    supplier = relationship("Supplier", back_populates="purchases")
    items = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")

class PurchaseItem(Base, TimeStampedModel):
    __tablename__ = "purchase_items"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=True)
    
    quantity = Column(Integer, default=1, nullable=False)
    unit_cost = Column(Float, default=0.0, nullable=False)
    gst_rate = Column(Float, default=18.0, nullable=False)
    gst_amount = Column(Float, default=0.0, nullable=False)
    total = Column(Float, default=0.0, nullable=False)
    
    imei_records = Column(JSON, default=list) # List of IMEI/Serial strings registered in this batch

    purchase = relationship("Purchase", back_populates="items")
    product = relationship("Product")

class PurchaseReturn(Base, TimeStampedModel):
    __tablename__ = "purchase_returns"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False, index=True)
    
    return_number = Column(String(100), nullable=False, index=True)
    return_date = Column(Date, nullable=False)
    total_amount = Column(Float, default=0.0, nullable=False)
    reason = Column(String(100), nullable=False)
    notes = Column(Text, nullable=True)
