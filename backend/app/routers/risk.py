"""
/risk/current, /risk/history, /risk/trend endpoints.

These are the PRIMARY early-warning endpoints. They compute risk from
environmental signals WITHOUT requiring an image upload.
"""
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import WeatherData, RiskSnapshot, RiskLevelEnum, RiskTrendEnum
from app.schemas.schemas import RiskCurrentOut, RiskSnapshotOut, RiskTrendOut
from app.services.risk_engine import compute_risk_score
from app.services.early_warning_engine import evaluate_and_alert

router = APIRouter(prefix="/risk", tags=["risk"])


def _risk_level_enum(level_str: str) -> RiskLevelEnum:
    return {
        "Low": RiskLevelEnum.low,
        "Moderate": RiskLevelEnum.moderate,
        "High": RiskLevelEnum.high,
        "Critical": RiskLevelEnum.critical,
    }.get(level_str, RiskLevelEnum.low)


def _trend_enum(trend_str: str) -> RiskTrendEnum:
    return {
        "STABLE": RiskTrendEnum.stable,
        "INCREASING": RiskTrendEnum.increasing,
        "RAPIDLY_INCREASING": RiskTrendEnum.rapidly_increasing,
        "DECREASING": RiskTrendEnum.decreasing,
    }.get(trend_str, RiskTrendEnum.unknown)


@router.get("/current", response_model=RiskCurrentOut)
def get_current_risk(
    lat: Optional[float] = Query(default=None),
    lon: Optional[float] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Computes the current flood risk for the given location (or default).
    Uses live weather + historical risk snapshots as primary signals.
    Image evidence is NOT required.
    Stores a RiskSnapshot and triggers early warning evaluation.
    """
    # 1. Get latest weather (fetch live for location if needed)
    from app.services.weather_service import fetch_current_weather, get_daily_forecast_summary
    weather = None
    try:
        weather = fetch_current_weather(db, lat=lat, lon=lon)
    except Exception:
        weather = db.query(WeatherData).order_by(WeatherData.timestamp.desc()).first()

    # 2. Get recent risk scores for trend/historical signal
    cutoff = datetime.utcnow() - timedelta(days=14)
    recent_snapshots = (
        db.query(RiskSnapshot)
        .filter(RiskSnapshot.created_at >= cutoff)
        .order_by(RiskSnapshot.created_at.asc())
        .limit(14)
        .all()
    )
    recent_scores = [s.risk_score for s in recent_snapshots]

    # 3. Get rainfall forecast (use OWM upcoming forecast or weather rainfall)
    rainfall_forecast_mm = None
    try:
        forecast_daily = get_daily_forecast_summary(lat=lat, lon=lon)
        if forecast_daily and len(forecast_daily) > 0:
            rainfall_forecast_mm = forecast_daily[0].get("total_rainfall_mm", 0.0)
    except Exception:
        pass

    if rainfall_forecast_mm is None and weather and weather.rainfall is not None:
        rainfall_forecast_mm = weather.rainfall

    # 4. Compute risk
    score, level, trend, confidence, factors, recommendation, specific_risks = compute_risk_score(
        rainfall_forecast_mm=rainfall_forecast_mm,
        weather=weather,
        recent_risk_scores=recent_scores if len(recent_scores) >= 2 else None,
    )

    # 5. Store snapshot
    snapshot = RiskSnapshot(
        risk_score=score,
        risk_level=_risk_level_enum(level),
        risk_trend=_trend_enum(trend),
        confidence=confidence,
        latitude=lat or (weather.latitude if weather else None),
        longitude=lon or (weather.longitude if weather else None),
        location_name=weather.location_name if weather else None,
        weather_score=next((f["score"] for f in factors if f["key"] == "weather"), None),
        rainfall_score=next((f["score"] for f in factors if f["key"] == "rainfall_forecast"), None),
        historical_score=next((f["score"] for f in factors if f["key"] == "historical_trend"), None),
        image_score=None,
        explanation_json=json.dumps(factors),
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    # 6. Early warning evaluation
    warning = evaluate_and_alert(
        db=db,
        risk_score=score,
        risk_level=level,
        risk_trend=trend,
        lat=lat or (weather.latitude if weather else None),
        lon=lon or (weather.longitude if weather else None),
        location_name=weather.location_name if weather else None,
    )

    return RiskCurrentOut(
        risk_score=score,
        risk_level=level,
        risk_trend=trend,
        confidence=confidence,
        location_name=weather.location_name if weather else None,
        latitude=lat or (weather.latitude if weather else None),
        longitude=lon or (weather.longitude if weather else None),
        contributing_factors=factors,
        specific_risks=specific_risks,
        recommendation=recommendation,
        warning_generated=warning["warning_issued"],
        snapshot_id=snapshot.id,
    )


@router.get("/history", response_model=list[RiskSnapshotOut])
def get_risk_history(
    days: int = Query(default=14, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Returns risk snapshots for the last N days."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    snapshots = (
        db.query(RiskSnapshot)
        .filter(RiskSnapshot.created_at >= cutoff)
        .order_by(RiskSnapshot.created_at.asc())
        .all()
    )
    return snapshots


@router.get("/trend", response_model=RiskTrendOut)
def get_risk_trend(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Returns trend analysis over the last 7 risk snapshots."""
    snapshots = (
        db.query(RiskSnapshot)
        .order_by(RiskSnapshot.created_at.desc())
        .limit(7)
        .all()
    )
    snapshots = list(reversed(snapshots))  # oldest first

    if not snapshots:
        return RiskTrendOut(
            trend="UNKNOWN",
            current_score=0.0,
            previous_score=None,
            highest_recent=0.0,
            average_recent=0.0,
            snapshots=[],
        )

    scores = [s.risk_score for s in snapshots]
    current = scores[-1]
    previous = scores[-2] if len(scores) >= 2 else None

    from app.services.risk_engine import _compute_trend
    trend = _compute_trend(scores)

    return RiskTrendOut(
        trend=trend,
        current_score=current,
        previous_score=previous,
        highest_recent=max(scores),
        average_recent=round(sum(scores) / len(scores), 2),
        snapshots=snapshots,
    )
