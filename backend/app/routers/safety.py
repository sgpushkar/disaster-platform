"""
/safety/nearby, /safety/recommendations endpoints.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.config import settings
from app.schemas.schemas import SafeAreasOut, SafeAreaResult, EmergencyLocationOut
from app.services.safe_area_service import get_nearby_safe_areas

router = APIRouter(prefix="/safety", tags=["safety"])


@router.get("/nearby", response_model=SafeAreasOut)
def get_nearby_safe_areas_endpoint(
    lat: float = Query(..., description="User latitude"),
    lon: float = Query(..., description="User longitude"),
    radius_km: float = Query(default=10.0, ge=0.5, le=50.0),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns nearby safe locations ranked by composite safety score.
    Does NOT simply return the closest — evaluates distance, destination risk,
    capacity, and route safety to recommend the safest option.
    """
    results = get_nearby_safe_areas(db, lat, lon, radius_km=radius_km, limit=limit)

    safe_results = [
        SafeAreaResult(
            location=EmergencyLocationOut.model_validate(r["location"]),
            distance_km=r["distance_km"],
            estimated_minutes=r["estimated_minutes"],
            safety_score=r["safety_score"],
            destination_risk=r["destination_risk"],
            reason=r["reason"],
        )
        for r in results
    ]

    return SafeAreasOut(
        user_latitude=lat,
        user_longitude=lon,
        results=safe_results,
        top_recommendation=safe_results[0] if safe_results else None,
    )


@router.get("/recommendations", response_model=SafeAreasOut)
def get_safety_recommendations(
    lat: float = Query(...),
    lon: float = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Returns top 3 safe area recommendations for the given location."""
    results = get_nearby_safe_areas(db, lat, lon, radius_km=15.0, limit=3)

    safe_results = [
        SafeAreaResult(
            location=EmergencyLocationOut.model_validate(r["location"]),
            distance_km=r["distance_km"],
            estimated_minutes=r["estimated_minutes"],
            safety_score=r["safety_score"],
            destination_risk=r["destination_risk"],
            reason=r["reason"],
        )
        for r in results
    ]

    return SafeAreasOut(
        user_latitude=lat,
        user_longitude=lon,
        results=safe_results,
        top_recommendation=safe_results[0] if safe_results else None,
    )
