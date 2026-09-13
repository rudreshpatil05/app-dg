from typing import Optional, List
from pydantic import BaseModel, ConfigDict
import datetime

class CategoryBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    is_active: bool = True

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: int
    business_id: int
    model_config = ConfigDict(from_attributes=True)

class SerialNumberBase(BaseModel):
    imei1: Optional[str] = None
    imei2: Optional[str] = None
    serial_number: Optional[str] = None
    color: Optional[str] = None
    ram: Optional[str] = None
    storage: Optional[str] = None
    purchase_cost: float = 0.0
    selling_price: float = 0.0
    status: str = "IN_STOCK"
    notes: Optional[str] = None

class SerialNumberCreate(SerialNumberBase):
    product_id: int
    variant_id: Optional[int] = None
    supplier_id: Optional[int] = None

class SerialNumberResponse(SerialNumberBase):
    id: int
    business_id: int
    product_id: int
    variant_id: Optional[int] = None
    purchase_id: Optional[int] = None
    sale_id: Optional[int] = None
    supplier_id: Optional[int] = None
    warranty_start: Optional[datetime.date] = None
    warranty_end: Optional[datetime.date] = None
    product_name: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ProductBase(BaseModel):
    name: str
    brand: str
    model: Optional[str] = None
    category_id: int
    sku: Optional[str] = None
    barcode: Optional[str] = None
    hsn_code: str = "8517"
    gst_rate: float = 18.0
    mrp: float = 0.0
    selling_price: float = 0.0
    purchase_cost: float = 0.0
    wholesale_price: Optional[float] = 0.0
    min_stock_level: int = 2
    is_serialized: bool = True
    warranty_months: int = 12
    image_url: Optional[str] = None
    description: Optional[str] = None

class ProductCreate(ProductBase):
    initial_stock: int = 0
    initial_imeis: Optional[List[str]] = None # Optional list of IMEIs if serialized

class ProductResponse(ProductBase):
    id: int
    business_id: int
    current_stock: int
    category_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
