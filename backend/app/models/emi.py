from sqlalchemy import Column, String, ForeignKey, Integer, Float, Text, Date
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimeStampedModel

class EmiPlan(Base, TimeStampedModel):
    __tablename__ = "emi_plans"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    
    product_name = Column(String(200), nullable=False)
    imei = Column(String(50), nullable=True)
    
    total_sale_amount = Column(Float, nullable=False)
    down_payment = Column(Float, default=0.0, nullable=False)
    financed_principal = Column(Float, nullable=False) # total_sale_amount - down_payment
    
    interest_rate = Column(Float, default=0.0, nullable=False) # Annual interest rate %
    interest_amount = Column(Float, default=0.0, nullable=False)
    processing_fee = Column(Float, default=0.0, nullable=False)
    
    total_repayable = Column(Float, nullable=False) # financed_principal + interest_amount + processing_fee
    emi_amount = Column(Float, nullable=False) # Monthly installment amount
    number_of_installments = Column(Integer, nullable=False) # e.g. 3, 6, 9, 12, 18, 24
    emi_frequency = Column(String(20), default="MONTHLY", nullable=False)
    
    first_due_date = Column(Date, nullable=False)
    total_paid = Column(Float, default=0.0, nullable=False)
    balance_remaining = Column(Float, nullable=False)
    
    status = Column(String(30), default="ACTIVE", nullable=False, index=True) # ACTIVE, COMPLETED, DEFAULTED, SETTLED
    notes = Column(Text, nullable=True)

    sale = relationship("Sale", back_populates="emi_plan")
    customer = relationship("Customer", back_populates="emi_plans")
    installments = relationship("EmiInstallment", back_populates="emi_plan", cascade="all, delete-orphan", order_by="EmiInstallment.installment_number.asc()")
    payments = relationship("EmiPayment", back_populates="emi_plan", cascade="all, delete-orphan")

class EmiInstallment(Base, TimeStampedModel):
    __tablename__ = "emi_installments"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    emi_plan_id = Column(Integer, ForeignKey("emi_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    
    installment_number = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=False, index=True)
    
    emi_amount = Column(Float, nullable=False)
    principal_component = Column(Float, default=0.0)
    interest_component = Column(Float, default=0.0)
    
    paid_amount = Column(Float, default=0.0, nullable=False)
    balance_due = Column(Float, nullable=False)
    paid_date = Column(Date, nullable=True)
    
    status = Column(String(30), default="PENDING", nullable=False, index=True) # PENDING, PAID, PARTIAL, OVERDUE, WAIVED
    notes = Column(String(255), nullable=True)

    emi_plan = relationship("EmiPlan", back_populates="installments")
    payments = relationship("EmiPayment", back_populates="installment")

class EmiPayment(Base, TimeStampedModel):
    __tablename__ = "emi_payments"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    emi_plan_id = Column(Integer, ForeignKey("emi_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    installment_id = Column(Integer, ForeignKey("emi_installments.id"), nullable=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    
    payment_date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)
    payment_method = Column(String(30), nullable=False) # CASH, UPI, CARD, BANK
    reference_number = Column(String(100), nullable=True)
    collected_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(String(255), nullable=True)

    emi_plan = relationship("EmiPlan", back_populates="payments")
    installment = relationship("EmiInstallment", back_populates="payments")
