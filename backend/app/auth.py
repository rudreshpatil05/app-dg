import datetime
import hashlib
from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt
from app.config import settings
from app.database import get_db
from app.models.auth import User, Role, Business

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"), # Quick counter role override for active session
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db)
) -> User:
    """
    Resolves current authenticated user with support for token auth or seamless counter switch.
    Default falls back to primary Owner user if header or token provided.
    """
    if token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id: int = payload.get("sub")
            if user_id is None:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
            user = db.query(User).filter(User.id == int(user_id)).first()
            if not user:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
            return user
        except jwt.PyJWTError:
            pass

    if x_user_id:
        user = db.query(User).filter(User.id == int(x_user_id)).first()
        if user:
            return user

    if x_user_role:
        role = db.query(Role).filter(Role.code == x_user_role.upper()).first()
        if role:
            user = db.query(User).filter(User.role_id == role.id).first()
            if user:
                return user

    # Default fallback: active store owner
    owner_user = db.query(User).join(Role).filter(Role.code == "OWNER").first()
    if owner_user:
        return owner_user
    
    # Absolute fallback
    first_user = db.query(User).first()
    if first_user:
        return first_user

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

def require_role(allowed_roles: list[str]):
    def role_checker(current_user: User = Depends(get_current_user)):
        role_code = current_user.role.code if current_user.role else "STAFF"
        if role_code not in allowed_roles and "OWNER" not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker
