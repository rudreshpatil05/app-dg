import enum
from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Float, Text, Enum, Date
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimeStampedModel

class SerialStatus(str, enum.Enum):
    IN_STOCK = "IN_STOCK"
    RESERVED = "RESERVED"
    SOLD = "SOLD"
    RETURNED = "RETURNED"
    DAMAGED = "DAMAGED"
    UNDER_REPAIR = "UNDER_REPAIR"
    TRANSFERRED = "TRANSFERRED"

class MovementType(str, enum.Enum):
    PURCHASE = "PURCHASE"
    SALE = "SALE"
    SALE_RETURN = "SALE_RETURN"
    PURCHASE_RETURN = "PURCHASE_RETURN"
    ADJUSTMENT = "ADJUSTMENT"
    EXCHANGE_IN = "EXCHANGE_IN"

class Category(Base, TimeStampedModel):
    __tablename__ = "categories"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)

    products = relationship("Product", back_populates="category")

class Product(Base, TimeStampedModel):
    __tablename__ = "products"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    brand = Column(String(100), nullable=False, index=True)
    model = Column(String(100), nullable=True, index=True)
    sku = Column(String(100), nullable=True, index=True)
    barcode = Column(String(100), nullable=True, index=True)
    hsn_code = Column(String(20), default="8517", nullable=False)
    gst_rate = Column(Float, default=18.0, nullable=False)
    mrp = Column(Float, default=0.0, nullable=False)
    selling_price = Column(Float, default=0.0, nullable=False)
    purchase_cost = Column(Float, default=0.0, nullable=False)
    wholesale_price = Column(Float, default=0.0, nullable=True)
    min_stock_level = Column(Integer, default=2, nullable=False)
    current_stock = Column(Integer, default=0, nullable=False)
    is_serialized = Column(Boolean, default=True) # True for mobiles & serial electronics
    warranty_months = Column(Integer, default=12, nullable=False)
    image_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    category = relationship("Category", back_populates="products")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    serial_numbers = relationship("SerialNumber", back_populates="product")
    stock_movements = relationship("StockMovement", back_populates="product")

class ProductVariant(Base, TimeStampedModel):
    __tablename__ = "product_variants"

    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_name = Column(String(150), nullable=False) # e.g. "8GB / 128GB - Phantom Black"
    ram = Column(String(20), nullable=True)
    storage = Column(String(30), nullable=True)
    color = Column(String(50), nullable=True)
    additional_price = Column(Float, default=0.0)
    selling_price = Column(Float, nullable=True)
    purchase_cost = Column(Float, nullable=True)
    mrp = Column(Float, nullable=True)
    sku = Column(String(100), nullable=True)
    barcode = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)

    product = relationship("Product", back_populates="variants")
    serial_numbers = relationship("SerialNumber", back_populates="variant")

class SerialNumber(Base, TimeStampedModel):
    __tablename__ = "serial_numbers"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=True, index=True)
    
    # Crucial unique identification for mobile phones
    imei1 = Column(String(50), nullable=True, index=True)
    imei2 = Column(String(50), nullable=True, index=True)
    serial_number = Column(String(50), nullable=True, index=True)
    
    color = Column(String(50), nullable=True)
    ram = Column(String(20), nullable=True)
    storage = Column(String(30), nullable=True)
    
    purchase_cost = Column(Float, default=0.0, nullable=False)
    selling_price = Column(Float, default=0.0, nullable=False)
    
    status = Column(String(30), default="IN_STOCK", nullable=False, index=True) # IN_STOCK, RESERVED, SOLD, RETURNED, DAMAGED, UNDER_REPAIR, TRANSFERRED
    
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True, index=True)
    
    warranty_start = Column(Date, nullable=True)
    warranty_end = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)

    product = relationship("Product", back_populates="serial_numbers")
    variant = relationship("ProductVariant", back_populates="serial_numbers")

class StockMovement(Base, TimeStampedModel):
    __tablename__ = "stock_movements"

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    serial_number_id = Column(Integer, ForeignKey("serial_numbers.id"), nullable=True, index=True)
    
    movement_type = Column(String(30), nullable=False) # PURCHASE, SALE, SALE_RETURN, PURCHASE_RETURN, ADJUSTMENT, EXCHANGE_IN
    quantity = Column(Integer, nullable=False)
    previous_stock = Column(Integer, default=0)
    current_stock = Column(Integer, default=0)
    
    reference_id = Column(Integer, nullable=True) # ID of sale, purchase, or return
    reference_type = Column(String(50), nullable=True)
    notes = Column(String(255), nullable=True)

    product = relationship("Product", back_populates="stock_movements")
