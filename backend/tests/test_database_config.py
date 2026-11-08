import pytest
from pydantic import ValidationError

from app.config import Settings


@pytest.mark.parametrize(
    ("database_url", "expected_url"),
    [
        (
            "postgres://demo:password@db.example.com:5432/demo",
            "postgresql+psycopg://demo:password@db.example.com:5432/demo",
        ),
        (
            "postgresql://demo:password@db.example.com:5432/demo",
            "postgresql+psycopg://demo:password@db.example.com:5432/demo",
        ),
        (
            "postgresql+psycopg://demo:password@db.example.com:5432/demo",
            "postgresql+psycopg://demo:password@db.example.com:5432/demo",
        ),
    ],
)
def test_postgresql_database_urls_use_psycopg(database_url, expected_url):
    settings = Settings(
        _env_file=None,
        ENVIRONMENT="staging",
        DATABASE_URL=database_url,
        SECRET_KEY="test-secret",
    )

    assert settings.DATABASE_URL == expected_url


@pytest.mark.parametrize(
    ("environment", "database_url"),
    [
        ("staging", "sqlite:///demo.db"),
        ("production", "sqlite:///demo.db"),
        ("staging", "mysql://demo:password@db.example.com:3306/demo"),
    ],
)
def test_shared_environments_reject_non_postgresql_databases(
    environment,
    database_url,
):
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            ENVIRONMENT=environment,
            DATABASE_URL=database_url,
            SECRET_KEY="test-secret",
        )


def test_development_defaults_to_sqlite():
    settings = Settings(
        _env_file=None,
        ENVIRONMENT="development",
        SECRET_KEY="test-secret",
    )

    assert settings.DATABASE_URL.startswith("sqlite:///")
