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


class DisasterAttributePredictRequest(BaseModel):
    # DisasterScope dataset attributes
    temperature: Optional[float] = Field(None, description="Ambient temperature (°C)")
    humidity: Optional[float] = Field(None, ge=0.0, le=100.0, description="Relative humidity (%)")
    wind_speed: Optional[float] = Field(None, ge=0.0, description="Wind speed (km/h)")
    air_quality_index: Optional[float] = Field(None, ge=0.0, description="Air quality index (AQI 0-500)")
    water_level: Optional[float] = Field(None, ge=0.0, description="Water depth / inundation (m)")
    building_damage_level: Optional[str] = Field("Undamaged", description="Undamaged | Minor | Moderate | Severe | Destroyed")
    road_condition: Optional[str] = Field("Intact", description="Intact | Obstructed | Damaged | Blocked")
    infrastructure_status: Optional[str] = Field("Intact", description="Intact | Damaged | Severely Damaged")
    vegetation_cover: Optional[float] = Field(None, ge=0.0, le=100.0, description="Vegetation cover (%)")
    people_detected: Optional[int] = Field(0, ge=0, description="Count of people detected")
    heat_signatures: Optional[int] = Field(0, ge=0, description="Count of heat signatures")
    hazardous_material_detected: Optional[int] = Field(0, ge=0, le=1, description="Hazardous material detected (0 or 1)")

    # Meteorological / Hydrological fields & backward compatibility
    rainfall_24h_mm: Optional[float] = Field(None, description="24h precipitation in mm")
    rainfall_72h_mm: Optional[float] = Field(None, description="72h cumulative precipitation in mm")
    humidity_pct: Optional[float] = Field(None, ge=0.0, le=100.0, description="Relative humidity percentage")
    temperature_c: Optional[float] = Field(None, description="Temperature in Celsius")
    wind_speed_ms: Optional[float] = Field(None, ge=0.0, description="Wind speed in m/s")
    pressure_hpa: Optional[float] = Field(None, description="Barometric pressure in hPa")
    soil_moisture_pct: Optional[float] = Field(None, ge=0.0, le=100.0, description="Soil moisture index percentage")
    river_water_level_m: Optional[float] = Field(None, ge=0.0, description="River water level in meters")
    drainage_capacity_index: Optional[float] = Field(0.5, ge=0.0, le=1.0, description="Drainage capacity score 0.0-1.0")
    latitude: Optional[float] = Field(None, description="Current latitude")
    longitude: Optional[float] = Field(None, description="Current longitude")
    use_latest_weather: bool = True


class DisasterAttributePredictOut(BaseModel):
    risk_score: float
    risk_level: str
    flood_probability: float
    flood_predicted: bool
    disaster_severity_level: Optional[str] = "Low"
    affected_area_type: Optional[str] = "Unblocked"
    immediate_action_required: Optional[str] = "No"
    immediate_action_probability: Optional[float] = 0.0
    survivor_presence_likelihood: Optional[str] = "Low"
    survivor_probability: Optional[float] = 0.0
    urgency_score: Optional[float] = None
    recommendations: Optional[List[str]] = []
    contributing_factors: Dict[str, float] = {}
    input_attributes: Dict[str, Any] = {}
    input_telemetry: Optional[Dict[str, Any]] = None
    dataset_benchmarks: Optional[Dict[str, Any]] = None


class DisasterScopePredictRequest(DisasterAttributePredictRequest):
    pass


class DisasterScopePredictOut(DisasterAttributePredictOut):
    severity_probabilities: Optional[Dict[str, float]] = None
    area_type_probabilities: Optional[Dict[str, float]] = None
    feature_importances: Optional[Dict[str, float]] = None


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
    dataset_benchmarks: Optional[Dict[str, Any]] = None
    dataset_prediction: Optional[Dict[str, Any]] = None


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


# ---------- SMS Alerts ----------
class SMSSubscribeRequest(BaseModel):
    phone_number: str = Field(min_length=7, max_length=20, description="E.164 or national phone number")
    name: Optional[str] = Field(None, max_length=100)
    location_name: Optional[str] = Field("All Regions", max_length=150)
    min_risk_level: str = Field("High", description="Minimum alert severity: Moderate, High, or Critical")


class SMSUnsubscribeRequest(BaseModel):
    phone_number: str = Field(min_length=7, max_length=20)


class SMSSubscriberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    phone_number: str
    name: Optional[str] = None
    location_name: Optional[str] = "All Regions"
    min_risk_level: str
    is_active: bool
    created_at: datetime


class SMSLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    recipient: str
    message: str
    risk_level: Optional[str] = None
    alert_id: Optional[int] = None
    status: str
    provider_sid: Optional[str] = None
    error_message: Optional[str] = None
    sent_at: datetime


class SMSTestRequest(BaseModel):
    phone_number: str = Field(min_length=7, max_length=20)
    message: Optional[str] = None


class SMSStatusOut(BaseModel):
    provider: str
    is_live: bool
    total_subscribers: int
    active_subscribers: int
    recent_sms_count: int


class SMSBroadcastRequest(BaseModel):
    message: str = Field(min_length=5, max_length=500)
    min_risk_level: Optional[str] = "High"
    location_name: Optional[str] = None
