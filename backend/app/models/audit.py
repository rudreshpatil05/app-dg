from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, JSON, Text
from app.database import Base
from app.models.base import TimeStampedModel

class AuditLog(Base, TimeStampedModel):
    __tablename__ = "audit_logs"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    user_name = Column(String(150), nullable=False)
    role = Column(String(50), nullable=False)
    
    action = Column(String(100), nullable=False, index=True) # e.g. CREATE_SALE, UPDATE_PRICE, RECEIVE_PAYMENT, ADJUST_STOCK
    entity_type = Column(String(50), nullable=False) # Sale, Product, Customer, Expense, EMI, etc.
    entity_id = Column(Integer, nullable=True)
    
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    
    ip_address = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)

class Notification(Base, TimeStampedModel):
    __tablename__ = "notifications"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    
    category = Column(String(50), nullable=False, index=True) # LOW_STOCK, EMI_DUE, CUSTOMER_OVERDUE, SUPPLIER_DUE, WARRANTY_EXPIRING, REPAIR_READY
    severity = Column(String(20), default="INFO") # INFO, WARNING, DANGER
    
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False, index=True)
