"""
SQLAlchemy ORM models for every table in the platform.
"""
import enum
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Enum, ForeignKey, Text
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
    type = Column(String(50), nullable=False)  # 'hospital' | 'shelter' | 'police' | 'danger_zone'
    created_at = Column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    message = Column(String(500), nullable=False)
    risk_level = Column(Enum(RiskLevelEnum), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
