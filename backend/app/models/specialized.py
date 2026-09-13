from sqlalchemy import Column, String, ForeignKey, Integer, Float, Text, Date
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimeStampedModel

class ExchangeDevice(Base, TimeStampedModel):
    __tablename__ = "exchange_devices"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True, index=True)
    
    brand = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    imei = Column(String(50), nullable=True, index=True)
    ram = Column(String(20), nullable=True)
    storage = Column(String(30), nullable=True)
    color = Column(String(50), nullable=True)
    
    age_months = Column(Integer, default=12)
    screen_condition = Column(String(50), default="Good") # Flawless, Minor Scratches, Cracked, Touch Issue
    body_condition = Column(String(50), default="Good") # Like New, Minor Dents, Scratched, Broken
    battery_health = Column(String(50), default="Above 80%") # >85%, 75-85%, Service Required
    accessories_included = Column(String(255), nullable=True) # Box, Original Charger, Bill
    
    estimated_value = Column(Float, default=0.0)
    final_exchange_value = Column(Float, default=0.0, nullable=False)
    
    status = Column(String(30), default="RECEIVED", nullable=False) # RECEIVED, INSPECTION_PENDING, ACCEPTED, REFURBISHMENT, RESALE, SCRAP
    resale_price = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)

class WarrantyRecord(Base, TimeStampedModel):
    __tablename__ = "warranty_records"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    serial_number_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=True, index=True)
    
    imei = Column(String(50), nullable=True, index=True)
    product_name = Column(String(200), nullable=False)
    customer_name = Column(String(150), nullable=False)
    customer_phone = Column(String(20), nullable=False, index=True)
    
    purchase_date = Column(Date, nullable=False)
    warranty_months = Column(Integer, default=12, nullable=False)
    warranty_start = Column(Date, nullable=False)
    warranty_end = Column(Date, nullable=False, index=True)
    
    status = Column(String(30), default="ACTIVE", nullable=False) # ACTIVE, EXPIRED, CLAIMED
    notes = Column(Text, nullable=True)

class RepairTicket(Base, TimeStampedModel):
    __tablename__ = "repair_tickets"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    ticket_number = Column(String(100), nullable=False, index=True) # e.g. REP-2026-001
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True, index=True)
    
    customer_name = Column(String(150), nullable=False)
    customer_phone = Column(String(20), nullable=False, index=True)
    
    device_name = Column(String(150), nullable=False)
    imei_or_serial = Column(String(50), nullable=True, index=True)
    device_passcode = Column(String(50), nullable=True)
    
    problem_description = Column(Text, nullable=False)
    accessories_received = Column(String(255), nullable=True) # Only Device, With Charger, SIM Tray
    
    estimated_cost = Column(Float, default=0.0)
    final_cost = Column(Float, default=0.0)
    advance_paid = Column(Float, default=0.0)
    
    technician_name = Column(String(100), nullable=True)
    status = Column(String(30), default="RECEIVED", nullable=False, index=True) # RECEIVED, DIAGNOSING, REPAIRING, READY, DELIVERED, CANCELLED
    
    received_date = Column(Date, nullable=False)
    expected_completion = Column(Date, nullable=True)
    completed_date = Column(Date, nullable=True)
    delivery_date = Column(Date, nullable=True)
    
    notes = Column(Text, nullable=True)

    customer = relationship("Customer", back_populates="repair_tickets")
    payments = relationship("RepairPayment", back_populates="repair_ticket", cascade="all, delete-orphan")

class RepairPayment(Base, TimeStampedModel):
    __tablename__ = "repair_payments"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    repair_ticket_id = Column(Integer, ForeignKey("repair_tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    
    amount = Column(Float, nullable=False)
    payment_method = Column(String(30), default="CASH") # CASH, UPI, CARD
    payment_date = Column(Date, nullable=False)
    notes = Column(String(255), nullable=True)

    repair_ticket = relationship("RepairTicket", back_populates="payments")
