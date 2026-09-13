from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Float, Text, Date
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimeStampedModel

class Sale(Base, TimeStampedModel):
    __tablename__ = "sales"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True) # Staff who handled counter billing
    
    invoice_number = Column(String(100), nullable=False, index=True)
    invoice_date = Column(Date, nullable=False)
    is_gst_invoice = Column(Boolean, default=True) # Tax Invoice vs Non-GST Bill
    
    # Snapshot customer details in invoice
    customer_name = Column(String(150), nullable=False)
    customer_phone = Column(String(20), nullable=False)
    customer_gstin = Column(String(15), nullable=True)
    customer_address = Column(Text, nullable=True)
    
    # Financial breakdown
    subtotal = Column(Float, default=0.0, nullable=False) # Sum of item prices before discount & tax
    discount_amount = Column(Float, default=0.0, nullable=False)
    taxable_amount = Column(Float, default=0.0, nullable=False)
    
    cgst_amount = Column(Float, default=0.0, nullable=False)
    sgst_amount = Column(Float, default=0.0, nullable=False)
    igst_amount = Column(Float, default=0.0, nullable=False)
    total_tax = Column(Float, default=0.0, nullable=False)
    
    grand_total = Column(Float, default=0.0, nullable=False)
    exchange_deduction = Column(Float, default=0.0, nullable=False) # Old phone trade-in value deducted
    final_payable = Column(Float, default=0.0, nullable=False) # grand_total - exchange_deduction
    
    paid_amount = Column(Float, default=0.0, nullable=False)
    balance_due = Column(Float, default=0.0, nullable=False)
    
    # Status
    payment_status = Column(String(30), default="PAID", nullable=False) # PAID, PARTIAL, UNPAID
    payment_type = Column(String(30), default="FULL", nullable=False) # FULL, SPLIT, CREDIT, EMI
    status = Column(String(30), default="COMPLETED", nullable=False) # COMPLETED, RETURNED, CANCELLED
    
    # Calculated COGS & Profit
    total_cogs = Column(Float, default=0.0, nullable=False) # Total purchase cost of items
    gross_profit = Column(Float, default=0.0, nullable=False) # Profit made on this sale
    
    notes = Column(Text, nullable=True)

    customer = relationship("Customer", back_populates="sales")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    payments = relationship("SalePayment", back_populates="sale", cascade="all, delete-orphan")
    emi_plan = relationship("EmiPlan", back_populates="sale", uselist=False)
    returns = relationship("SaleReturn", back_populates="sale")

class SaleItem(Base, TimeStampedModel):
    __tablename__ = "sale_items"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=True)
    serial_number_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=True, index=True)
    
    product_name = Column(String(200), nullable=False)
    brand = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    
    imei1 = Column(String(50), nullable=True, index=True)
    imei2 = Column(String(50), nullable=True)
    serial_number = Column(String(50), nullable=True)
    hsn_code = Column(String(20), default="8517", nullable=False)
    
    quantity = Column(Integer, default=1, nullable=False)
    unit_mrp = Column(Float, default=0.0, nullable=False)
    unit_price = Column(Float, default=0.0, nullable=False)
    purchase_cost = Column(Float, default=0.0, nullable=False) # For accurate item-wise profit calculation
    discount = Column(Float, default=0.0, nullable=False)
    
    gst_rate = Column(Float, default=18.0, nullable=False)
    taxable_value = Column(Float, default=0.0, nullable=False)
    cgst = Column(Float, default=0.0, nullable=False)
    sgst = Column(Float, default=0.0, nullable=False)
    igst = Column(Float, default=0.0, nullable=False)
    total = Column(Float, default=0.0, nullable=False)
    
    warranty_months = Column(Integer, default=12)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")

class SalePayment(Base, TimeStampedModel):
    __tablename__ = "sale_payments"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True) # Cash in hand or Bank account
    
    amount = Column(Float, nullable=False)
    payment_method = Column(String(30), nullable=False) # CASH, UPI, CARD, BANK, CREDIT, EMI
    reference_number = Column(String(100), nullable=True) # UPI UTR, Card Txn ID, etc.
    notes = Column(String(255), nullable=True)

    sale = relationship("Sale", back_populates="payments")

class SaleReturn(Base, TimeStampedModel):
    __tablename__ = "sale_returns"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    
    return_number = Column(String(100), nullable=False, index=True)
    return_date = Column(Date, nullable=False)
    refund_amount = Column(Float, default=0.0, nullable=False)
    refund_method = Column(String(30), default="CASH") # CASH, UPI, CREDIT_NOTE
    reason = Column(String(100), nullable=False) # DEFECTIVE, WRONG_PRODUCT, WARRANTY_ISSUE, OTHER
    notes = Column(Text, nullable=True)

    sale = relationship("Sale", back_populates="returns")
    items = relationship("SaleReturnItem", back_populates="sale_return", cascade="all, delete-orphan")

class SaleReturnItem(Base, TimeStampedModel):
    __tablename__ = "sale_return_items"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    sale_return_id = Column(Integer, ForeignKey("sale_returns.id", ondelete="CASCADE"), nullable=False, index=True)
    sale_item_id = Column(Integer, ForeignKey("sale_items.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    serial_number_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=True)
    
    quantity = Column(Integer, default=1, nullable=False)
    refund_price = Column(Float, default=0.0, nullable=False)
    inspection_status = Column(String(50), default="PENDING_INSPECTION") # PENDING_INSPECTION, RESTOCKED, DAMAGED, SENT_TO_SUPPLIER
    notes = Column(String(255), nullable=True)

    sale_return = relationship("SaleReturn", back_populates="items")
