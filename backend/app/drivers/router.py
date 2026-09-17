"""
Drivers router — Person 1's Day-1 schema-correct stub for /drivers, per §2 and §6.
Person 5's driver app is the day-to-day caller; this is what unblocks Person 5
from waiting on real dispatch logic before building against something real.

GET  /api/v1/drivers?status=AVAILABLE   — driver pool (matches §6 Input for Person 5)
POST /api/v1/drivers/location            — rate-limited 1 req/5 sec; broadcasts to /ws/drivers
"""
import time
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db
from app.core.envelope import api_error, envelope, list_envelope
from app.dispatch.service import publish, record_driver_location, run_dispatch_pending  # Person 5
from app.drivers.schemas import DriverLocationUpdate
from app.models import User, Vehicle

router = APIRouter(prefix="/api/v1/drivers", tags=["drivers"])

_RATE_LIMIT_SECONDS = 5
# Person 5: the client sends every 5 s, so allow ~0.5 s of network jitter
# instead of answering on-time pings with spurious 429s.
_RATE_LIMIT_GRACE_SECONDS = 0.5
_clock = time.monotonic
_last_update_at: dict[str, float] = {}  # driver user_id -> last accepted update (monotonic s)


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
    background_tasks: BackgroundTasks,
    driver_user: Annotated[User, Depends(require_role("DRIVER"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Person 5: location is Person 5's contract output (§6). Movement-derived
    # status changes and the broadcasts live in app.dispatch.service.
    now = _clock()
    last = _last_update_at.get(driver_user.id)
    if last is not None and now - last < _RATE_LIMIT_SECONDS - _RATE_LIMIT_GRACE_SECONDS:
        raise api_error(
            429, "RATE_LIMITED",
            f"Location updates are limited to 1 per {_RATE_LIMIT_SECONDS} seconds.",
        )

    update = await record_driver_location(db, driver_user.id, (body.latitude, body.longitude))
    await db.commit()
    _last_update_at[driver_user.id] = now

    await publish(update.events)  # /ws/drivers always; /ws/deliveries only during a delivery
    if update.should_dispatch_pending:
        background_tasks.add_task(run_dispatch_pending)

    return envelope({"driver_id": driver_user.id, "latitude": body.latitude, "longitude": body.longitude})
