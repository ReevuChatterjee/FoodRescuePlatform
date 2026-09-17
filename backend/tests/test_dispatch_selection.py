"""Person 5 dispatch selection unit tests (pure functions, no database)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.dispatch.selection import (
    DispatchConfig,
    DispatchJob,
    DriverCandidate,
    DriverRejection,
    build_plan,
    departure_from_pickup,
    expiry_priority,
    plan_sort_key,
    rank_drivers,
)
from app.routing.providers import HeuristicRouteProvider, RouteEstimate

UTC = timezone.utc
NOW = datetime(2026, 9, 17, 6, 30, tzinfo=UTC)  # 12:00 IST
PICKUP = (12.9352, 77.6245)
DROPOFF = (12.9345, 77.6104)
NO_BUFFERS = DispatchConfig(loading_buffer_minutes=0, unloading_buffer_minutes=0)


def job(quantity_kg: float = 30.0, expiry_minutes: float = 120, available_in: float = 0) -> DispatchJob:
    return DispatchJob(
        donation_id="don_x", pickup=PICKUP, dropoff=DROPOFF, quantity_kg=quantity_kg,
        available_from=NOW + timedelta(minutes=available_in),
        expiry_time=NOW + timedelta(minutes=expiry_minutes),
    )


def driver(driver_id: str, capacity: float = 50.0, status: str = "AVAILABLE",
           location=(12.9355, 77.6240)) -> DriverCandidate:
    return DriverCandidate(driver_id, f"veh_{driver_id}", capacity, status, location)


def route(eta_minutes: float) -> RouteEstimate:
    return RouteEstimate(
        distance_km=1.0, duration_minutes=eta_minutes, traffic_duration_minutes=eta_minutes,
        geometry="", provider="fake", departure_time=NOW, traffic_source="none",
    )


def fixed_estimator(to_pickup: dict[tuple, float], delivery_leg: float):
    """ETA to pickup looked up by driver location; the delivery leg is constant."""
    def estimate(origin, destination, departure):
        return route(delivery_leg if origin == PICKUP else to_pickup[origin])
    return estimate


# ─── expiry priority (§9) ───────────────────────────────────────────────────

@pytest.mark.parametrize(
    "minutes, priority",
    [(-5, "EXPIRED"), (0, "EXPIRED"), (0.5, "CRITICAL"), (59.9, "CRITICAL"), (60, "HIGH"),
     (119, "HIGH"), (120, "MEDIUM"), (240, "MEDIUM"), (241, "LOW"), (10_000, "LOW")],
)
def test_expiry_priority_escalation(minutes, priority):
    assert expiry_priority(minutes) == priority


# ─── hard constraints ───────────────────────────────────────────────────────

def test_rejections_name_the_first_failed_constraint_in_order():
    drivers = [
        driver("offline_and_small", capacity=5, status="OFFLINE", location=None),
        driver("busy", status="BUSY"),
        driver("small_no_location", capacity=10, location=None),
        driver("no_location", location=None),
        driver("far", location=(13.3, 77.1)),
        driver("ok"),
    ]
    result = rank_drivers(job(), drivers, HeuristicRouteProvider().estimate, NOW)
    assert result.rejections == {
        "offline_and_small": DriverRejection.NOT_AVAILABLE,
        "busy": DriverRejection.NOT_AVAILABLE,
        "small_no_location": DriverRejection.INSUFFICIENT_VEHICLE_CAPACITY,
        "no_location": DriverRejection.LOCATION_UNKNOWN,
        "far": DriverRejection.EXPIRY_NOT_FEASIBLE,
    }
    assert [p.driver.driver_id for p in result.plans] == ["ok"]


def test_capacity_equal_to_quantity_is_enough():
    result = rank_drivers(job(quantity_kg=30), [driver("exact", capacity=30)],
                          HeuristicRouteProvider().estimate, NOW)
    assert [p.driver.driver_id for p in result.plans] == ["exact"]
    assert result.plans[0].capacity_slack_kg == 0


def test_duplicate_driver_rows_are_considered_once():
    result = rank_drivers(job(), [driver("d"), driver("d", capacity=500)],
                          HeuristicRouteProvider().estimate, NOW)
    assert len(result.plans) == 1 and result.plans[0].driver.capacity_kg == 50


def test_no_drivers_gives_empty_result():
    result = rank_drivers(job(), [], HeuristicRouteProvider().estimate, NOW)
    assert result.plans == [] and result.rejections == {}


# ─── feasibility arithmetic ─────────────────────────────────────────────────

def test_plan_counts_drive_loading_delivery_and_unloading():
    config = DispatchConfig(loading_buffer_minutes=5, unloading_buffer_minutes=5)
    plan = build_plan(job(expiry_minutes=120), driver("d"), route(10), route(20), NOW, config)
    assert plan.pickup_at == NOW + timedelta(minutes=10)
    assert plan.delivered_at == NOW + timedelta(minutes=10 + 5 + 20)
    assert plan.slack_minutes == pytest.approx(120 - (10 + 5 + 20 + 5))
    assert plan.feasible


def test_plan_waits_for_available_from():
    config = DispatchConfig(loading_buffer_minutes=5, unloading_buffer_minutes=5)
    j = job(expiry_minutes=120, available_in=30)
    plan = build_plan(j, driver("d"), route(10), route(20), NOW, config)
    assert plan.pickup_at == NOW + timedelta(minutes=30)
    assert departure_from_pickup(j, route(10), NOW, config) == NOW + timedelta(minutes=35)
    assert plan.slack_minutes == pytest.approx(120 - (30 + 5 + 20 + 5))


def test_zero_slack_is_feasible_negative_is_not():
    on_time = build_plan(job(expiry_minutes=30), driver("d"), route(10), route(20), NOW, NO_BUFFERS)
    late = build_plan(job(expiry_minutes=29.9), driver("d"), route(10), route(20), NOW, NO_BUFFERS)
    assert on_time.slack_minutes == pytest.approx(0) and on_time.feasible
    assert not late.feasible


def test_buffers_can_make_a_trip_infeasible():
    loc = (12.95, 77.63)
    estimator = fixed_estimator({loc: 10}, delivery_leg=20)
    tight = job(expiry_minutes=35)
    assert rank_drivers(tight, [driver("d", location=loc)], estimator, NOW, NO_BUFFERS).plans
    buffered = DispatchConfig(loading_buffer_minutes=5, unloading_buffer_minutes=5)
    result = rank_drivers(tight, [driver("d", location=loc)], estimator, NOW, buffered)
    assert result.rejections == {"d": DriverRejection.EXPIRY_NOT_FEASIBLE}


def test_delivery_leg_is_estimated_at_the_departure_time():
    seen = []
    loc = (12.95, 77.63)

    def estimator(origin, destination, departure):
        seen.append((origin, destination, departure))
        return route(10)

    config = DispatchConfig(loading_buffer_minutes=5, unloading_buffer_minutes=5)
    rank_drivers(job(available_in=30), [driver("d", location=loc)], estimator, NOW, config)
    assert seen == [(loc, PICKUP, NOW), (PICKUP, DROPOFF, NOW + timedelta(minutes=35))]


# ─── ranking ────────────────────────────────────────────────────────────────

def test_earliest_arrival_at_ngo_wins():
    near, far = (12.94, 77.62), (12.99, 77.66)
    estimator = fixed_estimator({near: 5, far: 25}, delivery_leg=10)
    result = rank_drivers(job(), [driver("far", location=far), driver("near", location=near)],
                          estimator, NOW, NO_BUFFERS)
    assert [p.driver.driver_id for p in result.plans] == ["near", "far"]


def test_arrival_ties_break_on_smallest_fitting_vehicle_then_driver_id():
    loc = (12.94, 77.62)
    estimator = fixed_estimator({loc: 5}, delivery_leg=10)
    drivers = [
        driver("c_big", capacity=200, location=loc),
        driver("b_fit", capacity=40, location=loc),
        driver("a_fit", capacity=40, location=loc),
    ]
    result = rank_drivers(job(quantity_kg=30), drivers, estimator, NOW, NO_BUFFERS)
    assert [p.driver.driver_id for p in result.plans] == ["a_fit", "b_fit", "c_big"]


def test_arrivals_within_the_same_minute_count_as_a_tie():
    a, b = (12.94, 77.62), (12.941, 77.621)
    estimator = fixed_estimator({a: 5.0, b: 5.2}, delivery_leg=10)
    drivers = [driver("slightly_later_small", capacity=35, location=b), driver("big", capacity=200, location=a)]
    result = rank_drivers(job(quantity_kg=30), drivers, estimator, NOW, NO_BUFFERS)
    assert [p.driver.driver_id for p in result.plans] == ["slightly_later_small", "big"]


def test_contract_example_ranking_with_heuristic():
    drivers = [
        driver("drv_small", capacity=20, location=(12.9360, 77.6250)),
        driver("drv_near_big", capacity=200, location=(12.9355, 77.6240)),
        driver("drv_near_fit", capacity=40, location=(12.9355, 77.6240)),
        driver("drv_far", capacity=100, location=(13.3, 77.1)),
        driver("drv_off", capacity=100, status="OFFLINE", location=(12.93, 77.62)),
        driver("drv_noloc", capacity=100, location=None),
    ]
    result = rank_drivers(job(), drivers, HeuristicRouteProvider().estimate, NOW)
    assert [p.driver.driver_id for p in result.plans] == ["drv_near_fit", "drv_near_big"]
    assert set(result.rejections) == {"drv_small", "drv_far", "drv_off", "drv_noloc"}
    assert result.plans == sorted(result.plans, key=plan_sort_key)
