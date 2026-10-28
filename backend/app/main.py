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

    def _ensure_col(table_name: str, col_name: str, col_def: str):
        try:
            cols = [c["name"] for c in inspector.get_columns(table_name)]
            if col_name not in cols:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"))
        except Exception as e:
            print(f"Migration notice ({table_name}.{col_name}): {e}")

    # Users migrations
    _ensure_col("users", "phone", "VARCHAR(30)")

    # Emergency locations migrations
    _ensure_col("emergency_locations", "capacity", "INTEGER")
    _ensure_col("emergency_locations", "current_occupancy", "INTEGER")
    _ensure_col("emergency_locations", "availability_status", "VARCHAR(50)")
    _ensure_col("emergency_locations", "risk_level", "VARCHAR(20)")
    _ensure_col("emergency_locations", "description", "VARCHAR(500)")
    _ensure_col("emergency_locations", "contact", "VARCHAR(150)")
    _ensure_col("emergency_locations", "is_seed_data", "BOOLEAN DEFAULT 0")

    # Alerts migrations
    _ensure_col("alerts", "title", "VARCHAR(200)")
    _ensure_col("alerts", "disaster_type", "VARCHAR(50) DEFAULT 'disaster'")
    _ensure_col("alerts", "risk_score", "FLOAT")
    _ensure_col("alerts", "location_name", "VARCHAR(150)")
    _ensure_col("alerts", "recommended_action", "VARCHAR(500)")
    _ensure_col("alerts", "source", "VARCHAR(50) DEFAULT 'ai'")
    _ensure_col("alerts", "expires_at", "DATETIME")
    _ensure_col("alerts", "is_active", "BOOLEAN DEFAULT 1")
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
    from app.models.models import User, RoleEnum, EmergencyLocation
    from app.core.security import hash_password
    from app.services.seed_data import seed_default_locations

    db = SessionLocal()
    try:
        # Promote admin users
        for user in db.query(User).all():
            nl = (user.name or "").lower()
            el = (user.email or "").lower()
            if (
                "admin" in el or "admin" in nl
                or "alex" in nl
                or "srushti" in nl or "srushti" in el
                or "dhruvika" in nl or "dhruvika" in el
            ):
                user.role = RoleEnum.admin

        # Ensure demo primary admin exists (Alex Morgan)
        admin_user = db.query(User).filter(User.email == "admin@disaster-intel.gov").first()
        if not admin_user:
            admin_user = User(
                name="Alex Morgan",
                email="admin@disaster-intel.gov",
                phone="+919876543210",
                password=hash_password("password123"),
                role=RoleEnum.admin,
            )
            db.add(admin_user)
        else:
            admin_user.role = RoleEnum.admin
            if not admin_user.phone:
                admin_user.phone = "+919876543210"
            if not admin_user.password:
                admin_user.password = hash_password("password123")

        # Migrate any legacy pushkar user record to demo admin
        legacy_user = db.query(User).filter(User.email == "pushkarmhatre424@gmail.com").first()
        if legacy_user:
            legacy_user.name = "Alex Morgan"
            legacy_user.email = "alex.morgan@disaster-intel.gov"
            legacy_user.role = RoleEnum.admin

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

        # Ensure emergency locations (shelters, safe zones, hospitals) are always seeded
        loc_count = db.query(EmergencyLocation).count()
        if loc_count == 0:
            seed_default_locations(db)

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Warning during startup seeding: {e}")
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
