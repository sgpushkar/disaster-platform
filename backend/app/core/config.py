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
    OPENWEATHER_DEFAULT_LAT: float = 19.0760
    OPENWEATHER_DEFAULT_LON: float = 72.8777

    # CORS — can be a single URL or comma-separated list
    # e.g. "https://my-app.vercel.app,http://localhost:5173"
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    # ML model paths — relative to backend/ working directory
    FLOOD_MODEL_PATH: str = "models/flood_model.keras"
    RAINFALL_MODEL_PATH: str = "models/lstm_model.keras"
    RAINFALL_SCALER_PATH: str = "models/rainfall_scaler.pkl"

    @property
    def allowed_origins(self) -> list[str]:
        """Returns list of allowed CORS origins from comma-separated string."""
        return [o.strip() for o in self.FRONTEND_ORIGIN.split(",") if o.strip()]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
