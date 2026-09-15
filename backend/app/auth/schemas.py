"""Pydantic request schemas for /api/v1/auth/*."""
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str = Field(min_length=8)
    role: Literal["DONOR", "NGO", "DRIVER", "ADMIN"]

    # Donor / NGO shared profile fields
    organisation_name: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    # Donor-only
    contact_person: str | None = None
    daily_waste_category: str | None = None

    # NGO-only
    storage_capacity_kg: float | None = None
    operating_start: str | None = None
    operating_end: str | None = None
    accepted_categories: list[str] | None = None

    # Driver-only
    vehicle_capacity_kg: float | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str
