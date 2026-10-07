import os
import secrets
from pathlib import Path
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
DEV_SECRET_PATH = BASE_DIR / ".dev_secret_key"


def get_secret_key() -> str:
    configured_key = os.getenv("SECRET_KEY")

    if configured_key:
        return configured_key

    if DEV_SECRET_PATH.exists():
        return DEV_SECRET_PATH.read_text(encoding="utf-8").strip()

    generated_key = secrets.token_urlsafe(32)
    DEV_SECRET_PATH.write_text(generated_key, encoding="utf-8")

    return generated_key


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False,
    )

    PROJECT_NAME: str = "DG-Retail OS"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    SEED_DATABASE: bool = False

    DATABASE_URL: str | None = Field(
        default=None,
        validate_default=True,
    )

    # JWT / Security
    SECRET_KEY: str | None = Field(
        default=None,
        validate_default=True,
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # CORS
    BACKEND_CORS_ORIGINS: list[str] | str = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
        ]
    )

    # Default Business Profile
    DEFAULT_CURRENCY: str = "INR"
    DEFAULT_CURRENCY_SYMBOL: str = "₹"
    DEFAULT_GST_RATE: float = 18.0
    DEFAULT_HSN_MOBILE: str = "8517"
    DEFAULT_HSN_ACCESSORIES: str = "8518"

    @field_validator("ENVIRONMENT", mode="before")
    @classmethod
    def normalize_environment(cls, value: Any) -> str:
        return str(value).strip().lower()

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> list[str]:
        if isinstance(value, str):
            return [
                origin.strip()
                for origin in value.split(",")
                if origin.strip()
            ]
        return value

    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, value: Any, info) -> str:
        if value:
            return str(value)

        environment = str(
            info.data.get("ENVIRONMENT", "development")
        ).strip().lower()

        if environment == "production":
            raise RuntimeError(
                "SECRET_KEY must be set explicitly in production"
            )

        return get_secret_key()

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, value: Any, info) -> str:
        environment = str(
            info.data.get("ENVIRONMENT", "development")
        ).strip().lower()

        if not value:
            if environment in {"staging", "production"}:
                raise RuntimeError(
                    "DATABASE_URL must be set explicitly in staging/production"
                )

            value = f"sqlite:///{BASE_DIR / 'dg_retail.db'}"

        value = str(value).strip()

        if value.lower().startswith("mysql://"):
            value = value.replace(
                "mysql://",
                "mysql+pymysql://",
                1,
            )

        if environment in {"staging", "production"}:
            if value.lower().startswith("sqlite"):
                raise RuntimeError(
                    "SQLite is not permitted in staging/production; "
                    "configure a MySQL DATABASE_URL"
                )

        return value

    @field_validator("BACKEND_CORS_ORIGINS")
    @classmethod
    def validate_cors_origins(cls, value: list[str] | str) -> list[str]:
        if isinstance(value, str):
            value = [
                origin.strip()
                for origin in value.split(",")
                if origin.strip()
            ]

        if not value:
            raise ValueError(
                "BACKEND_CORS_ORIGINS must contain at least one "
                "trusted frontend origin"
            )

        return value


settings = Settings()