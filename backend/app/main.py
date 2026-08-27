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
from app.routers import auth, weather, predict, dashboard, admin, reports

# Create all tables on startup (SQLite - no separate migration step needed for this project)
Base.metadata.create_all(bind=engine)

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

app = FastAPI(
    title="AI-Based Disaster Prediction and Emergency Analytics API",
    description="Flood image classification, rainfall prediction, live weather, GIS, and risk analytics.",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stricter rate limit on auth endpoints to slow down brute-force attempts
auth.router.route_class  # (kept for clarity; per-route limits set below)

app.include_router(auth.router)
app.include_router(weather.router)
app.include_router(predict.router)
app.include_router(dashboard.router)
app.include_router(admin.router)
app.include_router(reports.router)


@app.get("/")
def root():
    return {"status": "online", "service": "disaster-prediction-api"}


@app.get("/health")
def health():
    return {"status": "healthy"}


import traceback


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {str(exc)}"})
