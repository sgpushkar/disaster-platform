"""
SQLAlchemy engine + session management.
Supports both SQLite (local dev) and PostgreSQL (Render production).
"""
import logging
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

logger = logging.getLogger("disaster_platform.database")


def get_clean_database_url(raw_url: str) -> str:
    """
    Sanitizes DATABASE_URL:
    - Replaces placeholder template strings with SQLite default.
    - Normalizes legacy `postgres://` to `postgresql://` required by SQLAlchemy 1.4/2.0.
    """
    url = (raw_url or "").strip()
    if not url or "SET_THIS_TO_YOUR_NEON_POSTGRES_URL" in url:
        logger.warning(
            "DATABASE_URL is not set or contains default placeholder. Falling back to local SQLite database."
        )
        return "sqlite:///./database/disaster.db"

    # SQLAlchemy 2.0 requires postgresql:// instead of postgres://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    return url


DATABASE_URL = get_clean_database_url(settings.DATABASE_URL)

# Ensure database directory exists for SQLite
if DATABASE_URL.startswith("sqlite:///"):
    db_path = DATABASE_URL.replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
else:
    # PostgreSQL configuration
    try:
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    except Exception as e:
        logger.error(
            f"Failed to create PostgreSQL engine with URL '{DATABASE_URL}': {e}. Falling back to SQLite."
        )
        os.makedirs("./database", exist_ok=True)
        engine = create_engine(
            "sqlite:///./database/disaster.db", connect_args={"check_same_thread": False}
        )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

