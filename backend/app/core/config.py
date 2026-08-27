"""
Centralized application configuration.
Reads from environment variables / .env file so no secrets are hardcoded.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Security
    SECRET_KEY: str = "insecure_dev_key_change_me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Database — use PostgreSQL on Render (set DATABASE_URL env var in Render dashboard)
    # Falls back to local SQLite for development
    DATABASE_URL: str = "sqlite:///./database/disaster.db"

    # OpenWeatherMap
    OPENWEATHER_API_KEY: str = ""
    OPENWEATHER_DEFAULT_LAT: float = 18.5204
    OPENWEATHER_DEFAULT_LON: float = 73.8567  # Pune default

    # CORS — can be a single URL or comma-separated list
    # e.g. "https://my-app.vercel.app,http://localhost:5173"
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    # ML model paths — relative to backend/ working directory
    FLOOD_MODEL_PATH: str = "models/flood_model.keras"
    RAINFALL_MODEL_PATH: str = "models/lstm_model.keras"
    RAINFALL_SCALER_PATH: str = "models/rainfall_scaler.pkl"

    # -------------------------------------------------------
    # Risk Engine — configurable weights (must sum to 1.0)
    # -------------------------------------------------------
    # weather:           live OWM conditions (humidity, wind, pressure)
    # rainfall_forecast: LSTM/OWM predicted rainfall next 24-48h
    # historical_trend:  recent risk trajectory from stored snapshots
    # image_evidence:    optional CNN flood image classification
    RISK_WEIGHT_WEATHER: float = 0.25
    RISK_WEIGHT_RAINFALL_FORECAST: float = 0.40
    RISK_WEIGHT_HISTORICAL_TREND: float = 0.20
    RISK_WEIGHT_IMAGE_EVIDENCE: float = 0.15

    # -------------------------------------------------------
    # Early Warning thresholds
    # -------------------------------------------------------
    WARNING_THRESHOLD_MODERATE: float = 25.0
    WARNING_THRESHOLD_HIGH: float = 50.0
    WARNING_THRESHOLD_CRITICAL: float = 75.0

    # Alert deduplication window — don't re-alert within this many hours
    ALERT_DEDUP_HOURS: int = 6

    # -------------------------------------------------------
    # Weather cache
    # -------------------------------------------------------
    WEATHER_CACHE_SECONDS: int = 300  # 5 minutes

    # -------------------------------------------------------
    # Routing (OSRM public instance)
    # -------------------------------------------------------
    OSRM_BASE_URL: str = "https://router.project-osrm.org"

    @property
    def allowed_origins(self) -> list[str]:
        """Returns list of allowed CORS origins from comma-separated string."""
        return [o.strip() for o in self.FRONTEND_ORIGIN.split(",") if o.strip()]

    @property
    def risk_weights(self) -> dict:
        return {
            "weather": self.RISK_WEIGHT_WEATHER,
            "rainfall_forecast": self.RISK_WEIGHT_RAINFALL_FORECAST,
            "historical_trend": self.RISK_WEIGHT_HISTORICAL_TREND,
            "image_evidence": self.RISK_WEIGHT_IMAGE_EVIDENCE,
        }

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
