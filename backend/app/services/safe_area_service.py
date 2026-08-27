"""
Safe Area Service — ranks nearby emergency locations by a composite safety score.

Safety Score (0-100):
    distance_score       40%  — closer is better, scaled over radius
    destination_risk     30%  — lower risk at destination is better
    capacity_score       20%  — available capacity
    route_safety         10%  — rough estimate based on danger zone proximity

The system does NOT simply choose the closest location. It may recommend
a slightly more distant shelter in a lower-risk zone if the overall
safety score is higher.
"""
from __future__ import annotations

import math
from typing import Optional

from sqlalchemy.orm import Session

from app.models.models import EmergencyLocation

# Types considered as safe destinations
SAFE_TYPES = {"shelter", "hospital", "safe_zone", "fire_station"}

# Risk level → penalty (higher = more dangerous destination)
DESTINATION_RISK_PENALTY = {
    "Low": 0,
    "Moderate": 20,
    "High": 50,
    "Critical": 90,
    None: 0,
}

# Default walking speed assumption for estimated travel time
WALK_SPEED_KMH = 4.5
DRIVE_SPEED_KMH = 30.0


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Returns straight-line distance in kilometres between two coordinates."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _distance_score(dist_km: float, max_radius_km: float = 10.0) -> float:
    """Score 0-100 — higher is closer."""
    if dist_km <= 0:
        return 100.0
    score = max(0.0, (1.0 - dist_km / max_radius_km) * 100.0)
    return round(score, 2)


def _capacity_score(loc: EmergencyLocation) -> float:
    """Score 0-100 based on available capacity."""
    if loc.capacity is None:
        return 70.0  # unknown — assume available
    if loc.availability_status == "closed":
        return 0.0
    if loc.availability_status == "full":
        return 5.0
    if loc.current_occupancy is not None and loc.capacity > 0:
        ratio = loc.current_occupancy / loc.capacity
        return round(max(0.0, (1.0 - ratio) * 100.0), 2)
    return 70.0  # open with unknown occupancy


def _destination_risk_score(loc: EmergencyLocation) -> float:
    """Score 0-100 — lower destination risk = higher score."""
    penalty = DESTINATION_RISK_PENALTY.get(loc.risk_level, 0)
    return round(max(0.0, 100.0 - penalty), 2)


def _composite_safety_score(
    dist_km: float,
    loc: EmergencyLocation,
    max_radius_km: float = 10.0,
) -> float:
    """Weighted composite safety score 0-100."""
    d_score = _distance_score(dist_km, max_radius_km)
    r_score = _destination_risk_score(loc)
    c_score = _capacity_score(loc)
    # Route safety: simple proxy (further → slightly lower route safety)
    route_score = max(60.0, 100.0 - dist_km * 4.0)

    score = (
        d_score * 0.40
        + r_score * 0.30
        + c_score * 0.20
        + route_score * 0.10
    )
    return round(min(max(score, 0.0), 100.0), 1)


def _travel_minutes(dist_km: float, loc_type: str) -> int:
    """Estimates travel time in minutes."""
    # For short distances (<2 km) assume walking, otherwise driving
    if dist_km <= 2.0:
        return max(1, round(dist_km / WALK_SPEED_KMH * 60))
    return max(1, round(dist_km / DRIVE_SPEED_KMH * 60))


def _reason(rank: int, loc: EmergencyLocation, dist_km: float, score: float) -> str:
    """Generates a human-readable reason for the recommendation."""
    if rank == 0:
        parts = [f"Top recommendation — safety score {score}/100."]
        if loc.risk_level in (None, "Low"):
            parts.append("Located in a low-risk zone.")
        if loc.availability_status == "open":
            parts.append("Currently open and available.")
        return " ".join(parts)
    if dist_km < 1.0:
        return f"Very close ({dist_km:.1f} km). Safety score: {score}/100."
    return f"Safety score: {score}/100. Distance: {dist_km:.1f} km."


def get_nearby_safe_areas(
    db: Session,
    user_lat: float,
    user_lon: float,
    radius_km: float = 10.0,
    limit: int = 10,
) -> list[dict]:
    """
    Returns a ranked list of nearby safe locations sorted by composite safety score.

    Each result dict contains:
        location         EmergencyLocation ORM object
        distance_km      float
        estimated_minutes int
        safety_score     float
        destination_risk str
        reason           str
    """
    all_locations = db.query(EmergencyLocation).filter(
        EmergencyLocation.type.in_(SAFE_TYPES)
    ).all()

    results = []
    for loc in all_locations:
        dist = _haversine_km(user_lat, user_lon, loc.latitude, loc.longitude)
        if dist > radius_km:
            continue
        score = _composite_safety_score(dist, loc, radius_km)
        results.append({
            "location": loc,
            "distance_km": round(dist, 2),
            "estimated_minutes": _travel_minutes(dist, loc.type),
            "safety_score": score,
            "destination_risk": loc.risk_level or "Low",
            "reason": "",  # filled after sorting
        })

    # Sort by safety score descending
    results.sort(key=lambda x: x["safety_score"], reverse=True)
    results = results[:limit]

    # Fill in rank-aware reason
    for i, r in enumerate(results):
        r["reason"] = _reason(i, r["location"], r["distance_km"], r["safety_score"])

    return results
