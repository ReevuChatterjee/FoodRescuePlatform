"""Request schemas for Person 5's driver-facing endpoints (proposed contract additions)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class AvailabilityRequest(BaseModel):
    """PATCH /api/v1/drivers/me/availability

    BUSY is never set by clients: dispatch sets it on assignment and delivery
    completion clears it. Send the current position when going online so the
    driver can be considered for dispatch immediately.
    """

    availability_status: Literal["AVAILABLE", "OFFLINE"]
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def _both_or_neither(self) -> AvailabilityRequest:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("send latitude and longitude together")
        return self


class ReportIssueRequest(BaseModel):
    """POST /api/v1/deliveries/{id}/report-issue (Idempotency-Key required)."""

    reason: str = Field(min_length=3, max_length=200)
