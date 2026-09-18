"""
Deliveries + handover router.

Person 1 creates the schema and this Day-1 schema-correct implementation so
Persons 3 and 5 can build against real endpoints instead of waiting; Person 5's
driver app is the day-to-day caller of pickup/deliver, Person 3's NGO app calls
handover. Both require Idempotency-Key per Global Conventions §1.

GET  /api/v1/deliveries/{id}              — fetch one
POST /api/v1/deliveries/{id}/pickup       — driver confirms pickup (idempotent)
POST /api/v1/deliveries/{id}/deliver      — driver confirms delivery (idempotent)
POST /api/v1/handover/{delivery_id}       — NGO's half of digital sign-off (idempotent)
"""
from app.core.time import ist_now
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db
from app.core.envelope import api_error, envelope, iso_z
from app.core.idempotency import cache_response, get_cached_response, require_idempotency_key
from app.core.ids import new_id
from app.deliveries.schemas import DeliverRequest, HandoverRequest, PickupRequest
from app.dispatch.service import (  # Person 5: delivery lifecycle service
    confirm_delivery,
    confirm_pickup,
    lock_driver_delivery,
    publish,
    run_dispatch_pending,
)
from app.models import AuditLog, Delivery, DeliveryStatus, Donation, DonationStatus, HandoverRecord, User
from app.ws.manager import manager

deliveries_router = APIRouter(prefix="/api/v1/deliveries", tags=["deliveries"])
handover_router = APIRouter(prefix="/api/v1/handover", tags=["handover"])


async def _get_delivery_or_404(delivery_id: str, db: AsyncSession) -> Delivery:
    result = await db.execute(select(Delivery).where(Delivery.id == delivery_id))
    delivery = result.scalar_one_or_none()
    if delivery is None:
        raise api_error(404, "DELIVERY_NOT_FOUND", f"Delivery {delivery_id} not found.")
    return delivery


def _delivery_to_dict(d: Delivery) -> dict:
    return {
        "id": d.id,
        "donation_id": d.donation_id,
        "ngo_id": d.ngo_id,
        "driver_id": d.driver_id,
        "pickup_time": iso_z(d.pickup_time) if d.pickup_time else None,
        "estimated_delivery_time": iso_z(d.estimated_delivery_time) if d.estimated_delivery_time else None,
        "actual_pickup_time": iso_z(d.actual_pickup_time) if d.actual_pickup_time else None,
        "actual_delivery_time": iso_z(d.actual_delivery_time) if d.actual_delivery_time else None,
        "route_distance_km": d.route_distance_km,
        "estimated_duration_min": d.estimated_duration_min,
        "status": d.status.value,
    }


@deliveries_router.get("/{delivery_id}")
async def get_delivery(
    delivery_id: str,
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    delivery = await _get_delivery_or_404(delivery_id, db)
    return envelope(_delivery_to_dict(delivery))


# Person 5: pickup and deliver are Person 5's contract outputs (§6). The bodies
# below delegate state changes to app.dispatch.service so the status guards,
# vehicle capacity check and driver release live in one place. Flow: idempotent
# replay (cache scoped per delivery and driver) -> lock the delivery row ->
# ownership (403) -> service -> commit -> cache the response -> broadcast.
@deliveries_router.post("/{delivery_id}/pickup")
async def pickup(
    delivery_id: str,
    body: PickupRequest,
    driver_user: Annotated[User, Depends(require_role("DRIVER"))],
    idem_key: Annotated[str, Depends(require_idempotency_key)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Scoped per delivery and driver: a retry replays only this driver's own response.
    scope = f"deliveries.pickup:{delivery_id}:{driver_user.id}"
    cached = await get_cached_response(scope, idem_key)
    if cached is not None:
        return cached
    delivery = await lock_driver_delivery(db, delivery_id, driver_user.id)

    events = await confirm_pickup(db, delivery, driver_user.id, body.confirmed_quantity_kg)
    db.add(AuditLog(
        entity_type="delivery", entity_id=delivery.id, event_type="pickup_confirmed",
        payload={"confirmed_quantity_kg": body.confirmed_quantity_kg, "driver_id": driver_user.id},
        record_hash="", previous_hash=None,
    ))
    await db.commit()
    await db.refresh(delivery)

    response = envelope(_delivery_to_dict(delivery))
    await cache_response(scope, idem_key, response)
    await publish(events)
    return response


@deliveries_router.post("/{delivery_id}/deliver")
async def deliver(
    delivery_id: str,
    body: DeliverRequest,
    background_tasks: BackgroundTasks,
    driver_user: Annotated[User, Depends(require_role("DRIVER"))],
    idem_key: Annotated[str, Depends(require_idempotency_key)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Scoped per delivery and driver: a retry replays only this driver's own response.
    scope = f"deliveries.deliver:{delivery_id}:{driver_user.id}"
    cached = await get_cached_response(scope, idem_key)
    if cached is not None:
        return cached
    delivery = await lock_driver_delivery(db, delivery_id, driver_user.id)

    # Sets DELIVERED or PARTIALLY_DELIVERED (same rule as /handover) and frees the vehicle.
    events = await confirm_delivery(db, delivery, body.quantity_handed_over)
    now = ist_now()
    db.add(AuditLog(
        entity_type="delivery", entity_id=delivery.id, event_type="delivery_confirmed",
        payload={**body.model_dump(), "driver_id": driver_user.id, "status": delivery.status.value},
        record_hash="", previous_hash=None,
    ))
    db.add(HandoverRecord(
        id=new_id("hdv"),
        donation_id=delivery.donation_id,
        delivery_id=delivery.id,
        donor_confirmation=True,  # driver confirms handover on the donor's behalf at pickup
        ngo_confirmation=body.recipient_confirmation,
        pickup_timestamp=delivery.actual_pickup_time or now,
        delivery_timestamp=now,
        quantity_handed_over=body.quantity_handed_over,
        disclaimer_version="v1",
        notes=f"condition={body.condition}",
        created_at=now,
    ))
    await db.commit()
    await db.refresh(delivery)

    response = envelope(_delivery_to_dict(delivery))
    await cache_response(scope, idem_key, response)
    await publish(events)
    background_tasks.add_task(run_dispatch_pending)  # the freed driver can take a waiting donation
    return response


@handover_router.post("/{delivery_id}")
async def handover(
    delivery_id: str,
    body: HandoverRequest,
    ngo_user: Annotated[User, Depends(require_role("NGO"))],
    idem_key: Annotated[str, Depends(require_idempotency_key)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """NGO's half of the digital sign-off. Updates the HandoverRecord created
    at /deliver with the NGO's confirmation, final quantity, and condition."""
    cached = await get_cached_response("handover", idem_key)
    if cached is not None:
        return cached

    delivery = await _get_delivery_or_404(delivery_id, db)

    result = await db.execute(
        select(HandoverRecord).where(HandoverRecord.delivery_id == delivery_id).order_by(HandoverRecord.id.desc())
    )
    record = result.scalars().first()
    if record is None:
        raise api_error(
            409, "DELIVER_NOT_CONFIRMED",
            "Driver must confirm POST /deliveries/{id}/deliver before NGO handover sign-off.",
        )

    record.ngo_confirmation = body.ngo_confirmation
    record.quantity_handed_over = body.quantity_handed_over
    record.notes = f"condition={body.condition}" + (f"; {body.notes}" if body.notes else "")

    donation_result = await db.execute(select(Donation).where(Donation.id == delivery.donation_id))
    donation = donation_result.scalar_one_or_none()
    if donation is not None and body.ngo_confirmation:
        donation.status = (
            DonationStatus.DELIVERED
            if body.quantity_handed_over >= donation.quantity_kg
            else DonationStatus.PARTIALLY_DELIVERED
        )
        donation.updated_at = ist_now()
        delivery.status = (
            DeliveryStatus.DELIVERED
            if donation.status == DonationStatus.DELIVERED
            else DeliveryStatus.PARTIALLY_DELIVERED
        )

    db.add(AuditLog(
        entity_type="handover", entity_id=record.id, event_type="ngo_handover_confirmed",
        payload={"ngo_id": ngo_user.id, **body.model_dump()},
        record_hash="", previous_hash=None,
    ))
    await db.commit()

    response = envelope({
        "delivery_id": delivery_id,
        "ngo_confirmation": record.ngo_confirmation,
        "quantity_handed_over": round(record.quantity_handed_over, 1),
        "notes": record.notes,
    })
    await cache_response("handover", idem_key, response)

    await manager.broadcast("deliveries", {
        "event": "delivery.handover_confirmed", "delivery_id": delivery_id,
    })

    return response
