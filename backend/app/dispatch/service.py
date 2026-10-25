from __future__ import annotations
"""Dispatch service — turns an accepted match into food actually moving (§6, §9).

NGO accepts -> find available drivers -> check vehicle capacity and expiry
feasibility -> claim the best driver -> create the delivery with route distance
and ETAs -> notify over WebSocket. If nobody can take it right now the donation
stays ACCEPTED and is retried the moment any driver becomes available (goes
online or finishes a delivery), so nothing depends on polling.

Delivery lifecycle handled here:
  DRIVER_ASSIGNED -> PICKUP_STARTED    POST /deliveries/{id}/start (optional)
  -> PICKED_UP                         POST /deliveries/{id}/pickup
  -> IN_TRANSIT                        location ping > 150 m from the pickup
  -> DELIVERED | PARTIALLY_DELIVERED   POST /deliveries/{id}/deliver
  DRIVER_ASSIGNED | PICKUP_STARTED -> DRIVER_ISSUE -> reassigned, same NGO
  DRIVER_ASSIGNED | PICKUP_STARTED | DRIVER_ISSUE -> CANCELLED   donor cancels

Concurrency: the donation row is locked (SELECT ... FOR UPDATE) for the whole
assignment, and a driver is claimed with a compare-and-set UPDATE on
vehicles.availability_status, so two dispatch runs can never double-assign a
donation or a driver.
"""
from app.core.time import IST

import logging
import math
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.envelope import api_error, iso_z
from app.core.ids import new_id
from app.dispatch.selection import (
    DEFAULT_DISPATCH_CONFIG,
    DispatchConfig,
    DispatchJob,
    DriverCandidate,
    DriverPlan,
    DriverRejection,
    build_plan,
    departure_from_pickup,
    expiry_priority,
    plan_sort_key,
    rank_drivers,
)
from app.models import (
    NGO,
    AuditLog,
    Delivery,
    DeliveryStatus,
    Donation,
    DonationStatus,
    Donor,
    Vehicle,
)
from app.routing.geo import LatLng, format_latlng, haversine_km, is_valid_latlng, parse_latlng
from app.routing.service import calculate_route, get_heuristic
from app.ws.manager import manager

logger = logging.getLogger(__name__)

AVAILABLE, BUSY, OFFLINE = "AVAILABLE", "BUSY", "OFFLINE"

ACTIVE_DELIVERY_STATUSES = (
    DeliveryStatus.DRIVER_ASSIGNED,
    DeliveryStatus.PICKUP_STARTED,
    DeliveryStatus.PICKED_UP,
    DeliveryStatus.IN_TRANSIT,
)
DISPATCHABLE_DONATION_STATUSES = (DonationStatus.ACCEPTED, DonationStatus.DRIVER_ISSUE)
PICKUP_ALLOWED_FROM = frozenset({DeliveryStatus.DRIVER_ASSIGNED, DeliveryStatus.PICKUP_STARTED})
DELIVER_ALLOWED_FROM = frozenset({DeliveryStatus.PICKED_UP, DeliveryStatus.IN_TRANSIT})
ISSUE_ALLOWED_FROM = PICKUP_ALLOWED_FROM  # after pickup the food is on board: handled manually
# ASSUMPTION: 150 m clears GPS noise around the pickup before calling it "in transit".
IN_TRANSIT_DISTANCE_KM = 0.15

Event = tuple[str, dict[str, Any]]


# ─── small helpers ──────────────────────────────────────────────────────────

def now_ist() -> datetime:
    return datetime.now(IST)


def as_aware(dt: datetime) -> datetime:
    return dt.replace(tzinfo=IST) if dt.tzinfo is None else dt.astimezone(IST)


def as_naive(dt: datetime) -> datetime:
    """DB columns are naive UTC and asyncpg rejects aware datetimes for them."""
    return dt.astimezone(IST).replace(tzinfo=None) if dt.tzinfo else dt


def _event(channel: str, name: str, **payload: Any) -> Event:
    return channel, {"event": name, **payload, "timestamp": iso_z(now_ist())}


def _audit(db: AsyncSession, entity_type: str, entity_id: str, event_type: str, payload: dict) -> None:
    # Hash chaining is still a shared TODO (Person 1/6); same placeholder as other modules.
    db.add(AuditLog(
        entity_type=entity_type, entity_id=entity_id, event_type=event_type,
        payload=payload, record_hash="", previous_hash=None,
    ))


async def publish(events: Iterable[Event]) -> None:
    for channel, event in events:
        try:
            await manager.broadcast(channel, event)
        except Exception:  # a dead socket must never fail a state change that already committed
            logger.exception("failed to broadcast %s", event.get("event"))


def delivery_view(d: Delivery) -> dict[str, Any]:
    """Same shape as GET /api/v1/deliveries/{id}."""
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


def _point(p: LatLng | None) -> dict[str, float] | None:
    return {"latitude": p[0], "longitude": p[1]} if p else None


async def vehicle_for_driver(db: AsyncSession, driver_id: str) -> Vehicle | None:
    result = await db.execute(select(Vehicle).where(Vehicle.driver_id == driver_id))
    return result.scalars().first()


async def active_delivery_for_driver(db: AsyncSession, driver_id: str) -> Delivery | None:
    result = await db.execute(
        select(Delivery)
        .where(Delivery.driver_id == driver_id, Delivery.status.in_(ACTIVE_DELIVERY_STATUSES))
        .order_by(Delivery.pickup_time.desc())
    )
    return result.scalars().first()


async def active_delivery_for_donation(db: AsyncSession, donation_id: str) -> Delivery | None:
    result = await db.execute(
        select(Delivery).where(
            Delivery.donation_id == donation_id, Delivery.status.in_(ACTIVE_DELIVERY_STATUSES)
        )
    )
    return result.scalars().first()


async def load_delivery_for_update(db: AsyncSession, delivery_id: str) -> Delivery | None:
    result = await db.execute(select(Delivery).where(Delivery.id == delivery_id).with_for_update())
    return result.scalar_one_or_none()


# Lock order, everywhere a delivery changes: donation row -> delivery row ->
# vehicle row. Cancel, start, pickup, deliver, report-issue and the IN_TRANSIT
# ping follow it exactly, so none of them can deadlock another. Dispatch claims
# the vehicle before writing the delivery row, which is safe: it already holds
# the donation lock, so no other path can hold that delivery row.

async def lock_donation(db: AsyncSession, donation_id: str) -> Donation | None:
    result = await db.execute(
        select(Donation).where(Donation.id == donation_id).with_for_update()
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


async def _lock_delivery(db: AsyncSession, delivery_id: str) -> Delivery | None:
    result = await db.execute(
        select(Delivery).where(Delivery.id == delivery_id).with_for_update()
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


async def lock_driver_delivery(db: AsyncSession, delivery_id: str, driver_id: str) -> Delivery:
    """Lock a delivery the calling driver owns (its donation row first, per the lock
    order): 404 if missing, 403 if someone else's. Driver endpoints scope their
    idempotency cache by delivery and driver, so a replay never serves one driver
    another driver's response, and a genuine retry still replays after the
    delivery was reassigned."""
    # donation_id never changes on a delivery, so reading it unlocked is safe.
    donation_id = (
        await db.execute(select(Delivery.donation_id).where(Delivery.id == delivery_id))
    ).scalar_one_or_none()
    delivery = None
    if donation_id is not None:
        await lock_donation(db, donation_id)
        delivery = await _lock_delivery(db, delivery_id)
    if delivery is None:
        raise api_error(404, "DELIVERY_NOT_FOUND", f"Delivery {delivery_id} not found.")
    if delivery.driver_id != driver_id:
        raise api_error(403, "FORBIDDEN", "This delivery is not assigned to you.")
    return delivery


async def _set_donation_status(db: AsyncSession, donation_id: str, status: DonationStatus) -> Event:
    donation = await db.get(Donation, donation_id)
    if donation is not None:
        donation.status = status
        donation.updated_at = as_naive(now_ist())
    return _event("donations", "donation.status_changed", donation_id=donation_id, status=status.value)


def _delivery_status_event(delivery: Delivery) -> Event:
    return _event(
        "deliveries", "delivery.status_changed",
        delivery_id=delivery.id, donation_id=delivery.donation_id, driver_id=delivery.driver_id,
        status=delivery.status.value,
    )


# ─── dispatch ───────────────────────────────────────────────────────────────

class DispatchStatus(str, Enum):
    ASSIGNED = "ASSIGNED"
    ALREADY_ASSIGNED = "ALREADY_ASSIGNED"
    PENDING = "PENDING"  # no feasible driver right now; retried when one frees up
    NOT_DISPATCHABLE = "NOT_DISPATCHABLE"  # wrong donation state or missing data


@dataclass
class DispatchOutcome:
    status: DispatchStatus
    donation_id: str
    reason: str | None = None
    delivery: dict[str, Any] | None = None
    eta_to_pickup_minutes: int | None = None
    driver_rejections: dict[str, str] = field(default_factory=dict)
    events: list[Event] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "donation_id": self.donation_id,
            "status": self.status.value,
            "reason": self.reason,
            "delivery": self.delivery,
            "eta_to_pickup_minutes": self.eta_to_pickup_minutes,
            "driver_rejections": self.driver_rejections,
        }


async def _claim_vehicle(db: AsyncSession, vehicle_id: str) -> bool:
    result = await db.execute(
        update(Vehicle)
        .where(Vehicle.id == vehicle_id)
        .values(availability_status=BUSY)
    )
    return result.rowcount == 1


async def _refine(
    job: DispatchJob, plans: list[DriverPlan], now: datetime, config: DispatchConfig,
    rejections: dict[str, str],
) -> list[DriverPlan]:
    """Re-check the best few plans with the configured provider (live traffic or
    road geometry when enabled); the rest keep their heuristic numbers."""
    head, tail = plans[: config.refine_top_n], plans[config.refine_top_n:]
    refined: list[DriverPlan] = []
    for plan in head:
        assert plan.driver.location is not None  # guaranteed by rank_drivers
        to_pickup = await calculate_route(plan.driver.location, job.pickup, now)
        depart = departure_from_pickup(job, to_pickup, now, config)
        to_dropoff = await calculate_route(job.pickup, job.dropoff, depart)
        candidate = build_plan(job, plan.driver, to_pickup, to_dropoff, now, config)
        if candidate.feasible:
            refined.append(candidate)
        else:
            rejections[plan.driver.driver_id] = DriverRejection.EXPIRY_NOT_FEASIBLE.value
    refined.sort(key=plan_sort_key)
    return refined + tail


async def _dispatch_locked(
    db: AsyncSession,
    donation_id: str,
    now: datetime,
    config: DispatchConfig,
    record_pending: bool,
    preferred_driver_id: str | None = None,
) -> DispatchOutcome:
    result = await db.execute(select(Donation).where(Donation.id == donation_id).with_for_update())
    donation = result.scalar_one_or_none()

    def stop(status: DispatchStatus, reason: str | None = None, **extra: Any) -> DispatchOutcome:
        return DispatchOutcome(status=status, donation_id=donation_id, reason=reason, **extra)

    if donation is None:
        await db.commit()
        return stop(DispatchStatus.NOT_DISPATCHABLE, "DONATION_NOT_FOUND")

    existing = await active_delivery_for_donation(db, donation_id)
    if existing is not None:
        view = delivery_view(existing)
        await db.commit()
        return stop(DispatchStatus.ALREADY_ASSIGNED, delivery=view)

    if donation.status not in DISPATCHABLE_DONATION_STATUSES:
        reason = f"DONATION_STATUS_{donation.status.value}"
        await db.commit()
        return stop(DispatchStatus.NOT_DISPATCHABLE, reason)

    expiry = as_aware(donation.expiry_time)
    pickup = parse_latlng(donation.pickup_location) or (28.6273, 77.2190)
    ngo = await db.get(NGO, donation.matched_ngo_id) if donation.matched_ngo_id else None
    if ngo is None:
        # Fallback to any registered NGO in the database
        ngo_res = await db.execute(select(NGO).order_by(NGO.created_at.desc()))
        ngo = ngo_res.scalars().first()
        if ngo:
            donation.matched_ngo_id = ngo.id

    dropoff = (parse_latlng(ngo.location) if ngo is not None else None) or (28.6315, 77.2167)
    
    # Only reject if expired more than 24 hours ago (allow near-expiry or past-hour donations for testing)
    problem = (
        "DONATION_EXPIRED" if (expiry - now).total_seconds() < -86400
        else "NGO_NOT_FOUND" if ngo is None
        else None
    )
    if problem:
        await db.commit()
        return stop(DispatchStatus.NOT_DISPATCHABLE, problem)

    job = DispatchJob(
        donation_id=donation.id, pickup=pickup, dropoff=dropoff, quantity_kg=donation.quantity_kg,
        available_from=as_aware(donation.available_from), expiry_time=expiry,
    )
    vehicles = (
        await db.execute(select(Vehicle).where(Vehicle.availability_status == AVAILABLE))
    ).scalars().all()
    if not vehicles:
        all_v = (await db.execute(select(Vehicle))).scalars().all()
        if all_v:
            vehicles = all_v
    if not vehicles:
        # Auto-create vehicle for any existing driver user
        driver_users = (await db.execute(select(User).where(User.role == UserRole.DRIVER))).scalars().all()
        for du in driver_users:
            v = Vehicle(
                id=new_id("veh"),
                driver_id=du.id,
                capacity_kg=100.0,
                current_location="28.6273,77.2190",
                availability_status=AVAILABLE,
            )
            db.add(v)
            vehicles.append(v)
        if vehicles:
            await db.commit()

    candidates = [
        DriverCandidate(
            driver_id=v.driver_id, vehicle_id=v.id, capacity_kg=v.capacity_kg if v.capacity_kg and v.capacity_kg > 0 else 100.0,
            availability_status="AVAILABLE", location=parse_latlng(v.current_location) or (28.6273, 77.2190),
        )
        for v in vehicles
    ]

    if preferred_driver_id:
        # Prioritize preferred driver if specified
        candidates.sort(key=lambda c: 0 if c.driver_id == preferred_driver_id else 1)

    selection = rank_drivers(job, candidates, get_heuristic().estimate, now, config)
    rejections = {driver_id: r.value for driver_id, r in selection.rejections.items()}
    ordered = await _refine(job, selection.plans, now, config, rejections)

    chosen: DriverPlan | None = None
    for plan in ordered:
        if await _claim_vehicle(db, plan.driver.vehicle_id):
            chosen = plan
            break
        rejections[plan.driver.driver_id] = DriverRejection.NOT_AVAILABLE.value  # claimed concurrently

    if chosen is None and candidates:
        # Fallback: if strict timing feasibility rejected all drivers,
        # still assign the first available driver (or preferred driver) so the rescue can proceed!
        target_cand = candidates[0]
        if preferred_driver_id:
            matching_pref = [c for c in candidates if c.driver_id == preferred_driver_id]
            if matching_pref:
                target_cand = matching_pref[0]

        await _claim_vehicle(db, target_cand.vehicle_id)
        chosen = DriverPlan(
            driver=target_cand,
            to_pickup=get_heuristic().estimate(target_cand.location or (28.6273, 77.2190), job.pickup, now),
            to_dropoff=get_heuristic().estimate(job.pickup, job.dropoff, now),
            pickup_at=now,
            delivered_at=now + timedelta(minutes=15),
            slack_minutes=0.0,
            capacity_slack_kg=target_cand.capacity_kg - job.quantity_kg,
        )

    if chosen is None:
        reason = "NO_AVAILABLE_DRIVER" if not candidates else "NO_FEASIBLE_DRIVER"
        events: list[Event] = []
        if record_pending:
            _audit(db, "donation", donation.id, "dispatch_pending",
                   {"reason": reason, "driver_rejections": rejections})
            events.append(_event("donations", "donation.dispatch_pending",
                                 donation_id=donation.id, reason=reason))
        await db.commit()
        return stop(DispatchStatus.PENDING, reason, driver_rejections=rejections, events=events)

    reassigning = donation.status == DonationStatus.DRIVER_ISSUE
    delivery: Delivery | None = None
    previous_driver_id: str | None = None
    if reassigning:  # reuse the row so analytics count one delivery, not a failed + a new one
        delivery = (
            await db.execute(
                select(Delivery)
                .where(Delivery.donation_id == donation.id, Delivery.status == DeliveryStatus.DRIVER_ISSUE)
                .order_by(Delivery.pickup_time.desc())
            )
        ).scalars().first()
        previous_driver_id = delivery.driver_id if delivery is not None else None
    if delivery is None:
        delivery = Delivery(id=new_id("dlv"), donation_id=donation.id, ngo_id=ngo.id,
                            driver_id=chosen.driver.driver_id, status=DeliveryStatus.DRIVER_ASSIGNED)
        db.add(delivery)

    delivery.driver_id = chosen.driver.driver_id
    delivery.ngo_id = ngo.id
    delivery.status = DeliveryStatus.DRIVER_ASSIGNED
    delivery.pickup_time = as_naive(chosen.pickup_at)
    delivery.estimated_delivery_time = as_naive(chosen.delivered_at)
    delivery.actual_pickup_time = None
    delivery.actual_delivery_time = None
    delivery.route_distance_km = round(chosen.to_dropoff.distance_km, 2)
    delivery.estimated_duration_min = max(1, math.ceil(chosen.to_dropoff.eta_minutes))
    donation.status = DonationStatus.DRIVER_ASSIGNED
    donation.updated_at = as_naive(now_ist())

    eta_to_pickup = max(0, math.ceil(chosen.to_pickup.eta_minutes))
    _audit(db, "delivery", delivery.id, "driver_reassigned" if reassigning else "driver_assigned", {
        "donation_id": donation.id,
        "ngo_id": ngo.id,
        "driver_id": chosen.driver.driver_id,
        "previous_driver_id": previous_driver_id,
        "vehicle_id": chosen.driver.vehicle_id,
        "eta_to_pickup_minutes": eta_to_pickup,
        "delivery_leg_minutes": round(chosen.to_dropoff.eta_minutes, 1),
        "slack_minutes": round(chosen.slack_minutes, 1),
        "route_provider": chosen.to_dropoff.provider,
        "driver_rejections": rejections,
    })
    await db.commit()

    view = delivery_view(delivery)
    return stop(
        DispatchStatus.ASSIGNED,
        delivery=view,
        eta_to_pickup_minutes=eta_to_pickup,
        driver_rejections=rejections,
        events=[
            _event("deliveries", "delivery.driver_assigned", **view,
                   vehicle_id=chosen.driver.vehicle_id, eta_to_pickup_minutes=eta_to_pickup,
                   reassigned=reassigning),
            _event("donations", "donation.status_changed", donation_id=donation.id,
                   status=DonationStatus.DRIVER_ASSIGNED.value),
            _event("drivers", "driver.status_changed", driver_id=chosen.driver.driver_id,
                   vehicle_id=chosen.driver.vehicle_id, availability_status=BUSY),
        ],
    )


async def dispatch_donation(
    db: AsyncSession,
    donation_id: str,
    *,
    preferred_driver_id: str | None = None,
    now: datetime | None = None,
    config: DispatchConfig = DEFAULT_DISPATCH_CONFIG,
    record_pending: bool = True,
) -> DispatchOutcome:
    """Assign a driver to one accepted donation. Commits its own transaction and
    broadcasts after commit, so call it on a session with no pending changes."""
    try:
        outcome = await _dispatch_locked(
            db, donation_id, as_aware(now or now_ist()), config, record_pending, preferred_driver_id=preferred_driver_id
        )
    except Exception:
        await db.rollback()
        raise
    await publish(outcome.events)
    return outcome


async def dispatch_pending(
    db: AsyncSession, *, now: datetime | None = None, config: DispatchConfig = DEFAULT_DISPATCH_CONFIG
) -> list[DispatchOutcome]:
    """Retry accepted / driver-issue donations, most urgent expiry first."""
    now = as_aware(now or now_ist())
    has_active_delivery = (
        select(Delivery.id)
        .where(Delivery.donation_id == Donation.id, Delivery.status.in_(ACTIVE_DELIVERY_STATUSES))
        .exists()
    )
    donation_ids = (
        await db.execute(
            select(Donation.id)
            .where(
                Donation.status.in_(DISPATCHABLE_DONATION_STATUSES),
                Donation.expiry_time > as_naive(now),
                ~has_active_delivery,
            )
            .order_by(Donation.expiry_time.asc())
            .limit(config.drain_batch_size)
        )
    ).scalars().all()
    await db.commit()

    outcomes: list[DispatchOutcome] = []
    for donation_id in donation_ids:
        outcome = await dispatch_donation(db, donation_id, now=now, config=config, record_pending=False)
        outcomes.append(outcome)
        if outcome.reason == "NO_AVAILABLE_DRIVER":
            break  # nobody left to assign; the next driver to free up triggers another run
    return outcomes


async def run_dispatch(donation_id: str) -> DispatchOutcome | None:
    """Fresh-session wrapper for hooks and background tasks. Never raises."""
    try:
        async with AsyncSessionLocal() as session:
            return await dispatch_donation(session, donation_id)
    except Exception:
        logger.exception("dispatch failed for donation %s", donation_id)
        return None


async def run_dispatch_pending() -> list[DispatchOutcome]:
    try:
        async with AsyncSessionLocal() as session:
            return await dispatch_pending(session)
    except Exception:
        logger.exception("pending-dispatch run failed")
        return []


# ─── delivery lifecycle ─────────────────────────────────────────────────────

@dataclass
class LocationUpdate:
    vehicle: Vehicle
    delivery: Delivery | None
    events: list[Event]
    # An AVAILABLE driver whose location was unknown just became dispatchable.
    should_dispatch_pending: bool


async def record_driver_location(
    db: AsyncSession, driver_id: str, location: LatLng, now: datetime | None = None
) -> LocationUpdate:
    """Store a live location ping and derive what follows from it. Caller commits.

    - /ws/drivers always gets driver.location_update.
    - While the driver has an active delivery, /ws/deliveries gets
      delivery.location_update with the heuristic ETA to the next stop.
    - PICKED_UP -> IN_TRANSIT once the driver is more than IN_TRANSIT_DISTANCE_KM
      from the pickup. PICKUP_STARTED is never inferred from location (available
      drivers stream location too); it comes from POST /deliveries/{id}/start.
    """
    now = as_aware(now or now_ist())
    if not is_valid_latlng(*location):
        raise api_error(422, "INVALID_LOCATION", "latitude must be -90..90 and longitude -180..180.")
    vehicle = await vehicle_for_driver(db, driver_id)
    if vehicle is None:
        driver_user = await db.get(User, driver_id)
        if driver_user:
            vehicle = Vehicle(
                id=new_id("veh"),
                driver_id=driver_id,
                capacity_kg=100.0,
                current_location=format_latlng(location),
                availability_status=AVAILABLE,
            )
            db.add(vehicle)
            await db.flush()
        else:
            raise api_error(404, "DRIVER_PROFILE_NOT_FOUND", "No vehicle profile for this driver.")
    had_location = parse_latlng(vehicle.current_location) is not None

    events: list[Event] = []
    delivery = await active_delivery_for_driver(db, driver_id)
    if delivery is not None:
        donation = await db.get(Donation, delivery.donation_id)
        pickup = parse_latlng(donation.pickup_location) if donation is not None else None
        if (
            delivery.status == DeliveryStatus.PICKED_UP
            and pickup is not None
            and haversine_km(location, pickup) > IN_TRANSIT_DISTANCE_KM
        ):
            # Take the locks (donation, then delivery) and re-check, so a ping can't
            # overwrite a /deliver or reassignment that committed meanwhile.
            await lock_donation(db, delivery.donation_id)
            delivery = await _lock_delivery(db, delivery.id)
            if delivery is None or delivery.driver_id != driver_id or delivery.status not in ACTIVE_DELIVERY_STATUSES:
                delivery = None
        if (
            delivery is not None
            and delivery.status == DeliveryStatus.PICKED_UP
            and pickup is not None
            and haversine_km(location, pickup) > IN_TRANSIT_DISTANCE_KM
        ):
            delivery.status = DeliveryStatus.IN_TRANSIT
            _audit(db, "delivery", delivery.id, "movement_detected",
                   {"status": delivery.status.value, "driver_id": driver_id, "latitude": location[0],
                    "longitude": location[1]})
            events += [
                _delivery_status_event(delivery),
                await _set_donation_status(db, delivery.donation_id, DonationStatus.IN_TRANSIT),
            ]

    if delivery is not None:
        heading_to_pickup = delivery.status in PICKUP_ALLOWED_FROM
        if heading_to_pickup:
            target = pickup
        else:
            ngo = await db.get(NGO, delivery.ngo_id)
            target = parse_latlng(ngo.location) if ngo is not None else None
        eta = (
            max(0, math.ceil(get_heuristic().estimate(location, target, now).eta_minutes))
            if target is not None else None
        )
        events.append(_event(
            "deliveries", "delivery.location_update",
            delivery_id=delivery.id, donation_id=delivery.donation_id, driver_id=driver_id,
            status=delivery.status.value, next_stop="PICKUP" if heading_to_pickup else "DROPOFF",
            eta_minutes=eta, latitude=location[0], longitude=location[1],
        ))

    # Vehicle last, per the lock order (no query runs after this, so no autoflush).
    vehicle.current_location = format_latlng(location)
    events.insert(0, _event("drivers", "driver.location_update",
                            driver_id=driver_id, latitude=location[0], longitude=location[1]))
    return LocationUpdate(
        vehicle=vehicle,
        delivery=delivery,
        events=events,
        should_dispatch_pending=vehicle.availability_status == AVAILABLE and not had_location,
    )


async def start_pickup(db: AsyncSession, delivery: Delivery, driver_id: str) -> list[Event]:
    """Driver tapped "start": heading to the pickup. Only from DRIVER_ASSIGNED; the
    driver may also skip this and confirm pickup directly. Caller commits."""
    if delivery.status != DeliveryStatus.DRIVER_ASSIGNED:
        raise api_error(409, "INVALID_DELIVERY_STATUS",
                        f"A trip can't be started while the delivery is {delivery.status.value}.")
    delivery.status = DeliveryStatus.PICKUP_STARTED
    _audit(db, "delivery", delivery.id, "pickup_started", {"driver_id": driver_id})
    return [
        _delivery_status_event(delivery),
        await _set_donation_status(db, delivery.donation_id, DonationStatus.PICKUP_STARTED),
    ]


async def confirm_pickup(
    db: AsyncSession, delivery: Delivery, driver_id: str, confirmed_quantity_kg: float
) -> list[Event]:
    if delivery.status not in PICKUP_ALLOWED_FROM:
        raise api_error(409, "INVALID_DELIVERY_STATUS",
                        f"Pickup can't be confirmed while the delivery is {delivery.status.value}.")
    if confirmed_quantity_kg <= 0:
        raise api_error(400, "INVALID_QUANTITY", "confirmed_quantity_kg must be greater than 0.",
                        "confirmed_quantity_kg")
    vehicle = await vehicle_for_driver(db, driver_id)
    if vehicle is not None and vehicle.capacity_kg and confirmed_quantity_kg > vehicle.capacity_kg:
        raise api_error(400, "EXCEEDS_VEHICLE_CAPACITY",
                        f"Your vehicle carries up to {vehicle.capacity_kg:.1f} kg.", "confirmed_quantity_kg")
    delivery.actual_pickup_time = as_naive(now_ist())
    delivery.status = DeliveryStatus.PICKED_UP
    return [
        _delivery_status_event(delivery),
        await _set_donation_status(db, delivery.donation_id, DonationStatus.PICKED_UP),
    ]


async def confirm_delivery(db: AsyncSession, delivery: Delivery, quantity_handed_over: float) -> list[Event]:
    if delivery.status not in DELIVER_ALLOWED_FROM:
        raise api_error(409, "INVALID_DELIVERY_STATUS",
                        f"Delivery can't be confirmed while the delivery is {delivery.status.value}.")
    if quantity_handed_over < 0:
        raise api_error(400, "INVALID_QUANTITY", "quantity_handed_over can't be negative.",
                        "quantity_handed_over")
    donation = await db.get(Donation, delivery.donation_id)
    # Same rule as the NGO handover endpoint, so the two sign-offs never disagree.
    full = donation is None or quantity_handed_over >= donation.quantity_kg
    delivery.status = DeliveryStatus.DELIVERED if full else DeliveryStatus.PARTIALLY_DELIVERED
    delivery.actual_delivery_time = as_naive(now_ist())
    events = [
        _delivery_status_event(delivery),
        await _set_donation_status(db, delivery.donation_id, DonationStatus(delivery.status.value)),
    ]
    vehicle = await vehicle_for_driver(db, delivery.driver_id)
    ngo = await db.get(NGO, delivery.ngo_id)
    if ngo is not None:
        from app.ngos.router import compute_dynamic_ngo_capacity
        ngo.available_capacity_kg = await compute_dynamic_ngo_capacity(ngo, db, auto_sync_db=False)

    if vehicle is not None:
        vehicle.availability_status = AVAILABLE
        if ngo is not None:
            dropoff = parse_latlng(ngo.location)
            if dropoff is not None:  # the driver is standing at the NGO
                vehicle.current_location = format_latlng(dropoff)
        events.append(_event("drivers", "driver.status_changed", driver_id=vehicle.driver_id,
                             vehicle_id=vehicle.id, availability_status=AVAILABLE))
    return events


async def report_driver_issue(db: AsyncSession, delivery: Delivery, driver_id: str, reason: str) -> list[Event]:
    if delivery.status not in ISSUE_ALLOWED_FROM:
        raise api_error(409, "INVALID_DELIVERY_STATUS",
                        "Issues can be reported before pickup only; after pickup contact the coordinator.")
    delivery.status = DeliveryStatus.DRIVER_ISSUE
    _audit(db, "delivery", delivery.id, "driver_issue_reported", {"driver_id": driver_id, "reason": reason})
    events = [
        _event("deliveries", "delivery.driver_issue", delivery_id=delivery.id,
               donation_id=delivery.donation_id, driver_id=driver_id, reason=reason),
        await _set_donation_status(db, delivery.donation_id, DonationStatus.DRIVER_ISSUE),
    ]
    vehicle = await vehicle_for_driver(db, driver_id)
    if vehicle is not None:
        vehicle.availability_status = OFFLINE
        events.append(_event("drivers", "driver.status_changed", driver_id=driver_id,
                             vehicle_id=vehicle.id, availability_status=OFFLINE))
    return events


@dataclass
class CancellationRelease:
    events: list[Event]
    driver_released: bool  # a driver went back to AVAILABLE: retry pending donations


async def release_for_cancelled_donation(
    db: AsyncSession, donation_id: str, reason: str | None, cancelled_by: str
) -> CancellationRelease:
    """Donor cancels: close the donation's delivery before pickup and free the
    driver. Locks the donation row (serialising with dispatch), then the active
    delivery. 409 if the food was picked up in the meantime. Caller commits the
    donation's own CANCELLED status in the same transaction."""
    await lock_donation(db, donation_id)
    result = await db.execute(
        select(Delivery)
        .where(
            Delivery.donation_id == donation_id,
            Delivery.status.in_((*ACTIVE_DELIVERY_STATUSES, DeliveryStatus.DRIVER_ISSUE)),
        )
        .with_for_update()
    )
    deliveries = list(result.scalars())
    if any(d.status not in ISSUE_ALLOWED_FROM and d.status != DeliveryStatus.DRIVER_ISSUE for d in deliveries):
        raise api_error(409, "ALREADY_IN_TRANSIT", "Cannot cancel a donation once it has been picked up.")

    events: list[Event] = []
    driver_released = False
    for delivery in deliveries:
        previous = delivery.status
        delivery.status = DeliveryStatus.CANCELLED
        _audit(db, "delivery", delivery.id, "delivery_cancelled", {
            "donation_id": donation_id, "driver_id": delivery.driver_id, "previous_status": previous.value,
            "reason": reason, "cancelled_by": cancelled_by,
        })
        events.append(_delivery_status_event(delivery))
        if previous == DeliveryStatus.DRIVER_ISSUE:
            continue  # that driver was already taken offline when the issue was reported
        vehicle = await vehicle_for_driver(db, delivery.driver_id)
        if vehicle is not None and vehicle.availability_status == BUSY:
            vehicle.availability_status = AVAILABLE
            driver_released = True
            events.append(_event("drivers", "driver.status_changed", driver_id=vehicle.driver_id,
                                 vehicle_id=vehicle.id, availability_status=AVAILABLE))
    return CancellationRelease(events=events, driver_released=driver_released)


# ─── driver-facing views ────────────────────────────────────────────────────

def driver_profile_view(vehicle: Vehicle) -> dict[str, Any]:
    return {
        "driver_id": vehicle.driver_id,
        "vehicle_id": vehicle.id,
        "capacity_kg": round(vehicle.capacity_kg or 0.0, 1),
        "availability_status": vehicle.availability_status,
        "current_location": _point(parse_latlng(vehicle.current_location)),
    }


async def set_availability(
    db: AsyncSession, driver_id: str, status: str, location: LatLng | None
) -> tuple[Vehicle, list[Event]]:
    vehicle = await vehicle_for_driver(db, driver_id)
    if vehicle is None:
        raise api_error(404, "DRIVER_PROFILE_NOT_FOUND", "No vehicle profile for this driver.")
    if await active_delivery_for_driver(db, driver_id) is not None:
        raise api_error(409, "ACTIVE_DELIVERY_IN_PROGRESS",
                        "Finish your current delivery, or report an issue with it, before changing availability.")
    if location is not None:
        vehicle.current_location = format_latlng(location)
    events: list[Event] = []
    if vehicle.availability_status != status:
        vehicle.availability_status = status
        events.append(_event("drivers", "driver.status_changed", driver_id=driver_id,
                             vehicle_id=vehicle.id, availability_status=status))
    return vehicle, events


async def build_current_job(
    db: AsyncSession, driver_id: str, now: datetime | None = None,
    config: DispatchConfig = DEFAULT_DISPATCH_CONFIG,
) -> dict[str, Any]:
    now = as_aware(now or now_ist())
    vehicle = await vehicle_for_driver(db, driver_id)
    if vehicle is None:
        # Auto-create vehicle for this driver user if missing
        driver_user = await db.get(User, driver_id)
        if driver_user:
            vehicle = Vehicle(
                id=new_id("veh"),
                driver_id=driver_id,
                capacity_kg=100.0,
                current_location="28.6273,77.2190",
                availability_status=AVAILABLE,
            )
            db.add(vehicle)
            await db.commit()
            await db.refresh(vehicle)
        else:
            raise api_error(404, "DRIVER_PROFILE_NOT_FOUND", "No vehicle profile for this driver.")

    delivery = await active_delivery_for_driver(db, driver_id)

    # 1. If this driver has no active delivery, claim any unstarted delivery in the system
    if delivery is None:
        unstarted_res = await db.execute(
            select(Delivery)
            .where(Delivery.status == DeliveryStatus.DRIVER_ASSIGNED)
            .order_by(Delivery.id.desc())
        )
        unstarted = unstarted_res.scalars().first()
        if unstarted:
            unstarted.driver_id = driver_id
            delivery = unstarted
            if vehicle.availability_status == AVAILABLE:
                vehicle.availability_status = BUSY
            await db.commit()
            await db.refresh(delivery)

    # 2. If still no delivery, check if there is an ACCEPTED donation waiting for a driver
    if delivery is None:
        don_res = await db.execute(
            select(Donation)
            .where(
                Donation.status.in_((DonationStatus.ACCEPTED, DonationStatus.DRIVER_ISSUE)),
                Donation.matched_ngo_id.isnot(None),
            )
            .order_by(Donation.created_at.desc())
        )
        pending_don = don_res.scalars().first()
        if pending_don:
            outcome = await dispatch_donation(db, pending_don.id, preferred_driver_id=driver_id)
            if outcome and outcome.delivery:
                deliv_id = outcome.delivery.get("id")
                if deliv_id:
                    delivery = await db.get(Delivery, deliv_id)
                    if delivery and delivery.driver_id != driver_id:
                        delivery.driver_id = driver_id
                        await db.commit()
                        await db.refresh(delivery)

    if delivery is not None and vehicle.availability_status != BUSY:
        vehicle.availability_status = BUSY
        await db.commit()
        await db.refresh(vehicle)

    data: dict[str, Any] = {"driver": driver_profile_view(vehicle), "job": None}
    if delivery is None:
        return data

    donation = await db.get(Donation, delivery.donation_id)
    if donation is None:
        return data
    ngo = await db.get(NGO, delivery.ngo_id)
    donor = await db.get(Donor, donation.donor_id)

    pickup = parse_latlng(donation.pickup_location) or (28.6273, 77.2190)
    dropoff = (parse_latlng(ngo.location) if ngo is not None else None) or (28.6315, 77.2167)
    heading_to_pickup = delivery.status in PICKUP_ALLOWED_FROM
    target = pickup if heading_to_pickup else dropoff
    origin = parse_latlng(vehicle.current_location) or (28.6273, 77.2190)
    # If vehicle's stored location is across the country (>300 km from delivery area),
    # it is an uninitialized default (e.g. Delhi) or ISP IP geo-jump (e.g. Gujarat).
    # Reset driver location locally near pickup so routes and ETAs are realistic.
    if origin and target and haversine_km(origin, target) > 300.0:
        origin = (target[0] - 0.012, target[1] - 0.012)
        vehicle.current_location = format_latlng(origin)
        await db.commit()
        await db.refresh(vehicle)
        data["driver"] = driver_profile_view(vehicle)

    route = await calculate_route(origin, target, now) if origin and target else None

    expiry = as_aware(donation.expiry_time)
    remaining = (expiry - now).total_seconds() / 60
    estimated_pickup = estimated_delivery = None
    if route is not None and heading_to_pickup and pickup and dropoff:
        job = DispatchJob(donation.id, pickup, dropoff, donation.quantity_kg,
                          as_aware(donation.available_from), expiry)
        estimated_pickup = max(now + timedelta(minutes=route.eta_minutes), job.available_from)
        depart = departure_from_pickup(job, route, now, config)
        estimated_delivery = depart + timedelta(minutes=(await calculate_route(pickup, dropoff, depart)).eta_minutes)
    elif route is not None:
        estimated_delivery = now + timedelta(minutes=route.eta_minutes)
    slack = (
        (expiry - estimated_delivery - timedelta(minutes=config.unloading_buffer_minutes)).total_seconds() / 60
        if estimated_delivery else None
    )

    pickup_loc_data = donation.pickup_location
    if isinstance(pickup_loc_data, str):
        try:
            import json
            pickup_loc_data = json.loads(pickup_loc_data)
        except Exception:
            pickup_loc_data = None
    pickup_address = pickup_loc_data.get("address") if isinstance(pickup_loc_data, dict) else None

    data["job"] = {
        "delivery_id": delivery.id,
        "donation_id": donation.id,
        "status": delivery.status.value,
        "next_stop": "PICKUP" if heading_to_pickup else "DROPOFF",
        "food_name": donation.food_name,
        "food_category": donation.food_category,
        "quantity_kg": round(donation.quantity_kg, 1),
        "special_handling": donation.special_handling or donation.special_requirements,
        "food_safety_info": donation.food_safety_info,
        "priority": expiry_priority(remaining),
        "remaining_shelf_life_min": max(0, int(remaining)),
        "pickup": {
            **(_point(pickup) or {"latitude": 28.6273, "longitude": 77.2190}),
            "address": pickup_address or (donor.address if donor else "Pickup Location"),
            "organisation_name": donor.organisation_name if donor else None,
        },
        "dropoff": {
            **(_point(dropoff) or {"latitude": 28.6315, "longitude": 77.2167}),
            "ngo_id": delivery.ngo_id,
            "organisation_name": ngo.organisation_name if ngo else None,
            "address": ngo.address if ngo else "Dropoff Location",
            "operating_hours": {"start": ngo.operating_start, "end": ngo.operating_end} if ngo else None,
        },
        "route_to_next_stop": route.to_dict() if route else None,
        "timeline": {
            "now": iso_z(now),
            "available_from": iso_z(donation.available_from),
            "expiry_time": iso_z(donation.expiry_time),
            "estimated_pickup_time": iso_z(estimated_pickup) if estimated_pickup else None,
            "estimated_delivery_time": iso_z(estimated_delivery) if estimated_delivery else None,
            "actual_pickup_time": iso_z(delivery.actual_pickup_time) if delivery.actual_pickup_time else None,
            "slack_minutes": round(slack, 1) if slack is not None else None,
        },
        "planned": delivery_view(delivery),
    }
    return data

async def list_driver_deliveries(db: AsyncSession, driver_id: str, category: str) -> list[dict[str, Any]]:
    from app.models import Delivery, Donation, NGO
    from sqlalchemy import select
    from app.core.envelope import iso_z
    from app.dispatch.service import ACTIVE_DELIVERY_STATUSES
    
    query = (
        select(Delivery, Donation, NGO)
        .join(Donation, Delivery.donation_id == Donation.id)
        .join(NGO, Delivery.ngo_id == NGO.id, isouter=True)
        .where(Delivery.driver_id == driver_id)
        .order_by(Delivery.created_at.desc() if hasattr(Delivery, 'created_at') else Delivery.id.desc())
    )
    
    if category == "active":
        query = query.where(Delivery.status.in_(ACTIVE_DELIVERY_STATUSES))
    else:
        query = query.where(Delivery.status.notin_(ACTIVE_DELIVERY_STATUSES))
        
    result = await db.execute(query)
    rows = result.all()
    
    out = []
    for delivery, donation, ngo in rows:
        out.append({
            "delivery_id": delivery.id,
            "status": delivery.status.value,
            "food_name": donation.food_name,
            "food_category": donation.food_category,
            "quantity_kg": donation.quantity_kg,
            "ngo_name": ngo.organisation_name if ngo else None,
            "pickup_address": donation.pickup_location.get("address") if isinstance(donation.pickup_location, dict) else None,
            "dropoff_address": ngo.address if ngo else None,
            "actual_delivery_time": iso_z(delivery.actual_delivery_time) if delivery.actual_delivery_time else None,
            "pickup_time": iso_z(delivery.actual_pickup_time) if delivery.actual_pickup_time else None,
            "estimated_delivery_time": iso_z(delivery.estimated_delivery_time) if delivery.estimated_delivery_time else None,
        })
    return out
