"""
Request/response schemas for the matching router.

These are the Pydantic bodies for the three matching endpoints.
Field names match the frozen API contract exactly.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class AcceptMatchRequest(BaseModel):
    """Body for POST /api/v1/matching/{donation_id}/accept.

    The NGO POSTs this to claim a donation. The weights_version_id
    must echo back the version returned by GET /candidates so auditing
    can confirm the weights in effect at acceptance time.
    """
    ngo_id: str = Field(..., description="ID of the NGO accepting the donation")
    weights_version_id: str = Field(..., description="Must match the weights_version_id from /candidates")
    match_score: float = Field(..., ge=0.0, le=1.0, description="Score from the ranked candidates list")


class RejectMatchRequest(BaseModel):
    """Body for POST /api/v1/matching/{donation_id}/reject.

    The NGO POSTs this to decline. The rejection is stored in
    donation_rejections and triggers an automatic rematch call.
    """
    ngo_id: str = Field(..., description="ID of the NGO rejecting the donation")
    reason: Optional[str] = Field(None, max_length=200, description="Optional free-text reason for rejection")
