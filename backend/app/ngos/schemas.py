"""Pydantic request schemas for /api/v1/ngos/*, per §4."""
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class CreateNGOProfileRequest(BaseModel):
    organisation_name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1)
    location: str = Field(min_length=1, max_length=200)
    storage_capacity_kg: float = Field(ge=0)
    available_capacity_kg: float = Field(ge=0)
    operating_start: str = Field(min_length=1, max_length=10)
    operating_end: str = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def capacity_is_valid(self):
        if self.available_capacity_kg > self.storage_capacity_kg:
            raise ValueError("available_capacity_kg cannot exceed storage_capacity_kg")
        return self


class UpdateNGOProfileRequest(BaseModel):
    organisation_name: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    location: str | None = None
    storage_capacity_kg: float | None = Field(default=None, ge=0)
    available_capacity_kg: float | None = Field(default=None, ge=0)
    operating_start: str | None = None
    operating_end: str | None = None
    accepted_categories: list[str] | None = None


class ReplaceCategoriesRequest(BaseModel):
    categories: list[str] = Field(default_factory=list)


class UpdateDemandRequest(BaseModel):
    food_category: str
    required_quantity_kg: float = Field(gt=0)
    priority: str = Field(pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    valid_until: datetime


class UpdateCapacityRequest(BaseModel):
    available_capacity_kg: float = Field(ge=0)
