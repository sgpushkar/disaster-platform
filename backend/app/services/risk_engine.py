"""
Risk Engine: fuses flood-image confidence, rainfall forecast, and live weather
into a single 0-100 risk score and a categorical risk level.

Weighting rationale (documented for the project report):
    - Flood image evidence (visual confirmation)   -> 40%
    - Rainfall forecast (predictive signal)         -> 35%
    - Live weather severity (humidity/wind/pressure)-> 25%
Each sub-signal is normalized to 0-100 before weighting so the final score
stays interpretable regardless of which signals are available.
"""
from app.models.models import WeatherData

WEIGHT_FLOOD_IMAGE = 0.40
WEIGHT_RAINFALL = 0.35
WEIGHT_WEATHER = 0.25


def _rainfall_to_score(rainfall_mm: float) -> float:
    """IMD-style rainfall intensity bands, mapped to 0-100."""
    if rainfall_mm <= 0:
        return 0.0
    if rainfall_mm < 15:      # light rain
        return 20.0
    if rainfall_mm < 65:      # moderate rain
        return 45.0
    if rainfall_mm < 115:     # heavy rain
        return 70.0
    if rainfall_mm < 205:     # very heavy rain
        return 88.0
    return 100.0               # extremely heavy rain


def _weather_to_score(weather: WeatherData) -> float:
    """Combines humidity, wind speed and low pressure (storm indicator) into 0-100."""
    humidity_score = min(weather.humidity, 100.0)  # already 0-100
    wind_score = min(weather.wind_speed / 20.0, 1.0) * 100  # 20 m/s ~ storm force
    # Standard sea-level pressure ~1013 hPa; sharper drops indicate storm systems
    pressure_drop = max(0.0, 1013.0 - weather.pressure)
    pressure_score = min(pressure_drop / 30.0, 1.0) * 100

    return (humidity_score * 0.4) + (wind_score * 0.3) + (pressure_score * 0.3)


def compute_risk_score(
    flood_image_confidence: float | None = None,
    flood_image_label: str | None = None,
    rainfall_forecast_mm: float | None = None,
    weather: WeatherData | None = None,
) -> tuple[float, str, dict]:
    """
    Returns (risk_score 0-100, risk_level, breakdown dict).
    Missing signals are excluded and remaining weights are renormalized so the
    score stays fair when, e.g., no image was uploaded yet.
    """
    components = {}
    weights = {}

    if flood_image_confidence is not None and flood_image_label is not None:
        img_score = flood_image_confidence if flood_image_label == "Flood" else (100 - flood_image_confidence) * 0.3
        components["flood_image"] = round(img_score, 2)
        weights["flood_image"] = WEIGHT_FLOOD_IMAGE

    if rainfall_forecast_mm is not None:
        components["rainfall"] = round(_rainfall_to_score(rainfall_forecast_mm), 2)
        weights["rainfall"] = WEIGHT_RAINFALL

    if weather is not None:
        components["weather"] = round(_weather_to_score(weather), 2)
        weights["weather"] = WEIGHT_WEATHER

    if not components:
        return 0.0, "Low", {"note": "No signals available"}

    total_weight = sum(weights.values())
    risk_score = sum(components[k] * (weights[k] / total_weight) for k in components)
    risk_score = round(min(max(risk_score, 0.0), 100.0), 2)

    if risk_score < 25:
        risk_level = "Low"
    elif risk_score < 50:
        risk_level = "Moderate"
    elif risk_score < 75:
        risk_level = "High"
    else:
        risk_level = "Critical"

    breakdown = {"components": components, "weights_used": weights, "final_score": risk_score}
    return risk_score, risk_level, breakdown
