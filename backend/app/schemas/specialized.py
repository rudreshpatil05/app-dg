from typing import Optional
from pydantic import BaseModel, ConfigDict
import datetime

class ExchangeDeviceResponse(BaseModel):
    id: int
    business_id: int
    sale_id: Optional[int] = None
    customer_id: Optional[int] = None
    brand: str
    model: str
    imei: Optional[str] = None
    ram: Optional[str] = None
    storage: Optional[str] = None
    color: Optional[str] = None
    age_months: int
    screen_condition: str
    body_condition: str
    battery_health: str
    accessories_included: Optional[str] = None
    estimated_value: float
    final_exchange_value: float
    status: str # RECEIVED, INSPECTION_PENDING, ACCEPTED, REFURBISHMENT, RESALE, SCRAP
    resale_price: float
    notes: Optional[str] = None
    created_at: datetime.datetime
    model_config = ConfigDict(from_attributes=True)

class WarrantyResponse(BaseModel):
    id: int
    business_id: int
    sale_id: int
    customer_name: str
    customer_phone: str
    product_name: str
    imei: Optional[str] = None
    purchase_date: datetime.date
    warranty_months: int
    warranty_start: datetime.date
    warranty_end: datetime.date
    status: str # ACTIVE, EXPIRED, CLAIMED
    model_config = ConfigDict(from_attributes=True)

class RepairTicketCreate(BaseModel):
    customer_name: str
    customer_phone: str
    device_name: str
    imei_or_serial: Optional[str] = None
    device_passcode: Optional[str] = None
    problem_description: str
    accessories_received: Optional[str] = "Device only"
    estimated_cost: float = 0.0
    advance_paid: float = 0.0
    payment_method: str = "CASH"
    technician_name: Optional[str] = None
    expected_completion: Optional[datetime.date] = None
    notes: Optional[str] = None

class RepairTicketResponse(BaseModel):
    id: int
    business_id: int
    ticket_number: str
    customer_id: Optional[int] = None
    customer_name: str
    customer_phone: str
    device_name: str
    imei_or_serial: Optional[str] = None
    problem_description: str
    accessories_received: Optional[str] = None
    estimated_cost: float
    final_cost: float
    advance_paid: float
    technician_name: Optional[str] = None
    status: str # RECEIVED, DIAGNOSING, REPAIRING, READY, DELIVERED, CANCELLED
    received_date: datetime.date
    expected_completion: Optional[datetime.date] = None
    completed_date: Optional[datetime.date] = None
    delivery_date: Optional[datetime.date] = None
    notes: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
