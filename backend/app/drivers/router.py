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
from pydantic import BaseModel
from sqlalchemy import func
from app.core.ids import new_id
from app.models import Delivery, DeliveryStatus, User, UserRole, Vehicle


router = APIRouter(prefix="/api/v1/drivers", tags=["drivers"])

_RATE_LIMIT_SECONDS = 0.5
_RATE_LIMIT_GRACE_SECONDS = 0.0
_clock = time.monotonic
_last_update_at: dict[str, float] = {}  # driver user_id -> last accepted update (monotonic s)


class UpdateDriverStatusRequest(BaseModel):
    status: str  # "AVAILABLE", "BUSY", "OFFLINE"


@router.get("")
async def list_drivers(
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = Query(None),
):
    # Query all driver users and vehicles
    query = (
        select(User, Vehicle)
        .outerjoin(Vehicle, User.id == Vehicle.driver_id)
        .where(User.role == UserRole.DRIVER)
        .order_by(User.created_at.desc())
    )
    result = await db.execute(query)
    driver_rows = result.all()

    # Also check if any standalone vehicle exists without a driver user matched
    vehicle_driver_ids = {u.id for u, _ in driver_rows}
    extra_vehicles_res = await db.execute(
        select(Vehicle).where(Vehicle.driver_id.not_in(vehicle_driver_ids) if vehicle_driver_ids else True)
    )
    extra_vehicles = extra_vehicles_res.scalars().all()

    active_statuses = [
        DeliveryStatus.DRIVER_ASSIGNED,
        DeliveryStatus.PICKUP_STARTED,
        DeliveryStatus.PICKED_UP,
        DeliveryStatus.IN_TRANSIT,
    ]

    data = []
    for user, vehicle in driver_rows:
        if vehicle is None:
            # Auto-create vehicle for this registered driver
            vehicle = Vehicle(
                id=new_id("veh"),
                driver_id=user.id,
                capacity_kg=150.0,
                current_location="28.6273,77.2190",
                availability_status="AVAILABLE",
            )
            db.add(vehicle)
            await db.commit()
            await db.refresh(vehicle)

        if status and vehicle.availability_status != status:
            continue

        # Completed deliveries count
        completed_res = await db.execute(
            select(func.count(Delivery.id)).where(
                Delivery.driver_id == user.id,
                Delivery.status == DeliveryStatus.DELIVERED,
            )
        )
        completed_count = completed_res.scalar() or 0

        # Active delivery check
        active_del_res = await db.execute(
            select(Delivery.id).where(
                Delivery.driver_id == user.id,
                Delivery.status.in_(active_statuses),
            ).order_by(Delivery.id.desc()).limit(1)
        )
        active_del_id = active_del_res.scalar_one_or_none()

        data.append({
            "driver_id": user.id,
            "id": user.id,
            "vehicle_id": vehicle.id,
            "name": user.name or user.email,
            "email": user.email,
            "phone": user.phone,
            "capacity_kg": round(vehicle.capacity_kg, 1),
            "current_location": vehicle.current_location,
            "availability_status": vehicle.availability_status,
            "completed_deliveries_count": int(completed_count),
            "active_delivery_id": active_del_id,
            "created_at": user.created_at.isoformat() if hasattr(user, "created_at") and user.created_at else None,
        })

    for v in extra_vehicles:
        if status and v.availability_status != status:
            continue
        data.append({
            "driver_id": v.driver_id,
            "id": v.driver_id,
            "vehicle_id": v.id,
            "name": f"Driver {v.driver_id[-6:]}",
            "email": None,
            "phone": None,
            "capacity_kg": round(v.capacity_kg, 1),
            "current_location": v.current_location,
            "availability_status": v.availability_status,
            "completed_deliveries_count": 0,
            "active_delivery_id": None,
            "created_at": None,
        })

    return list_envelope(data)


@router.patch("/{driver_id}/status")
async def update_driver_status(
    driver_id: str,
    body: UpdateDriverStatusRequest,
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Admin or Driver toggle availability status."""
    v_res = await db.execute(select(Vehicle).where(Vehicle.driver_id == driver_id))
    vehicle = v_res.scalar_one_or_none()
    if vehicle is None:
        vehicle = Vehicle(
            id=new_id("veh"),
            driver_id=driver_id,
            capacity_kg=150.0,
            current_location="28.6273,77.2190",
            availability_status=body.status,
        )
        db.add(vehicle)
    else:
        vehicle.availability_status = body.status

    await db.commit()
    await db.refresh(vehicle)
    return envelope({
        "driver_id": driver_id,
        "availability_status": vehicle.availability_status,
    })


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
