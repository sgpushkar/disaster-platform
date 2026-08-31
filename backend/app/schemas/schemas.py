"""
Pydantic schemas — request/response contracts for the API.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
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


# ---------- Risk Snapshot ----------
class RiskSnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    risk_score: float
    risk_level: str
    risk_trend: str
    confidence: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    weather_score: Optional[float] = None
    rainfall_score: Optional[float] = None
    historical_score: Optional[float] = None
    image_score: Optional[float] = None
    explanation_json: Optional[str] = None
    created_at: datetime


class RiskCurrentOut(BaseModel):
    """Full current risk response with explanation."""
    risk_score: float
    risk_level: str
    risk_trend: str
    confidence: float
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    contributing_factors: List[Dict[str, Any]] = []
    specific_risks: Dict[str, float] = {}
    recommendation: str = ""
    warning_generated: bool = False
    snapshot_id: Optional[int] = None


class RiskTrendOut(BaseModel):
    trend: str
    current_score: float
    previous_score: Optional[float] = None
    highest_recent: float
    average_recent: float
    snapshots: List[RiskSnapshotOut] = []


# ---------- Emergency locations / GIS ----------
class EmergencyLocationCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    type: str  # hospital | shelter | police | fire_station | safe_zone | danger_zone
    capacity: Optional[int] = None
    current_occupancy: Optional[int] = None
    availability_status: Optional[str] = None  # open | full | closed
    risk_level: Optional[str] = None
    description: Optional[str] = None
    contact: Optional[str] = None


class EmergencyLocationOut(EmergencyLocationCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_seed_data: Optional[bool] = False
    created_at: datetime


# ---------- Safe Areas ----------
class SafeAreaResult(BaseModel):
    location: EmergencyLocationOut
    distance_km: float
    estimated_minutes: int
    safety_score: float  # 0-100
    destination_risk: str
    reason: str


class SafeAreasOut(BaseModel):
    user_latitude: float
    user_longitude: float
    results: List[SafeAreaResult]
    top_recommendation: Optional[SafeAreaResult] = None


# ---------- Evacuation Routing ----------
class EvacuationRouteOut(BaseModel):
    from_lat: float
    from_lon: float
    to_lat: float
    to_lon: float
    to_name: str
    distance_km: float
    estimated_minutes: int
    provider: str  # 'osrm' | 'straight_line'
    route_coordinates: List[List[float]] = []  # [[lat,lon], ...]
    risk_notes: str = ""


# ---------- Danger Zones ----------
class DangerZoneCreate(BaseModel):
    latitude: float
    longitude: float
    radius_m: float = 800.0
    risk_score: float
    risk_level: str
    source: Optional[str] = "admin"
    description: Optional[str] = None
    expires_at: Optional[datetime] = None


class DangerZoneOut(DangerZoneCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool
    timestamp: datetime


# ---------- Alerts ----------
class AlertCreate(BaseModel):
    title: Optional[str] = None
    message: str
    risk_level: str
    risk_score: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    recommended_action: Optional[str] = None
    expires_at: Optional[datetime] = None


class AlertOut(AlertCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source: str
    is_active: bool
    timestamp: datetime


# ---------- Early Warning ----------
class EarlyWarningOut(BaseModel):
    warning_issued: bool
    warning_level: str  # none | advisory | warning | emergency
    risk_score: float
    risk_level: str
    risk_trend: str
    title: Optional[str] = None
    message: Optional[str] = None
    recommended_action: Optional[str] = None
    alert_id: Optional[int] = None


# ---------- Dashboard ----------
class DashboardOut(BaseModel):
    current_weather: Optional[WeatherOut]
    latest_flood_prediction: Optional[FloodImageOut]
    latest_rainfall_forecast: Optional[RainfallPredictOut]
    current_risk: Optional[RiskPredictionOut]
    recent_alerts: List[AlertOut]
    current_risk_snapshot: Optional[RiskSnapshotOut] = None
    active_warnings_count: int = 0
