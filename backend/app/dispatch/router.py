"""Person 5 driver-facing endpoints (proposed additions to the contract, §6).

PATCH /api/v1/drivers/me/availability       go online (AVAILABLE) / offline
GET   /api/v1/drivers/me/current-job        everything the driver screen needs
POST  /api/v1/deliveries/{id}/start         driver heads to pickup (Idempotency-Key)
POST  /api/v1/deliveries/{id}/report-issue  driver can't complete; reassign, same NGO
POST  /api/v1/dispatch/{donation_id}        ADMIN: run dispatch now (retry / demo)

The contract's own Person 5 outputs (POST /routes/calculate, POST
/drivers/location, POST /deliveries/{id}/pickup and /deliver) live in
app/routing/router.py, app/drivers/router.py and app/deliveries/router.py.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin, require_role
from app.core.database import get_db
from app.core.envelope import envelope
from app.core.idempotency import cache_response, get_cached_response, require_idempotency_key
from app.dispatch.schemas import AvailabilityRequest, ReportIssueRequest
from app.dispatch.service import (
    AVAILABLE,
    build_current_job,
    delivery_view,
    dispatch_donation,
    driver_profile_view,
    lock_driver_delivery,
    publish,
    report_driver_issue,
    run_dispatch,
    run_dispatch_pending,
    set_availability,
    start_pickup,
)
from app.models import User

drivers_me_router = APIRouter(prefix="/api/v1/drivers/me", tags=["drivers"])
dispatch_router = APIRouter(prefix="/api/v1/dispatch", tags=["dispatch"])
delivery_actions_router = APIRouter(prefix="/api/v1/deliveries", tags=["deliveries"])


@drivers_me_router.patch("/availability")
async def update_availability(
    body: AvailabilityRequest,
    background_tasks: BackgroundTasks,
    driver_user: Annotated[User, Depends(require_role("DRIVER"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    location = (body.latitude, body.longitude) if body.latitude is not None else None
    vehicle, events = await set_availability(db, driver_user.id, body.availability_status, location)
    await db.commit()
    await publish(events)
    if vehicle.availability_status == AVAILABLE:
        # A driver just freed up: assign any accepted donation that was waiting.
        background_tasks.add_task(run_dispatch_pending)
    return envelope(driver_profile_view(vehicle))


@drivers_me_router.get("/current-job")
async def current_job(
    driver_user: Annotated[User, Depends(require_role("DRIVER"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return envelope(await build_current_job(db, driver_user.id))


@delivery_actions_router.post("/{delivery_id}/start")
async def start_trip(
    delivery_id: str,
    driver_user: Annotated[User, Depends(require_role("DRIVER"))],
    idem_key: Annotated[str, Depends(require_idempotency_key)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """DRIVER_ASSIGNED -> PICKUP_STARTED. Explicit, not inferred from location,
    because available drivers stream location too."""
    # Scoped per delivery and driver: a retry replays only this driver's own response.
    scope = f"deliveries.start:{delivery_id}:{driver_user.id}"
    cached = await get_cached_response(scope, idem_key)
    if cached is not None:
        return cached
    delivery = await lock_driver_delivery(db, delivery_id, driver_user.id)

    events = await start_pickup(db, delivery, driver_user.id)
    await db.commit()

    response = envelope(delivery_view(delivery))
    await cache_response(scope, idem_key, response)
    await publish(events)
    return response


@delivery_actions_router.post("/{delivery_id}/report-issue")
async def report_issue(
    delivery_id: str,
    body: ReportIssueRequest,
    background_tasks: BackgroundTasks,
    driver_user: Annotated[User, Depends(require_role("DRIVER"))],
    idem_key: Annotated[str, Depends(require_idempotency_key)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Scoped per delivery and driver: a retry replays only this driver's own response.
    scope = f"deliveries.report_issue:{delivery_id}:{driver_user.id}"
    cached = await get_cached_response(scope, idem_key)
    if cached is not None:
        return cached
    delivery = await lock_driver_delivery(db, delivery_id, driver_user.id)

    events = await report_driver_issue(db, delivery, driver_user.id, body.reason)
    await db.commit()

    response = envelope(delivery_view(delivery))
    await cache_response(scope, idem_key, response)
    await publish(events)
    background_tasks.add_task(run_dispatch, delivery.donation_id)  # same NGO, next best driver
    return response


@dispatch_router.post("/{donation_id}")
async def trigger_dispatch(
    donation_id: str,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    outcome = await dispatch_donation(db, donation_id)
    return envelope(outcome.to_dict())
