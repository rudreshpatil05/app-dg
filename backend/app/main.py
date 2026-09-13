from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
import app.models
from app.routers import (
    auth, dashboard, inventory, pos, customers, emi, purchases, suppliers, finance, specialized, reports, settings as settings_router
)

# Initialize database schema
Base.metadata.create_all(bind=engine)

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
    allow_methods=["*"],
    allow_headers=["*"],
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
