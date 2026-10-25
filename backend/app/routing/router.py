from __future__ import annotations
"""Routing API endpoints — Person 5's routing API (§6).

POST /api/v1/routes/calculate   — single-leg route (origin → destination)
POST /api/v1/routes/calculate-multi — multi-waypoint route (driver → pickup → dropoff)

Response `data`:

    {
      "distance_km": 5.4,
      "duration_minutes": 19.6,               # ETA including congestion (contract)
      "geometry": "encoded_polyline",         # precision 5 (contract)
      "traffic_aware": false,                 # true only for live traffic (contract)
      "traffic_source": "time_of_day_model",  # live | time_of_day_model | city_average_model | none
      "free_flow_duration_minutes": 11.2,     # without congestion
      "provider": "heuristic",                # heuristic | osrm | tomtom
      "departure_time": "2026-09-09T12:00:00Z"
    }

Everything after traffic_aware is an additive field (docs/person5-contract-additions.md).
"""
from app.core.time import IST

from datetime import timezone
from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.core.envelope import envelope
from app.models import User
from app.routing.schemas import RouteCalculateRequest, RouteCalculateMultiRequest
from app.routing.service import calculate_route, calculate_route_multi

router = APIRouter(prefix="/api/v1/routes", tags=["routing"])


@router.get("/debug")
async def debug_routing_api():
    """Diagnostic route to inspect why backend is choosing OSRM or TomTom."""
    import os
    from datetime import datetime, timezone
    from app.routing.settings import RoutingSettings
    from app.routing.service import get_provider
    from app.routing.providers import TomTomRouteProvider

    s = RoutingSettings()
    p = get_provider()
    key = s.tomtom_api_key
    masked_key = f"{key[:4]}...{key[-4:]}" if key and len(key) > 8 else ("SET" if key else "NOT_SET")

    detected_env = {
        k: (f"{v[:4]}...{v[-4:]}" if len(v) > 8 else "SET")
        for k, v in os.environ.items()
        if "TOM" in k.upper() or "ROUTING" in k.upper()
    }

    direct_tomtom_result = None
    direct_tomtom_error = None
    if key:
        try:
            tt = TomTomRouteProvider(key, timeout_seconds=8.0)
            est = await tt.route((12.9352, 77.6245), (12.9716, 77.5946), datetime.now(timezone.utc))
            direct_tomtom_result = {
                "distance_km": est.distance_km,
                "duration_minutes": est.duration_minutes,
                "traffic_duration_minutes": est.traffic_duration_minutes,
                "traffic_source": est.traffic_source,
            }
        except Exception as e:
            direct_tomtom_error = str(e)

    return {
        "has_tomtom_key": bool(key),
        "tomtom_key_preview": masked_key,
        "active_provider_name": p.name,
        "active_provider_class": type(p).__name__,
        "configured_provider": s.provider,
        "detected_env_vars": detected_env,
        "direct_tomtom_test": {
            "success": direct_tomtom_result is not None,
            "result": direct_tomtom_result,
            "error": direct_tomtom_error,
        },
    }


@router.post("/calculate")
async def calculate(
    body: RouteCalculateRequest,
    _user: Annotated[User, Depends(get_current_user)],
):
    departure = body.departure_time
    if departure is not None and departure.tzinfo is None:
        departure = departure.replace(tzinfo=timezone.utc)
    estimate = await calculate_route(
        (body.origin.latitude, body.origin.longitude),
        (body.destination.latitude, body.destination.longitude),
        departure,
    )
    return envelope(estimate.to_dict())


@router.post("/calculate-multi")
async def calculate_multi(
    body: RouteCalculateMultiRequest,
    _user: Annotated[User, Depends(get_current_user)],
):
    """Traffic-optimised multi-waypoint route.

    Accepts an ordered list of waypoints (e.g. [driver, pickup, dropoff]).
    Uses the configured provider (TomTom live traffic → OSRM → heuristic fallback).
    A single TomTom request covers all waypoints, so there is no extra API cost
    vs a two-point call.
    """
    departure = body.departure_time
    if departure is not None and departure.tzinfo is None:
        departure = departure.replace(tzinfo=timezone.utc)
    waypoints = [(wp.latitude, wp.longitude) for wp in body.waypoints]
    estimate = await calculate_route_multi(waypoints, departure)
    return envelope(estimate.to_dict())

