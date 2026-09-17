"""POST /api/v1/routes/calculate — Person 5's routing API (§6).

Consumed by Person 4 (route inputs), Person 2's donor map and Person 5's driver
app. Response `data`:

    {
      "distance_km": 5.4,
      "duration_minutes": 11.2,          # without traffic
      "traffic_duration_minutes": 19.6,  # expected with traffic; use this as the ETA
      "geometry": "encoded_polyline",    # precision 5
      "provider": "heuristic",           # heuristic | osrm | tomtom
      "departure_time": "2026-09-09T12:00:00Z"
    }
"""
from __future__ import annotations

from datetime import timezone
from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.core.envelope import envelope
from app.models import User
from app.routing.schemas import RouteCalculateRequest
from app.routing.service import calculate_route

router = APIRouter(prefix="/api/v1/routes", tags=["routing"])


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
