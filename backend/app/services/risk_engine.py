"""
Risk Engine v2 — fuses weather, rainfall forecast, historical trend,
and optional image evidence into a single 0–100 risk score.

RISK_WEIGHTS (configurable via settings):
    weather:           25%  — live OWM conditions
    rainfall_forecast: 40%  — LSTM/OWM predicted rainfall
    historical_trend:  20%  — recent risk trajectory
    image_evidence:    15%  — optional CNN image classification

When image evidence is unavailable, its weight is redistributed
proportionally across the remaining signals so the score stays fair.

Outputs:
    risk_score      0-100
    risk_level      Low | Moderate | High | Critical
    risk_trend      STABLE | INCREASING | RAPIDLY_INCREASING | DECREASING | UNKNOWN
    confidence      0-100 (based on how many signals are available)
    explanation     list of contributing factors with delta scores
"""
from __future__ import annotations

from typing import Optional

from app.core.config import settings
from app.models.models import WeatherData

# -------------------------------------------------------
# IMD-style rainfall intensity → 0-100 score
# -------------------------------------------------------
RAINFALL_BANDS = [
    (0.0,   0.0),   # no rain
    (15.0,  20.0),  # light rain
    (65.0,  45.0),  # moderate rain
    (115.0, 70.0),  # heavy rain
    (205.0, 88.0),  # very heavy rain
]


def _rainfall_to_score(rainfall_mm: float) -> float:
    """IMD rainfall intensity bands mapped to 0-100."""
    if rainfall_mm <= 0:
        return 0.0
    for threshold, score in reversed(RAINFALL_BANDS):
        if rainfall_mm >= threshold:
            # Interpolate within band for smoother output
            next_idx = RAINFALL_BANDS.index((threshold, score)) + 1
            if next_idx < len(RAINFALL_BANDS):
                next_threshold, next_score = RAINFALL_BANDS[next_idx]
                ratio = (rainfall_mm - threshold) / (next_threshold - threshold)
                return round(score + ratio * (next_score - score), 2)
            return 100.0
    return 20.0


def _weather_to_score(weather: WeatherData) -> float:
    """
    Combines humidity, wind speed, and pressure drop (storm indicator) into 0-100.
    Weights: humidity 40%, wind 30%, pressure 30%.
    """
    humidity_score = min(weather.humidity, 100.0)
    wind_score = min(weather.wind_speed / 20.0, 1.0) * 100.0   # 20 m/s ≈ storm force
    # Sea-level pressure ~1013 hPa; sharp drops indicate storm systems
    pressure_drop = max(0.0, 1013.0 - weather.pressure)
    pressure_score = min(pressure_drop / 30.0, 1.0) * 100.0

    return round(
        (humidity_score * 0.40) + (wind_score * 0.30) + (pressure_score * 0.30),
        2,
    )


def _historical_trend_to_score(recent_scores: list[float]) -> float:
    """
    Converts a list of recent risk scores into a 0-100 trend signal.
    Weights recent values more heavily and penalizes rapidly increasing patterns.
    """
    if not recent_scores:
        return 0.0

    # Weighted average — more recent = more weight
    n = len(recent_scores)
    weights = [i + 1 for i in range(n)]
    weighted_avg = sum(s * w for s, w in zip(recent_scores, weights)) / sum(weights)

    # Bonus if there's a sharp upward trend
    if n >= 2:
        delta = recent_scores[-1] - recent_scores[0]
        trend_bonus = min(max(delta * 0.3, 0.0), 20.0)
        weighted_avg = min(weighted_avg + trend_bonus, 100.0)

    return round(weighted_avg, 2)


def _compute_trend(recent_scores: list[float]) -> str:
    """
    Classifies the risk trajectory from a sequence of scores.
    Returns one of: STABLE | INCREASING | RAPIDLY_INCREASING | DECREASING | UNKNOWN
    """
    if len(recent_scores) < 2:
        return "UNKNOWN"

    delta = recent_scores[-1] - recent_scores[0]
    last_delta = recent_scores[-1] - recent_scores[-2] if len(recent_scores) >= 2 else 0

    if delta > 20 or last_delta > 15:
        return "RAPIDLY_INCREASING"
    if delta > 8:
        return "INCREASING"
    if delta < -8:
        return "DECREASING"
    return "STABLE"


def _risk_level_from_score(score: float) -> str:
    if score < 25:
        return "Low"
    if score < 50:
        return "Moderate"
    if score < 75:
        return "High"
    return "Critical"


def _build_explanation(
    components: dict,
    total_weight: float,
    weights: dict,
) -> list[dict]:
    """
    Returns a list of contributing-factor dicts for UI display.
    Each entry: { label, score, delta, description }
    """
    factors = []
    labels = {
        "weather": "Live weather conditions",
        "rainfall_forecast": "Rainfall forecast (next 24-48h)",
        "historical_trend": "Historical risk trend",
        "image_evidence": "Visual flood assessment",
    }
    descriptions = {
        "weather": "Humidity, wind speed, and atmospheric pressure",
        "rainfall_forecast": "Predicted precipitation from LSTM/OWM forecast",
        "historical_trend": "Trajectory of risk scores over recent history",
        "image_evidence": "AI image classification of flood indicators",
    }
    for key, score in components.items():
        normalized_weight = weights[key] / total_weight
        delta = round(score * normalized_weight, 1)
        factors.append({
            "key": key,
            "label": labels.get(key, key),
            "score": score,
            "delta": f"+{delta}" if delta >= 0 else str(delta),
            "weight_pct": round(normalized_weight * 100, 1),
            "description": descriptions.get(key, ""),
        })

    # Sort highest delta first for UI display
    factors.sort(key=lambda x: float(x["delta"].replace("+", "")), reverse=True)
    return factors


def _recommendation(risk_level: str, risk_trend: str) -> str:
    """Returns a plain-language recommendation based on risk level and trend."""
    if risk_level == "Critical":
        return (
            "CRITICAL RISK — Immediate evacuation is strongly advised. "
            "Move to the nearest designated shelter or safe area now."
        )
    if risk_level == "High":
        if risk_trend in ("RAPIDLY_INCREASING", "INCREASING"):
            return (
                "HIGH RISK (Increasing) — Prepare to evacuate. "
                "Identify the nearest safe area and be ready to move. "
                "Monitor alerts closely."
            )
        return (
            "HIGH RISK — Avoid low-lying areas and flood-prone zones. "
            "Prepare emergency supplies and stay alert for further warnings."
        )
    if risk_level == "Moderate":
        return (
            "MODERATE RISK — Monitor conditions. "
            "Be aware of local drainage capacity and stay tuned for updates."
        )
    return "LOW RISK — Conditions are within normal range. Continue monitoring."


def compute_risk_score(
    flood_image_confidence: Optional[float] = None,
    flood_image_label: Optional[str] = None,
    rainfall_forecast_mm: Optional[float] = None,
    weather: Optional[WeatherData] = None,
    recent_risk_scores: Optional[list[float]] = None,
) -> tuple[float, str, str, float, list[dict], str, dict]:
    """
    Computes the multi-factor flood risk score.

    Returns:
        risk_score        float 0-100
        risk_level        str "Low" | "Moderate" | "High" | "Critical"
        risk_trend        str "STABLE" | "INCREASING" | "RAPIDLY_INCREASING" | "DECREASING" | "UNKNOWN"
        confidence        float 0-100 (based on signal availability)
        contributing_factors  list[dict] for explainability
        recommendation    str plain-language advice
        specific_risks    dict specific disaster risks
    """
    base_weights = settings.risk_weights.copy()
    components: dict[str, float] = {}
    weights: dict[str, float] = {}

    # --- Weather signal (25%) ---
    if weather is not None:
        components["weather"] = _weather_to_score(weather)
        weights["weather"] = base_weights["weather"]

    # --- Rainfall forecast signal (40%) ---
    if rainfall_forecast_mm is not None:
        components["rainfall_forecast"] = _rainfall_to_score(rainfall_forecast_mm)
        weights["rainfall_forecast"] = base_weights["rainfall_forecast"]

    # --- Historical trend signal (20%) ---
    if recent_risk_scores and len(recent_risk_scores) >= 2:
        components["historical_trend"] = _historical_trend_to_score(recent_risk_scores)
        weights["historical_trend"] = base_weights["historical_trend"]

    # --- Image evidence signal (15% — optional) ---
    if flood_image_confidence is not None and flood_image_label is not None:
        if flood_image_label == "Flood":
            img_score = flood_image_confidence
        else:
            # No flood detected — reduce risk by modest amount
            img_score = max(0.0, (100.0 - flood_image_confidence) * 0.25)
        components["image_evidence"] = round(img_score, 2)
        weights["image_evidence"] = base_weights["image_evidence"]

    # --- No signals at all ---
    if not components:
        return 0.0, "Low", "UNKNOWN", 0.0, [], "Insufficient data to assess risk.", {}

    # --- Normalize weights to sum to 1.0 ---
    total_weight = sum(weights.values())
    risk_score = sum(components[k] * (weights[k] / total_weight) for k in components)
    risk_score = round(min(max(risk_score, 0.0), 100.0), 2)

    risk_level = _risk_level_from_score(risk_score)

    # --- Trend ---
    all_scores = list(recent_risk_scores or []) + [risk_score]
    risk_trend = _compute_trend(all_scores)

    # --- Confidence (based on how many signals we have) ---
    all_signals = 4  # weather, rainfall_forecast, historical_trend, image_evidence
    active_signals = len(components)
    confidence = round((active_signals / all_signals) * 100.0, 1)

    # --- Explainability ---
    factors = _build_explanation(components, total_weight, weights)
    recommendation = _recommendation(risk_level, risk_trend)
    
    # --- Specific Risks ---
    # Heuristics based on components
    weather_s = components.get("weather", 0.0)
    rain_s = components.get("rainfall_forecast", 0.0)
    
    specific_risks = {
        "Floods": risk_score,
        "Landslides": round((rain_s * 0.7) + (risk_score * 0.3), 2),
        "Cyclones": round((weather_s * 0.8) + (rain_s * 0.2), 2),
        "Intense Rainfall": round(rain_s, 2),
        "Earthquake": round(min(15.0 + (confidence * 0.05), 100.0), 2), # Unrelated to weather, keeping it low/baseline
        "Wildfire": round(max(0.0, 100.0 - weather_s - rain_s) * 0.6, 2) # Dry weather increases wildfire risk
    }

    return risk_score, risk_level, risk_trend, confidence, factors, recommendation, specific_risks
