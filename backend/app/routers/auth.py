from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User, Role, Business
from app.schemas.auth import LoginRequest, PinLoginRequest, TokenResponse, UserResponse, BusinessResponse
from app.auth import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication & Staff"])

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is deactivated")

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.code})
    
    user_resp = UserResponse.model_validate(user)
    user_resp.role_code = user.role.code
    biz_resp = BusinessResponse.model_validate(user.business)
    
    return TokenResponse(access_token=access_token, user=user_resp, business=biz_resp)

@router.post("/pin-login", response_model=TokenResponse)
def pin_login(req: PinLoginRequest, db: Session = Depends(get_db)):
    """
    Rapid PIN authentication for retail store counter terminals.
    """
    user = db.query(User).filter(
        User.business_id == req.business_id,
        User.pin == req.pin,
        User.is_active == True
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid PIN")

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.code})
    
    user_resp = UserResponse.model_validate(user)
    user_resp.role_code = user.role.code
    biz_resp = BusinessResponse.model_validate(user.business)
    
    return TokenResponse(access_token=access_token, user=user_resp, business=biz_resp)

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    user_resp = UserResponse.model_validate(current_user)
    user_resp.role_code = current_user.role.code if current_user.role else "STAFF"
    return user_resp

@router.get("/staff", response_model=list[UserResponse])
def get_all_staff(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    users = db.query(User).filter(User.business_id == current_user.business_id, User.is_active == True).all()
    results = []
    for u in users:
        ur = UserResponse.model_validate(u)
        ur.role_code = u.role.code if u.role else "STAFF"
        results.append(ur)
    return results

@router.get("/business", response_model=BusinessResponse)
def get_business_details(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    biz = db.query(Business).filter(Business.id == current_user.business_id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    return BusinessResponse.model_validate(biz)

@router.put("/business", response_model=BusinessResponse)
def update_business_details(update_data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    biz = db.query(Business).filter(Business.id == current_user.business_id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    
    for k, v in update_data.items():
        if hasattr(biz, k):
            setattr(biz, k, v)
    
    db.commit()
    db.refresh(biz)
    return BusinessResponse.model_validate(biz)
