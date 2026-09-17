"""Request schema for POST /api/v1/routes/calculate.

The contract (§6) fixes the response fields but not the request body; this is
the proposed request shape to add to the contract document.
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class Coordinates(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class RouteCalculateRequest(BaseModel):
    origin: Coordinates
    destination: Coordinates
    departure_time: datetime | None = Field(
        default=None, description="UTC ISO-8601; defaults to now. Drives the congestion estimate."
    )
