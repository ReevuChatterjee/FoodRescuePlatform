"""
Drivers router — Person 1's Day-1 schema-correct stub for /drivers, per §2 and §6.
Person 5's driver app is the day-to-day caller; this is what unblocks Person 5
from waiting on real dispatch logic before building against something real.

GET  /api/v1/drivers?status=AVAILABLE   — driver pool (matches §6 Input for Person 5)
POST /api/v1/drivers/location            — rate-limited 1 req/5 sec; broadcasts to /ws/drivers
"""
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db
from app.core.envelope import api_error, envelope, list_envelope
from app.drivers.schemas import DriverLocationUpdate
from app.models import User, Vehicle
from app.ws.manager import manager

router = APIRouter(prefix="/api/v1/drivers", tags=["drivers"])

_RATE_LIMIT_SECONDS = 5
_last_update_at: dict[str, datetime] = {}  # driver user_id -> last accepted update time


@router.get("")
async def list_drivers(
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = Query(None),
):
    query = select(Vehicle)
    if status:
        query = query.where(Vehicle.availability_status == status)
    result = await db.execute(query)
    vehicles = result.scalars().all()

    data = [
        {
            "driver_id": v.driver_id,
            "vehicle_id": v.id,
            "capacity_kg": round(v.capacity_kg, 1),
            "current_location": v.current_location,
            "availability_status": v.availability_status,
        }
        for v in vehicles
    ]
    return list_envelope(data)


@router.post("/location")
async def update_location(
    body: DriverLocationUpdate,
    driver_user: Annotated[User, Depends(require_role("DRIVER"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    last = _last_update_at.get(driver_user.id)
    now = datetime.utcnow()
    if last is not None and now - last < timedelta(seconds=_RATE_LIMIT_SECONDS):
        raise api_error(
            429, "RATE_LIMITED",
            f"Location updates are limited to 1 per {_RATE_LIMIT_SECONDS} seconds.",
        )

    result = await db.execute(select(Vehicle).where(Vehicle.driver_id == driver_user.id))
    vehicle = result.scalar_one_or_none()
    if vehicle is None:
        raise api_error(404, "DRIVER_PROFILE_NOT_FOUND", "No vehicle profile for this driver.")

    vehicle.current_location = f"{body.latitude},{body.longitude}"
    await db.commit()
    _last_update_at[driver_user.id] = now

    await manager.broadcast("drivers", {
        "event": "driver.location_update",
        "driver_id": driver_user.id,
        "latitude": body.latitude,
        "longitude": body.longitude,
    })
    # Also mirrored on /ws/deliveries per §2, since Person 2's donor UI subscribes
    # there for "where's my donation" tracking, not /ws/drivers.
    await manager.broadcast("deliveries", {
        "event": "delivery.location_update",
        "driver_id": driver_user.id,
        "latitude": body.latitude,
        "longitude": body.longitude,
    })

    return envelope({"driver_id": driver_user.id, "latitude": body.latitude, "longitude": body.longitude})
