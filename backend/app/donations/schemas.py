"""Pydantic request schemas for /api/v1/donations/*, matching §3's frozen shape."""
from datetime import datetime

from pydantic import BaseModel


class PickupLocation(BaseModel):
    latitude: float
    longitude: float
    address: str


class FoodSafetyInfo(BaseModel):
    storage_temp_required: str | None = None
    allergen_tags: list[str] = []
    packaging_type: str | None = None


class CreateDonationRequest(BaseModel):
    food_name: str
    food_category: str
    quantity_kg: float
    prepared_at: datetime
    available_from: datetime
    expiry_time: datetime
    pickup_location: PickupLocation
    special_handling: str | None = None
    food_safety_info: FoodSafetyInfo | None = None


class UpdateDonationRequest(BaseModel):
    """Partial update — used by the matching engine (Person 4) and admin flows.

    Everything is optional; only fields present in the request body are applied.
    """
    status: str | None = None
    matched_ngo_id: str | None = None
    match_score: float | None = None
    weights_version_id: float | str | None = None


class CancelDonationRequest(BaseModel):
    reason: str
