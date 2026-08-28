"""
FastAPI application entrypoint.
Run with: uvicorn app.main:app --reload
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import Base, engine
from app.models import models  # noqa: F401 - ensures models are registered before create_all
from app.routers import auth, weather, predict, dashboard, admin, reports, risk, safety, evacuation, warnings

# Create all tables on startup (SQLite or PostgreSQL)
try:
    Base.metadata.create_all(bind=engine)
except Exception as exc:
    print(f"Warning: Could not create tables on initial startup: {exc}")

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

app = FastAPI(
    title="Disaster Intel — Early Warning & Emergency Response API",
    description=(
        "AI-assisted early disaster warning, flood risk estimation, "
        "safe area identification, and evacuation routing. "
        "This system estimates risk — it does not claim to perfectly predict natural disasters."
    ),
    version="2.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=r"https://.*(\.onrender\.com|\.vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core routers
app.include_router(auth.router)
app.include_router(weather.router)
app.include_router(predict.router)
app.include_router(dashboard.router)
app.include_router(admin.router)
app.include_router(reports.router)

# New early-warning pipeline routers
app.include_router(risk.router)
app.include_router(safety.router)
app.include_router(evacuation.router)
app.include_router(warnings.router)


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "disaster-intel-api",
        "version": "2.0.0",
        "description": "AI-assisted early disaster warning and emergency response platform",
    }


@app.get("/health")
def health():
    return {"status": "healthy", "version": "2.0.0"}


import traceback


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    # Never expose stack traces to end users
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again."},
    )
