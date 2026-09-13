from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Float, Text, Date
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimeStampedModel

class Account(Base, TimeStampedModel):
    __tablename__ = "accounts"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False) # e.g. "Main Cash Counter", "HDFC Current A/C", "Shop Google Pay / PhonePe"
    account_type = Column(String(30), nullable=False) # CASH, BANK, UPI, CARD
    
    account_number = Column(String(50), nullable=True)
    bank_name = Column(String(100), nullable=True)
    ifsc_code = Column(String(20), nullable=True)
    upi_id = Column(String(100), nullable=True)
    
    opening_balance = Column(Float, default=0.0, nullable=False)
    current_balance = Column(Float, default=0.0, nullable=False)
    
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    transactions = relationship("AccountTransaction", back_populates="account", cascade="all, delete-orphan", order_by="AccountTransaction.id.desc()")

class AccountTransaction(Base, TimeStampedModel):
    __tablename__ = "account_transactions"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    
    txn_type = Column(String(20), nullable=False) # CREDIT (Money In), DEBIT (Money Out)
    amount = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=False)
    
    reference_type = Column(String(50), nullable=False) # SALE, PURCHASE, EXPENSE, EMI, REPAIR, TRANSFER, ADJUSTMENT
    reference_id = Column(Integer, nullable=True)
    payment_method = Column(String(30), nullable=False) # CASH, UPI, CARD, BANK
    notes = Column(String(255), nullable=True)

    account = relationship("Account", back_populates="transactions")

class ExpenseCategory(Base, TimeStampedModel):
    __tablename__ = "expense_categories"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False) # Rent, Electricity, Staff Salary, Tea & Snacks, Marketing, etc.
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)

    expenses = relationship("Expense", back_populates="category")

class Expense(Base, TimeStampedModel):
    __tablename__ = "expenses"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("expense_categories.id"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True, index=True) # Cash/Bank used
    
    amount = Column(Float, nullable=False)
    expense_date = Column(Date, nullable=False)
    payment_method = Column(String(30), default="CASH", nullable=False)
    
    vendor = Column(String(150), nullable=True)
    gstin = Column(String(15), nullable=True)
    is_gst_applicable = Column(Boolean, default=False)
    gst_amount = Column(Float, default=0.0)
    
    receipt_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)

    category = relationship("ExpenseCategory", back_populates="expenses")

class CashReconciliation(Base, TimeStampedModel):
    __tablename__ = "cash_reconciliations"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    reconciliation_date = Column(Date, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    opening_cash = Column(Float, default=0.0)
    cash_sales = Column(Float, default=0.0)
    customer_cash_collected = Column(Float, default=0.0)
    emi_cash_collected = Column(Float, default=0.0)
    cash_expenses = Column(Float, default=0.0)
    supplier_cash_paid = Column(Float, default=0.0)
    
    system_expected_cash = Column(Float, nullable=False)
    actual_physical_cash = Column(Float, nullable=False)
    discrepancy = Column(Float, default=0.0) # actual - expected (negative means cash shortage!)
    
    status = Column(String(30), default="MATCHED") # MATCHED, DISCREPANCY
    notes = Column(Text, nullable=True)
