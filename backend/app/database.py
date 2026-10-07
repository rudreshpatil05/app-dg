from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# Configure SQLite for local development or MySQL for shared environments.
connect_args = {}
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
is_mysql = settings.DATABASE_URL.startswith("mysql")
if is_sqlite:
    connect_args = {"check_same_thread": False}

engine_options = {"connect_args": connect_args, "echo": False, "future": True}
if is_mysql:
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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
