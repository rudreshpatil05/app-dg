from typing import Optional, List
from pydantic import BaseModel, ConfigDict
import datetime

class EmiInstallmentResponse(BaseModel):
    id: int
    installment_number: int
    due_date: datetime.date
    emi_amount: float
    paid_amount: float
    balance_due: float
    paid_date: Optional[datetime.date] = None
    status: str # PENDING, PAID, PARTIAL, OVERDUE, WAIVED
    notes: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class EmiPlanResponse(BaseModel):
    id: int
    business_id: int
    sale_id: int
    customer_id: int
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    product_name: str
    imei: Optional[str] = None
    total_sale_amount: float
    down_payment: float
    financed_principal: float
    interest_rate: float
    interest_amount: float
    processing_fee: float
    total_repayable: float
    emi_amount: float
    number_of_installments: int
    first_due_date: datetime.date
    total_paid: float
    balance_remaining: float
    status: str
    installments: List[EmiInstallmentResponse] = []
    whatsapp_link: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CollectEmiRequest(BaseModel):
    installment_id: Optional[int] = None
    amount: float
    payment_method: str = "CASH" # CASH, UPI, CARD, BANK
    reference_number: Optional[str] = None
    payment_date: Optional[datetime.date] = None
    notes: Optional[str] = None
