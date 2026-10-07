import datetime
import hashlib
import hmac
import secrets
from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt
from app.config import settings
from app.database import get_db
from app.models.auth import User, Role, Business

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

class ActiveUserContext:
    """Authenticated user plus the store selected for the current request."""
    def __init__(self, user: User, active_business_id: int):
        self.user = user
        self.active_business_id = active_business_id

    @property
    def business_id(self):
        return self.active_business_id

    def __getattr__(self, name):
        return getattr(self.user, name)

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310_000)
    return f"pbkdf2_sha256$310000${salt.hex()}${digest.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith("pbkdf2_sha256$"):
        try:
            _, iterations, salt_hex, digest_hex = hashed_password.split("$", 3)
            expected = hashlib.pbkdf2_hmac(
                "sha256", plain_password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
            ).hex()
            return hmac.compare_digest(expected, digest_hex)
        except (ValueError, TypeError):
            return False

    # Compatibility for existing installations; successful login upgrades the hash.
    legacy_digest = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
    return hmac.compare_digest(legacy_digest, hashed_password)

def hash_pin(pin: str) -> str:
    return hash_password(pin)

def verify_pin(pin: str, stored_pin: str) -> bool:
    return verify_password(pin, stored_pin)

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.now(datetime.timezone.utc) + expires_delta
    else:
        expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    x_active_business_id: Optional[str] = Header(None, alias="X-Active-Business-Id"),
    db: Session = Depends(get_db)
) -> ActiveUserContext:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user = db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
        return _scope_user(user, x_active_business_id, db)
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

def _scope_user(user: User, requested_business_id: Optional[str], db: Session) -> ActiveUserContext:
    role_code = user.role.code if user.role else "STAFF"
    active_business_id = user.business_id

    if requested_business_id:
        try:
            requested_id = int(requested_business_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid active store")

        business = db.query(Business).filter(Business.id == requested_id, Business.is_active == True).first()
        if not business:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found or inactive")
        if role_code != "OWNER" and requested_id != user.business_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only access your assigned store")
        active_business_id = requested_id

    return ActiveUserContext(user, active_business_id)

def require_role(allowed_roles: list[str]):
    def role_checker(current_user: ActiveUserContext = Depends(get_current_user)):
        role_code = current_user.role.code if current_user.role else "STAFF"
        if role_code not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker
