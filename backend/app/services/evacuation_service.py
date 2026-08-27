"""
Evacuation Routing Service — provides route from user location to a safe destination.

Primary provider: OSRM public routing API (free, no key required)
    https://router.project-osrm.org/route/v1/driving/{lon},{lat};{dlon},{dlat}

Fallback: straight-line (Haversine) distance with estimated travel time.

The system is designed so the routing provider can be swapped later by
implementing a new provider function and updating _get_route().

NOTE: We do NOT present the fallback as real navigation. The response
includes `provider` = 'straight_line' so the UI can communicate uncertainty.
"""
from __future__ import annotations

import math
from typing import Optional

import httpx

from app.core.config import settings


class RoutingError(Exception):
    pass


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _straight_line_route(
    from_lat: float, from_lon: float,
    to_lat: float, to_lon: float,
    to_name: str,
) -> dict:
    """Fallback route using straight-line distance."""
    dist_km = _haversine_km(from_lat, from_lon, to_lat, to_lon)
    # Walking if < 2 km, driving otherwise
    speed = 4.5 if dist_km < 2.0 else 30.0
    minutes = max(1, round(dist_km / speed * 60))

    return {
        "from_lat": from_lat,
        "from_lon": from_lon,
        "to_lat": to_lat,
        "to_lon": to_lon,
        "to_name": to_name,
        "distance_km": round(dist_km, 2),
        "estimated_minutes": minutes,
        "provider": "straight_line",
        "route_coordinates": [[from_lat, from_lon], [to_lat, to_lon]],
        "risk_notes": (
            "Route estimated via straight-line distance. "
            "Actual road route may differ. Use navigation app for turn-by-turn directions."
        ),
    }


def _osrm_route(
    from_lat: float, from_lon: float,
    to_lat: float, to_lon: float,
    to_name: str,
) -> dict:
    """Fetches a real driving route from OSRM public API."""
    url = (
        f"{settings.OSRM_BASE_URL}/route/v1/driving/"
        f"{from_lon},{from_lat};{to_lon},{to_lat}"
        "?overview=full&geometries=geojson&steps=false"
    )
    with httpx.Client(timeout=8.0) as client:
        resp = client.get(url)

    if resp.status_code != 200:
        raise RoutingError(f"OSRM returned {resp.status_code}")

    data = resp.json()
    if data.get("code") != "Ok" or not data.get("routes"):
        raise RoutingError("No route found by OSRM")

    route = data["routes"][0]
    dist_m = route["distance"]
    dur_s = route["duration"]
    coords_lonlat = route["geometry"]["coordinates"]

    # OSRM returns [lon, lat] — flip to [lat, lon] for Leaflet
    route_coords = [[c[1], c[0]] for c in coords_lonlat]

    return {
        "from_lat": from_lat,
        "from_lon": from_lon,
        "to_lat": to_lat,
        "to_lon": to_lon,
        "to_name": to_name,
        "distance_km": round(dist_m / 1000.0, 2),
        "estimated_minutes": max(1, round(dur_s / 60)),
        "provider": "osrm",
        "route_coordinates": route_coords,
        "risk_notes": (
            "Follow road route to destination. "
            "Avoid flooded or blocked roads. "
            "Check local alerts before departing."
        ),
    }


def get_evacuation_route(
    from_lat: float,
    from_lon: float,
    to_lat: float,
    to_lon: float,
    to_name: str = "Safe Area",
) -> dict:
    """
    Returns the best available evacuation route.
    Tries OSRM first, falls back to straight-line.
    """
    try:
        return _osrm_route(from_lat, from_lon, to_lat, to_lon, to_name)
    except Exception:
        return _straight_line_route(from_lat, from_lon, to_lat, to_lon, to_name)
