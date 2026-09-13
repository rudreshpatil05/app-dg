from typing import Optional, Any
from pydantic import BaseModel, ConfigDict

class BusinessBase(BaseModel):
    name: str
    legal_name: Optional[str] = None
    gstin: Optional[str] = None
    phone: str
    alternate_phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: str = "Pune"
    state: str = "Maharashtra"
    state_code: str = "27"
    pincode: Optional[str] = None
    logo_url: Optional[str] = None
    upi_id: Optional[str] = None
    invoice_prefix: str = "INV"
    thermal_printer_width: str = "80mm"
    terms_and_conditions: Optional[str] = None

class BusinessResponse(BusinessBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    username: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    pin: Optional[str] = None
    is_active: bool = True

class UserCreate(UserBase):
    password: str
    role_code: str = "STAFF" # OWNER, MANAGER, STAFF, ACCOUNTANT
    business_id: int = 1

class UserResponse(UserBase):
    id: int
    business_id: int
    role_id: int
    role_code: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class LoginRequest(BaseModel):
    username: str
    password: str

class PinLoginRequest(BaseModel):
    pin: str
    business_id: int = 1

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    business: BusinessResponse
