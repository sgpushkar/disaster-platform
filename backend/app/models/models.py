"""
SQLAlchemy ORM models for every table in the platform.
"""
import enum
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Enum, ForeignKey, Text, Boolean
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class RoleEnum(str, enum.Enum):
    user = "user"
    admin = "admin"


class RiskLevelEnum(str, enum.Enum):
    low = "Low"
    moderate = "Moderate"
    high = "High"
    critical = "Critical"


class RiskTrendEnum(str, enum.Enum):
    stable = "STABLE"
    increasing = "INCREASING"
    rapidly_increasing = "RAPIDLY_INCREASING"
    decreasing = "DECREASING"
    unknown = "UNKNOWN"


class AlertSourceEnum(str, enum.Enum):
    ai = "ai"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)  # bcrypt hash, never plaintext
    role = Column(Enum(RoleEnum), default=RoleEnum.user, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    predictions = relationship("Prediction", back_populates="user")
    flood_images = relationship("FloodImage", back_populates="user")


class WeatherData(Base):
    __tablename__ = "weather_data"

    id = Column(Integer, primary_key=True, index=True)
    temperature = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    wind_speed = Column(Float, nullable=False)
    rainfall = Column(Float, default=0.0)
    pressure = Column(Float, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_name = Column(String(150), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    prediction_type = Column(String(50), nullable=False)  # 'flood_image' | 'rainfall' | 'risk_combined'
    confidence = Column(Float, nullable=False)
    risk_level = Column(Enum(RiskLevelEnum), nullable=False)
    risk_score = Column(Float, nullable=True)
    details_json = Column(Text, nullable=True)  # raw JSON blob of inputs/outputs
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="predictions")


class FloodImage(Base):
    __tablename__ = "flood_images"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    filename = Column(String(255), nullable=False)
    prediction = Column(String(50), nullable=False)  # 'Flood' | 'No Flood'
    confidence = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="flood_images")


class EmergencyLocation(Base):
    __tablename__ = "emergency_locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    # Extended types: hospital | shelter | police | fire_station | safe_zone | danger_zone
    type = Column(String(50), nullable=False)
    capacity = Column(Integer, nullable=True)           # max occupancy
    current_occupancy = Column(Integer, nullable=True)  # current count
    availability_status = Column(String(50), nullable=True)  # open | full | closed
    risk_level = Column(String(20), nullable=True)      # risk at this location
    description = Column(String(500), nullable=True)
    contact = Column(String(150), nullable=True)
    is_seed_data = Column(Boolean, default=False)       # dev seed data flag
    created_at = Column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=True)          # short headline
    message = Column(String(1000), nullable=False)
    risk_level = Column(Enum(RiskLevelEnum), nullable=False)
    risk_score = Column(Float, nullable=True)           # numeric score at time of alert
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_name = Column(String(150), nullable=True)
    recommended_action = Column(String(500), nullable=True)
    source = Column(Enum(AlertSourceEnum), default=AlertSourceEnum.ai, nullable=False)
    expires_at = Column(DateTime, nullable=True)        # None = never expires
    is_active = Column(Boolean, default=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class RiskSnapshot(Base):
    """Stores computed risk scores over time for trend analysis."""
    __tablename__ = "risk_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    risk_score = Column(Float, nullable=False)
    risk_level = Column(Enum(RiskLevelEnum), nullable=False)
    risk_trend = Column(Enum(RiskTrendEnum), default=RiskTrendEnum.unknown)
    confidence = Column(Float, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_name = Column(String(150), nullable=True)
    weather_score = Column(Float, nullable=True)        # sub-scores for breakdown
    rainfall_score = Column(Float, nullable=True)
    historical_score = Column(Float, nullable=True)
    image_score = Column(Float, nullable=True)
    explanation_json = Column(Text, nullable=True)      # contributing factors
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class DangerZone(Base):
    """Dynamic danger zones computed or admin-defined."""
    __tablename__ = "danger_zones"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_m = Column(Float, default=800.0)             # radius in metres
    risk_score = Column(Float, nullable=False)
    risk_level = Column(Enum(RiskLevelEnum), nullable=False)
    source = Column(String(50), nullable=True)          # 'ai' | 'admin' | 'sensor'
    description = Column(String(300), nullable=True)
    is_active = Column(Boolean, default=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=True)
