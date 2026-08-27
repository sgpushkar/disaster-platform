"""
SQLAlchemy engine + session management.
Supports both SQLite (local dev) and PostgreSQL (Render production).
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

# For SQLite: ensure the database directory exists
if settings.DATABASE_URL.startswith("sqlite:///"):
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

# SQLite needs check_same_thread=False; PostgreSQL does not need any special args
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
