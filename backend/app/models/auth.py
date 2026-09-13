from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, JSON, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimeStampedModel

class Business(Base, TimeStampedModel):
    __tablename__ = "businesses"

    name = Column(String(200), nullable=False)
    legal_name = Column(String(200), nullable=True)
    gstin = Column(String(15), nullable=True, index=True)
    phone = Column(String(20), nullable=False)
    alternate_phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=False, default="Pune")
    state = Column(String(100), nullable=False, default="Maharashtra")
    state_code = Column(String(2), nullable=False, default="27") # Maharashtra GST state code
    pincode = Column(String(10), nullable=True)
    logo_url = Column(String(500), nullable=True)
    upi_id = Column(String(100), nullable=True) # e.g. shreeganesh@upi
    invoice_prefix = Column(String(10), default="INV", nullable=False)
    thermal_printer_width = Column(String(10), default="80mm", nullable=False) # 80mm or 58mm
    terms_and_conditions = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    users = relationship("User", back_populates="business", cascade="all, delete-orphan")
    settings = relationship("BusinessSettings", back_populates="business", cascade="all, delete-orphan")

class Role(Base, TimeStampedModel):
    __tablename__ = "roles"

    code = Column(String(50), unique=True, nullable=False, index=True) # OWNER, MANAGER, STAFF, ACCOUNTANT
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    permissions = Column(JSON, default=dict)

    users = relationship("User", back_populates="role")

class User(Base, TimeStampedModel):
    __tablename__ = "users"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False, index=True)
    username = Column(String(100), nullable=False, index=True)
    email = Column(String(100), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=True)
    pin = Column(String(10), nullable=True) # Quick counter 4-digit PIN for staff handover
    is_active = Column(Boolean, default=True)

    business = relationship("Business", back_populates="users")
    role = relationship("Role", back_populates="users")

class BusinessSettings(Base, TimeStampedModel):
    __tablename__ = "business_settings"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    setting_key = Column(String(100), nullable=False, index=True)
    setting_value = Column(JSON, nullable=False)
    description = Column(String(255), nullable=True)

    business = relationship("Business", back_populates="settings")
