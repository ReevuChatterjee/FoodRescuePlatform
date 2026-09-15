"""Pydantic request schemas for /api/v1/drivers/*, per §6."""
from pydantic import BaseModel


class DriverLocationUpdate(BaseModel):
    latitude: float
    longitude: float
