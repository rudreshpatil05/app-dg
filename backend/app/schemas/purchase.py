from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
import datetime

class PurchaseItemInput(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = Field(default=1, ge=1)
    unit_cost: float = Field(ge=0)
    gst_rate: float = Field(default=18.0, ge=0, le=100)
    imeis: Optional[List[str]] = None # List of IMEIs for serialized products

class PurchaseCreateRequest(BaseModel):
    supplier_id: int
    invoice_number: str
    invoice_date: datetime.date
    items: List[PurchaseItemInput]
    discount: float = Field(default=0.0, ge=0)
    paid_amount: float = Field(default=0.0, ge=0)
    payment_method: str = "BANK" # BANK, CASH, UPI, CREDIT
    notes: Optional[str] = None

class PurchaseItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    quantity: int
    unit_cost: float
    gst_rate: float
    gst_amount: float
    total: float
    imei_records: Optional[List[str]] = []
    model_config = ConfigDict(from_attributes=True)

class PurchaseResponse(BaseModel):
    id: int
    business_id: int
    supplier_id: int
    supplier_name: Optional[str] = None
    invoice_number: str
    invoice_date: datetime.date
    subtotal: float
    discount: float
    gst_amount: float
    total_amount: float
    paid_amount: float
    balance_due: float
    payment_status: str
    payment_method: str
    notes: Optional[str] = None
    items: List[PurchaseItemResponse] = []
    model_config = ConfigDict(from_attributes=True)
