from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# Configure SQLite for local development or PostgreSQL for shared environments.
connect_args = {}
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
if is_sqlite:
    connect_args = {"check_same_thread": False}

engine_options = {"connect_args": connect_args, "echo": False, "future": True}
if not is_sqlite:
    engine_options.update({"pool_pre_ping": True, "pool_recycle": 1800})

engine = create_engine(settings.DATABASE_URL, **engine_options)

# Enable SQLite foreign key enforcement and WAL mode
if is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


def ensure_runtime_schema_compatibility():
    """Apply additive local-development changes without rewriting existing data."""
    inspector = inspect(engine)
    if "sales" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("sales")}
    if "idempotency_key" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE sales ADD COLUMN idempotency_key VARCHAR(100)"))
    index_names = {index["name"] for index in inspector.get_indexes("sales")}
    if "uq_sales_business_idempotency" not in index_names:
        with engine.begin() as connection:
            connection.execute(text(
                "CREATE UNIQUE INDEX uq_sales_business_idempotency "
                "ON sales (business_id, idempotency_key)"
            ))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
