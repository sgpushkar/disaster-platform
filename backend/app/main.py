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
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://.*(\.onrender\.com|\.vercel\.app)$",
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


@app.on_event("startup")
def seed_admin_users():
    from app.core.database import SessionLocal
    from app.models.models import User, RoleEnum
    from app.core.security import hash_password

    db = SessionLocal()
    try:
        # Promote any existing user with srushti or dhruvika in name or email
        for user in db.query(User).all():
            nl = (user.name or "").lower()
            el = (user.email or "").lower()
            if "srushti" in nl or "srushti" in el or "dhruvika" in nl or "dhruvika" in el:
                user.role = RoleEnum.admin

        # Ensure Srushti admin exists
        srushti = db.query(User).filter(User.email == "srushti@disaster-intel.gov").first()
        if not srushti:
            srushti = User(
                name="Srushti",
                email="srushti@disaster-intel.gov",
                password=hash_password("password123"),
                role=RoleEnum.admin,
            )
            db.add(srushti)

        # Ensure Dhruvika admin exists
        dhruvika = db.query(User).filter(User.email == "dhruvika@disaster-intel.gov").first()
        if not dhruvika:
            dhruvika = User(
                name="Dhruvika",
                email="dhruvika@disaster-intel.gov",
                password=hash_password("password123"),
                role=RoleEnum.admin,
            )
            db.add(dhruvika)

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Warning during admin user seeding: {e}")
    finally:
        db.close()


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
