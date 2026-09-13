from typing import Optional, List
from pydantic import BaseModel, ConfigDict
import datetime

class CartItemInput(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    serial_number_id: Optional[int] = None
    imei1: Optional[str] = None
    imei2: Optional[str] = None
    serial_number: Optional[str] = None
    quantity: int = 1
    unit_price: float
    unit_mrp: Optional[float] = None
    discount: float = 0.0
    gst_rate: float = 18.0

class ExchangeInput(BaseModel):
    brand: str
    model: str
    imei: Optional[str] = None
    ram: Optional[str] = None
    storage: Optional[str] = None
    color: Optional[str] = None
    age_months: int = 12
    screen_condition: str = "Good"
    body_condition: str = "Good"
    battery_health: str = "Above 80%"
    accessories_included: Optional[str] = None
    estimated_value: float = 0.0
    final_exchange_value: float

class PaymentSplitInput(BaseModel):
    payment_method: str # CASH, UPI, CARD, BANK, CREDIT, EMI
    amount: float
    reference_number: Optional[str] = None

class EmiInput(BaseModel):
    number_of_installments: int = 6
    interest_rate: float = 0.0
    processing_fee: float = 0.0
    notes: Optional[str] = None

class PosSaleRequest(BaseModel):
    customer: dict # {"name": "...", "phone": "...", "address": "...", "gstin": "..."}
    items: List[CartItemInput]
    discount_amount: float = 0.0
    is_gst_invoice: bool = True
    exchange_device: Optional[ExchangeInput] = None
    payments: List[PaymentSplitInput]
    emi_details: Optional[EmiInput] = None
    notes: Optional[str] = None

class SaleItemResponse(BaseModel):
    id: int
    product_name: str
    brand: Optional[str] = None
    model: Optional[str] = None
    imei1: Optional[str] = None
    imei2: Optional[str] = None
    serial_number: Optional[str] = None
    hsn_code: str
    quantity: int
    unit_mrp: float
    unit_price: float
    discount: float
    gst_rate: float
    taxable_value: float
    cgst: float
    sgst: float
    igst: float
    total: float
    warranty_months: int
    model_config = ConfigDict(from_attributes=True)

class SalePaymentResponse(BaseModel):
    id: int
    amount: float
    payment_method: str
    reference_number: Optional[str] = None
    created_at: datetime.datetime
    model_config = ConfigDict(from_attributes=True)

class SaleResponse(BaseModel):
    id: int
    business_id: int
    invoice_number: str
    invoice_date: datetime.date
    is_gst_invoice: bool
    customer_name: str
    customer_phone: str
    customer_gstin: Optional[str] = None
    customer_address: Optional[str] = None
    subtotal: float
    discount_amount: float
    taxable_amount: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    total_tax: float
    grand_total: float
    exchange_deduction: float
    final_payable: float
    paid_amount: float
    balance_due: float
    payment_status: str
    payment_type: str
    status: str
    gross_profit: Optional[float] = None # Filtered or masked based on RBAC!
    notes: Optional[str] = None
    items: List[SaleItemResponse] = []
    payments: List[SalePaymentResponse] = []
    whatsapp_link: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
