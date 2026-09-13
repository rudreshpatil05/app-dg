import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "DG-Retail OS"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database: Default to local SQLite for instant portability, with full support for Postgres/Supabase
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'dg_retail.db'}")
    
    # JWT / Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dg-retail-os-super-secret-key-for-mobile-electronics-india-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "*"]
    
    # Default Business Profile (Indian Mobile Retail)
    DEFAULT_CURRENCY: str = "INR"
    DEFAULT_CURRENCY_SYMBOL: str = "₹"
    DEFAULT_GST_RATE: float = 18.0  # Standard GST for electronics & mobile phones
    DEFAULT_HSN_MOBILE: str = "8517"
    DEFAULT_HSN_ACCESSORIES: str = "8518"

settings = Settings()
