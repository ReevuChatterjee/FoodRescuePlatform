"""Driver selection — pure functions, no database, no HTTP.

Mirrors Person 4's style: hard constraints first (with named rejection reasons
for explainability), then a deterministic ranking of the survivors.

Hard constraints, in order:
  1. Vehicle available?
  2. Vehicle big enough for the donation?
  3. Driver location known?
  4. Can the food reach the NGO before expiry, counting the driver's trip to the
     pickup, waiting for available_from, loading, the delivery leg and unloading?

Ranking: earliest estimated arrival at the NGO (least spoilage risk), then the
smallest vehicle that fits (keeps large vehicles free for large donations), then
driver_id so ties never order randomly.
"""
from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

from app.routing.geo import LatLng
from app.routing.providers import RouteEstimate


@dataclass(frozen=True)
class DispatchConfig:
    loading_buffer_minutes: float = 5.0  # ASSUMPTION: time at the donor to load
    unloading_buffer_minutes: float = 5.0  # ASSUMPTION: time at the NGO to hand over
    refine_top_n: int = 3  # candidates re-checked with the configured (maybe live) provider
    drain_batch_size: int = 10  # accepted donations retried when a driver frees up


DEFAULT_DISPATCH_CONFIG = DispatchConfig()


class DriverRejection(str, Enum):
    NOT_AVAILABLE = "DRIVER_NOT_AVAILABLE"
    INSUFFICIENT_VEHICLE_CAPACITY = "INSUFFICIENT_VEHICLE_CAPACITY"
    LOCATION_UNKNOWN = "DRIVER_LOCATION_UNKNOWN"
    EXPIRY_NOT_FEASIBLE = "EXPIRY_NOT_FEASIBLE"


@dataclass(frozen=True)
class DriverCandidate:
    driver_id: str  # users.id — what deliveries.driver_id references
    vehicle_id: str
    capacity_kg: float
    availability_status: str
    location: LatLng | None


@dataclass(frozen=True)
class DispatchJob:
    donation_id: str
    pickup: LatLng
    dropoff: LatLng
    quantity_kg: float
    available_from: datetime  # timezone-aware UTC
    expiry_time: datetime  # timezone-aware UTC


@dataclass(frozen=True)
class DriverPlan:
    driver: DriverCandidate
    to_pickup: RouteEstimate
    to_dropoff: RouteEstimate
    pickup_at: datetime  # when loading can start
    delivered_at: datetime  # estimated arrival at the NGO
    slack_minutes: float  # expiry minus (arrival + unloading); >= 0 means feasible
    capacity_slack_kg: float

    @property
    def feasible(self) -> bool:
        return self.slack_minutes >= 0


@dataclass(frozen=True)
class SelectionResult:
    plans: list[DriverPlan]  # feasible only, best first
    rejections: dict[str, DriverRejection]  # driver_id -> first failed constraint


Estimator = Callable[[LatLng, LatLng, datetime], RouteEstimate]


def departure_from_pickup(
    job: DispatchJob, to_pickup: RouteEstimate, now: datetime, config: DispatchConfig
) -> datetime:
    arrive = now + timedelta(minutes=to_pickup.eta_minutes)
    return max(arrive, job.available_from) + timedelta(minutes=config.loading_buffer_minutes)


def build_plan(
    job: DispatchJob,
    driver: DriverCandidate,
    to_pickup: RouteEstimate,
    to_dropoff: RouteEstimate,
    now: datetime,
    config: DispatchConfig = DEFAULT_DISPATCH_CONFIG,
) -> DriverPlan:
    pickup_at = max(now + timedelta(minutes=to_pickup.eta_minutes), job.available_from)
    delivered_at = departure_from_pickup(job, to_pickup, now, config) + timedelta(
        minutes=to_dropoff.eta_minutes
    )
    finished = delivered_at + timedelta(minutes=config.unloading_buffer_minutes)
    return DriverPlan(
        driver=driver,
        to_pickup=to_pickup,
        to_dropoff=to_dropoff,
        pickup_at=pickup_at,
        delivered_at=delivered_at,
        slack_minutes=(job.expiry_time - finished).total_seconds() / 60,
        capacity_slack_kg=driver.capacity_kg - job.quantity_kg,
    )


def plan_sort_key(plan: DriverPlan) -> tuple:
    return (
        round(plan.delivered_at.timestamp() / 60),
        plan.capacity_slack_kg,
        plan.driver.driver_id,
    )


def rank_drivers(
    job: DispatchJob,
    drivers: Iterable[DriverCandidate],
    estimator: Estimator,
    now: datetime,
    config: DispatchConfig = DEFAULT_DISPATCH_CONFIG,
) -> SelectionResult:
    plans: list[DriverPlan] = []
    rejections: dict[str, DriverRejection] = {}
    seen: set[str] = set()
    for driver in drivers:
        if driver.driver_id in seen:
            continue
        seen.add(driver.driver_id)
        if driver.availability_status != "AVAILABLE":
            rejections[driver.driver_id] = DriverRejection.NOT_AVAILABLE
            continue
        if driver.capacity_kg < job.quantity_kg:
            rejections[driver.driver_id] = DriverRejection.INSUFFICIENT_VEHICLE_CAPACITY
            continue
        if driver.location is None:
            rejections[driver.driver_id] = DriverRejection.LOCATION_UNKNOWN
            continue
        to_pickup = estimator(driver.location, job.pickup, now)
        depart = departure_from_pickup(job, to_pickup, now, config)
        to_dropoff = estimator(job.pickup, job.dropoff, depart)
        plan = build_plan(job, driver, to_pickup, to_dropoff, now, config)
        if not plan.feasible:
            rejections[driver.driver_id] = DriverRejection.EXPIRY_NOT_FEASIBLE
            continue
        plans.append(plan)
    plans.sort(key=plan_sort_key)
    return SelectionResult(plans=plans, rejections=rejections)


def expiry_priority(remaining_minutes: float) -> str:
    """Section 9 escalation: >4h LOW, 2-4h MEDIUM, 1-2h HIGH, <1h CRITICAL."""
    if remaining_minutes <= 0:
        return "EXPIRED"
    if remaining_minutes < 60:
        return "CRITICAL"
    if remaining_minutes < 120:
        return "HIGH"
    if remaining_minutes <= 240:
        return "MEDIUM"
    return "LOW"
