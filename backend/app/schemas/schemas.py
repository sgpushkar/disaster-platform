"""
Pydantic schemas — request/response contracts for the API.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ---------- Auth ----------
class UserSignup(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: EmailStr
    role: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Weather ----------
class WeatherOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    temperature: float
    humidity: float
    wind_speed: float
    rainfall: float
    pressure: float
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    timestamp: datetime


# ---------- Predictions ----------
class FloodImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    prediction: str
    confidence: float
    created_at: datetime


class RainfallPredictRequest(BaseModel):
    # last N days of rainfall in mm, oldest first. Must match model's timestep window.
    recent_rainfall_mm: List[float] = Field(min_length=7, max_length=60)


class RainfallPredictOut(BaseModel):
    tomorrow_mm: float
    next_3_days_mm: List[float]


class RiskPredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    prediction_type: str
    confidence: float
    risk_level: str
    risk_score: Optional[float]
    created_at: datetime


class CombinedRiskRequest(BaseModel):
    flood_image_confidence: Optional[float] = None
    flood_image_label: Optional[str] = None
    rainfall_forecast_mm: Optional[float] = None
    use_latest_weather: bool = True


class CombinedRiskOut(BaseModel):
    risk_score: float
    risk_level: str
    breakdown: dict


# ---------- Emergency locations / GIS ----------
class EmergencyLocationCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    type: str  # hospital | shelter | police | danger_zone


class EmergencyLocationOut(EmergencyLocationCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# ---------- Alerts ----------
class AlertCreate(BaseModel):
    message: str
    risk_level: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AlertOut(AlertCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    timestamp: datetime


# ---------- Dashboard ----------
class DashboardOut(BaseModel):
    current_weather: Optional[WeatherOut]
    latest_flood_prediction: Optional[FloodImageOut]
    latest_rainfall_forecast: Optional[RainfallPredictOut]
    current_risk: Optional[RiskPredictionOut]
    recent_alerts: List[AlertOut]
