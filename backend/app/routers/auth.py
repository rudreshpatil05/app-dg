from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User, Role, Business
from app.schemas.auth import BusinessUpdate, LoginRequest, PinLoginRequest, TokenResponse, UserResponse, BusinessResponse
from app.auth import verify_password, hash_password, verify_pin, hash_pin, create_access_token, get_current_user, require_role, ActiveUserContext

router = APIRouter(prefix="/auth", tags=["Authentication & Staff"])

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    identifier = req.username.strip()
    normalized_identifier = identifier.casefold()
    user = db.query(User).filter(
        or_(
            func.lower(User.username) == normalized_identifier,
            func.lower(User.email) == normalized_identifier,
        )
    ).first() if identifier else None
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account is inactive")

    if not user.hashed_password.startswith("pbkdf2_sha256$"):
        user.hashed_password = hash_password(req.password)
        db.commit()

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.code})
    
    user_resp = UserResponse.model_validate(user)
    user_resp.role_code = user.role.code
    user_resp.pin = None
    biz_resp = BusinessResponse.model_validate(user.business)
    
    return TokenResponse(access_token=access_token, user=user_resp, business=biz_resp)

@router.post("/pin-login", response_model=TokenResponse)
def pin_login(req: PinLoginRequest, db: Session = Depends(get_db)):
    """
    Rapid PIN authentication for retail store counter terminals.
    """
    users = db.query(User).filter(User.business_id == req.business_id, User.is_active == True).all()
    user = next((candidate for candidate in users if candidate.pin and verify_pin(req.pin, candidate.pin)), None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid PIN")

    if user.pin and not user.pin.startswith("pbkdf2_sha256$"):
        user.pin = hash_pin(req.pin)
        db.commit()

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.code})
    
    user_resp = UserResponse.model_validate(user)
    user_resp.role_code = user.role.code
    user_resp.pin = None
    biz_resp = BusinessResponse.model_validate(user.business)
    
    return TokenResponse(access_token=access_token, user=user_resp, business=biz_resp)

@router.get("/me", response_model=UserResponse)
def get_me(current_user: ActiveUserContext = Depends(get_current_user)):
    user_resp = UserResponse.model_validate(current_user)
    user_resp.role_code = current_user.role.code if current_user.role else "STAFF"
    user_resp.pin = None
    return user_resp

@router.get("/staff", response_model=list[UserResponse])
def get_all_staff(
    db: Session = Depends(get_db),
    current_user: ActiveUserContext = Depends(require_role(["OWNER"]))
):
    users = db.query(User).filter(User.business_id == current_user.business_id, User.is_active == True).all()
    results = []
    for u in users:
        ur = UserResponse.model_validate(u)
        ur.role_code = u.role.code if u.role else "STAFF"
        ur.pin = None
        results.append(ur)
    return results

@router.get("/business", response_model=BusinessResponse)
def get_business_details(db: Session = Depends(get_db), current_user: ActiveUserContext = Depends(get_current_user)):
    biz = db.query(Business).filter(Business.id == current_user.business_id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    return BusinessResponse.model_validate(biz)

@router.put("/business", response_model=BusinessResponse)
def update_business_details(
    update_data: BusinessUpdate,
    db: Session = Depends(get_db),
    current_user: ActiveUserContext = Depends(require_role(["OWNER"]))
):
    biz = db.query(Business).filter(Business.id == current_user.business_id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    
    for k, v in update_data.model_dump(exclude_unset=True).items():
        setattr(biz, k, v)
    
    db.commit()
    db.refresh(biz)
    return BusinessResponse.model_validate(biz)

@router.get("/businesses", response_model=list[BusinessResponse])
def get_available_businesses(db: Session = Depends(get_db), current_user: ActiveUserContext = Depends(get_current_user)):
    query = db.query(Business).filter(Business.is_active == True)
    if current_user.role.code != "OWNER":
        query = query.filter(Business.id == current_user.user.business_id)
    return [BusinessResponse.model_validate(biz) for biz in query.order_by(Business.name).all()]

@router.post("/switch-business", response_model=BusinessResponse)
def switch_business(business_id: int, db: Session = Depends(get_db), current_user: ActiveUserContext = Depends(get_current_user)):
    if current_user.role.code != "OWNER" and business_id != current_user.user.business_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only access your assigned store")
    business = db.query(Business).filter(Business.id == business_id, Business.is_active == True).first()
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found or inactive")
    return BusinessResponse.model_validate(business)
