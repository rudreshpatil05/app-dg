from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Float, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimeStampedModel

class Customer(Base, TimeStampedModel):
    __tablename__ = "customers"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    phone = Column(String(20), nullable=False, index=True)
    alternate_phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), default="Pune", nullable=False)
    state = Column(String(100), default="Maharashtra", nullable=False)
    gstin = Column(String(15), nullable=True, index=True)
    
    opening_balance = Column(Float, default=0.0) # >0 means customer owes us, <0 means advance
    current_balance = Column(Float, default=0.0, index=True) # Total outstanding (Khatabook)
    total_purchases = Column(Float, default=0.0)
    total_paid = Column(Float, default=0.0)
    credit_limit = Column(Float, default=50000.0)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    sales = relationship("Sale", back_populates="customer")
    ledger_entries = relationship("CustomerLedger", back_populates="customer", cascade="all, delete-orphan", order_by="CustomerLedger.id.desc()")
    emi_plans = relationship("EmiPlan", back_populates="customer")
    repair_tickets = relationship("RepairTicket", back_populates="customer")

class CustomerLedger(Base, TimeStampedModel):
    __tablename__ = "customer_ledger"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    
    entry_type = Column(String(50), nullable=False) # SALE, PAYMENT, RETURN, EMI_INSTALLMENT, ADJUSTMENT
    debit = Column(Float, default=0.0, nullable=False) # Amount charged to customer (You Gave)
    credit = Column(Float, default=0.0, nullable=False) # Amount received from customer (You Got)
    balance = Column(Float, default=0.0, nullable=False) # Running balance after transaction
    
    payment_method = Column(String(30), nullable=True) # CASH, UPI, CARD, BANK, CHEQUE
    reference_id = Column(Integer, nullable=True)
    reference_type = Column(String(50), nullable=True) # sale_id, payment_id, emi_installment_id
    notes = Column(String(255), nullable=True)

    customer = relationship("Customer", back_populates="ledger_entries")

class Supplier(Base, TimeStampedModel):
    __tablename__ = "suppliers"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    company = Column(String(150), nullable=True, index=True)
    phone = Column(String(20), nullable=False, index=True)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), default="Pune", nullable=False)
    state = Column(String(100), default="Maharashtra", nullable=False)
    gstin = Column(String(15), nullable=True, index=True)
    
    bank_name = Column(String(100), nullable=True)
    bank_account_no = Column(String(50), nullable=True)
    bank_ifsc = Column(String(20), nullable=True)
    upi_id = Column(String(100), nullable=True)
    
    opening_balance = Column(Float, default=0.0) # >0 means we owe supplier
    current_balance = Column(Float, default=0.0, index=True) # Total payable
    total_purchases = Column(Float, default=0.0)
    total_paid = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    purchases = relationship("Purchase", back_populates="supplier")
    ledger_entries = relationship("SupplierLedger", back_populates="supplier", cascade="all, delete-orphan", order_by="SupplierLedger.id.desc()")

class SupplierLedger(Base, TimeStampedModel):
    __tablename__ = "supplier_ledger"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True)
    
    entry_type = Column(String(50), nullable=False) # PURCHASE, PAYMENT, RETURN, ADJUSTMENT
    debit = Column(Float, default=0.0, nullable=False) # Payment made to supplier
    credit = Column(Float, default=0.0, nullable=False) # Purchase from supplier (amount owed)
    balance = Column(Float, default=0.0, nullable=False) # Running payable balance
    
    payment_method = Column(String(30), nullable=True) # CASH, UPI, CARD, BANK, CHEQUE
    reference_id = Column(Integer, nullable=True)
    reference_type = Column(String(50), nullable=True)
    notes = Column(String(255), nullable=True)

    supplier = relationship("Supplier", back_populates="ledger_entries")
