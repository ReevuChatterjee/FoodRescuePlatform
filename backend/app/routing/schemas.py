"""Request schema for POST /api/v1/routes/calculate.

The contract (§6) fixes the response fields but not the request body; this is
the proposed request shape to add to the contract document.
"""
from __future__ import annotations

from datetime import datetime
from typing import List

from pydantic import BaseModel, Field, field_validator


class Coordinates(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class RouteCalculateRequest(BaseModel):
    origin: Coordinates
    destination: Coordinates
    departure_time: datetime | None = Field(
        default=None, description="UTC ISO-8601; defaults to now. Drives the congestion estimate."
    )


class RouteCalculateMultiRequest(BaseModel):
    """Multi-waypoint route request (driver → pickup → dropoff).

    waypoints: ordered list of coordinates, minimum 2 (origin + destination),
    maximum 10. The route follows them in order.
    """
    waypoints: List[Coordinates] = Field(
        ..., min_length=2, max_length=10,
        description="Ordered list of waypoints [origin, ...intermediates, destination]."
    )
    departure_time: datetime | None = Field(
        default=None, description="UTC ISO-8601; defaults to now. Drives the congestion estimate."
    )

    @field_validator("waypoints")
    @classmethod
    def at_least_two(cls, v: List[Coordinates]) -> List[Coordinates]:
        if len(v) < 2:
            raise ValueError("waypoints must contain at least 2 coordinates")
        return v

