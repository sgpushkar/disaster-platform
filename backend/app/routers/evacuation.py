"""
/evacuation/route endpoint.
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.schemas import EvacuationRouteOut
from app.services.evacuation_service import get_evacuation_route

router = APIRouter(prefix="/evacuation", tags=["evacuation"])


@router.get("/route", response_model=EvacuationRouteOut)
def get_route(
    from_lat: float = Query(..., description="User's current latitude"),
    from_lon: float = Query(..., description="User's current longitude"),
    to_lat: float = Query(..., description="Destination latitude"),
    to_lon: float = Query(..., description="Destination longitude"),
    to_name: str = Query(default="Safe Area", max_length=150),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns an evacuation route from user location to a safe destination.

    Primary provider: OSRM real road routing.
    Fallback: straight-line distance estimate (clearly labeled).

    The 'provider' field in the response indicates which was used:
        'osrm'          — real road routing
        'straight_line' — fallback estimate only
    """
    result = get_evacuation_route(from_lat, from_lon, to_lat, to_lon, to_name)
    return EvacuationRouteOut(**result)
