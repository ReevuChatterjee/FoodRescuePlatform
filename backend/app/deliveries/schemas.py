"""Pydantic request schemas for /api/v1/deliveries/* and /api/v1/handover/*, per §5-§6."""
from pydantic import BaseModel


class PickupRequest(BaseModel):
    confirmed_quantity_kg: float


class DeliverRequest(BaseModel):
    quantity_handed_over: float
    condition: str
    recipient_confirmation: bool


class HandoverRequest(BaseModel):
    """NGO's half of the digital sign-off, per §5 POST /handover/{delivery_id}."""
    ngo_confirmation: bool
    quantity_handed_over: float
    condition: str
    notes: str | None = None
