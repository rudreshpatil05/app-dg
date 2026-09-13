from typing import Optional, List
from pydantic import BaseModel, ConfigDict
import datetime

class CustomerBase(BaseModel):
    name: str
    phone: str
    alternate_phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: str = "Pune"
    state: str = "Maharashtra"
    gstin: Optional[str] = None
    credit_limit: float = 50000.0
    notes: Optional[str] = None

class CustomerCreate(CustomerBase):
    opening_balance: float = 0.0

class CustomerResponse(CustomerBase):
    id: int
    business_id: int
    opening_balance: float
    current_balance: float
    total_purchases: float
    total_paid: float
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class CustomerLedgerResponse(BaseModel):
    id: int
    business_id: int
    customer_id: int
    entry_type: str
    debit: float
    credit: float
    balance: float
    payment_method: Optional[str] = None
    reference_id: Optional[int] = None
    reference_type: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime.datetime
    model_config = ConfigDict(from_attributes=True)

class SupplierBase(BaseModel):
    name: str
    company: Optional[str] = None
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    city: str = "Pune"
    state: str = "Maharashtra"
    gstin: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    upi_id: Optional[str] = None
    notes: Optional[str] = None

class SupplierCreate(SupplierBase):
    opening_balance: float = 0.0

class SupplierResponse(SupplierBase):
    id: int
    business_id: int
    opening_balance: float
    current_balance: float
    total_purchases: float
    total_paid: float
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class SupplierLedgerResponse(BaseModel):
    id: int
    business_id: int
    supplier_id: int
    entry_type: str
    debit: float
    credit: float
    balance: float
    payment_method: Optional[str] = None
    reference_id: Optional[int] = None
    reference_type: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime.datetime
    model_config = ConfigDict(from_attributes=True)

class ReceivePaymentRequest(BaseModel):
    customer_id: int
    amount: float
    payment_method: str = "CASH" # CASH, UPI, CARD, BANK, CHEQUE
    reference_number: Optional[str] = None
    payment_date: Optional[datetime.date] = None
    notes: Optional[str] = None

class PaySupplierRequest(BaseModel):
    supplier_id: int
    amount: float
    payment_method: str = "BANK"
    reference_number: Optional[str] = None
    payment_date: Optional[datetime.date] = None
    notes: Optional[str] = None
