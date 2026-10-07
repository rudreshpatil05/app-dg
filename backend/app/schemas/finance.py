from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
import datetime

class ExpenseCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True

class ExpenseCategoryResponse(ExpenseCategoryBase):
    id: int
    business_id: int
    model_config = ConfigDict(from_attributes=True)

class ExpenseCreate(BaseModel):
    category_id: int
    amount: float = Field(gt=0)
    expense_date: datetime.date
    payment_method: str = "CASH" # CASH, UPI, BANK, CARD
    vendor: Optional[str] = None
    gstin: Optional[str] = None
    is_gst_applicable: bool = False
    gst_amount: float = Field(default=0.0, ge=0)
    notes: Optional[str] = None

class ExpenseResponse(BaseModel):
    id: int
    business_id: int
    category_id: int
    category_name: Optional[str] = None
    amount: float
    expense_date: datetime.date
    payment_method: str
    vendor: Optional[str] = None
    is_gst_applicable: bool
    gst_amount: float
    notes: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class AccountBase(BaseModel):
    name: str
    account_type: str # CASH, BANK, UPI, CARD
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    upi_id: Optional[str] = None
    opening_balance: float = 0.0

class AccountResponse(AccountBase):
    id: int
    business_id: int
    current_balance: float
    is_default: bool
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class CashReconciliationRequest(BaseModel):
    target_date: datetime.date
    actual_physical_cash: float = Field(ge=0)
    notes: Optional[str] = None

class CashReconciliationResponse(BaseModel):
    id: int
    business_id: int
    reconciliation_date: datetime.date
    opening_cash: float
    cash_sales: float
    customer_cash_collected: float
    emi_cash_collected: float
    cash_expenses: float
    supplier_cash_paid: float
    system_expected_cash: float
    actual_physical_cash: float
    discrepancy: float
    status: str
    notes: Optional[str] = None
    created_at: datetime.datetime
    model_config = ConfigDict(from_attributes=True)
