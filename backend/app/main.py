from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.seed import seed_database
import app.models
from app.routers import (
    auth, dashboard, inventory, pos, customers, emi, purchases, suppliers, finance, specialized, reports, settings as settings_router
)

# Initialize local/staging schema only. Production schema changes must use a
# reviewed migration against the configured MySQL database.
if settings.ENVIRONMENT.lower() != "production":
    Base.metadata.create_all(bind=engine)
if settings.ENVIRONMENT.lower() == "development" or (
    settings.ENVIRONMENT.lower() == "staging" and settings.SEED_DATABASE
):
    seed_database()

app = FastAPI(
    title="DG-Retail OS - Mobile & Electronics Retail API",
    description="All-in-one Retail Operating System combining Khatabook + Vyapar + Specialized Mobile & Electronics Store ERP",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Active-Business-Id"],
)

# Mount API Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(inventory.router, prefix=settings.API_V1_STR)
app.include_router(pos.router, prefix=settings.API_V1_STR)
app.include_router(customers.router, prefix=settings.API_V1_STR)
app.include_router(emi.router, prefix=settings.API_V1_STR)
app.include_router(purchases.router, prefix=settings.API_V1_STR)
app.include_router(suppliers.router, prefix=settings.API_V1_STR)
app.include_router(finance.router, prefix=settings.API_V1_STR)
app.include_router(specialized.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(settings_router.router, prefix=settings.API_V1_STR)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "DG-Retail OS",
        "version": settings.VERSION,
        "currency": settings.DEFAULT_CURRENCY,
        "currency_symbol": settings.DEFAULT_CURRENCY_SYMBOL
    }
