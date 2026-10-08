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
from app.routers import auth, weather, predict, dashboard, admin, reports, risk, safety, evacuation, warnings, sms

# Create all tables and ensure columns on startup (SQLite or PostgreSQL)
try:
    Base.metadata.create_all(bind=engine)
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    try:
        user_cols = [c["name"] for c in inspector.get_columns("users")]
        if "phone" not in user_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(30)"))
    except Exception as e:
        print(f"Users table migration note: {e}")

    try:
        alert_cols = [c["name"] for c in inspector.get_columns("alerts")]
        if "disaster_type" not in alert_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE alerts ADD COLUMN disaster_type VARCHAR(50) DEFAULT 'flood'"))
    except Exception as e:
        print(f"Alerts table migration note: {e}")
except Exception as exc:
    print(f"Warning: Could not create/verify tables on startup: {exc}")

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
app.include_router(sms.router)


@app.on_event("startup")
def seed_admin_users():
    from app.core.database import SessionLocal
    from app.models.models import User, RoleEnum
    from app.core.security import hash_password

    db = SessionLocal()
    try:
        # Promote any existing user with pushkar, srushti or dhruvika in name or email
        for user in db.query(User).all():
            nl = (user.name or "").lower()
            el = (user.email or "").lower()
            if (
                "pushkar" in nl or "pushkar" in el
                or "srushti" in nl or "srushti" in el
                or "dhruvika" in nl or "dhruvika" in el
            ):
                user.role = RoleEnum.admin

        # Ensure Pushkar primary admin exists
        pushkar = db.query(User).filter(User.email == "pushkarmhatre424@gmail.com").first()
        if not pushkar:
            pushkar = User(
                name="Pushkar Mhatre",
                email="pushkarmhatre424@gmail.com",
                phone="+919876543210",
                password=hash_password("password123"),
                role=RoleEnum.admin,
            )
            db.add(pushkar)
        else:
            pushkar.role = RoleEnum.admin
            if not pushkar.phone:
                pushkar.phone = "+919876543210"
            if not pushkar.password:
                pushkar.password = hash_password("password123")

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
