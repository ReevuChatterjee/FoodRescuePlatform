"""NGO accept -> dispatch (the matching router hook), pending retries, rejections."""
from __future__ import annotations

import pytest

from app.dispatch.service import DispatchStatus, dispatch_donation
from app.models import DeliveryStatus, Donation, DonationStatus, Vehicle
from tests.dispatch.conftest import PICKUP, make_donation, make_vehicle

pytestmark = pytest.mark.asyncio

ACCEPT = {"ngo_id": "ngo_1", "weights_version_id": "wv_test", "match_score": 0.91}


async def accept(world, client, donation_id: str = "don_1"):
    world.act_as("ngo_u")
    return await client.post(f"/api/v1/matching/{donation_id}/accept", json=ACCEPT)


async def test_accept_assigns_best_driver_and_notifies(world, client):
    await world.add(
        make_vehicle("drv_a", location="12.936000,77.625000"),
        make_vehicle("drv_b", location="12.990000,77.550000"),
        make_donation("don_1", status=DonationStatus.MATCHED, ngo_id=None),
    )
    response = await accept(world, client)
    assert response.status_code == 200, response.text
    assert response.json()["data"]["status"] == "ACCEPTED"  # response shape unchanged

    # The background dispatch has run by the time the client call returns.
    donation = await world.get(Donation, "don_1")
    assert donation.status == DonationStatus.DRIVER_ASSIGNED
    [delivery] = await world.deliveries_for("don_1")
    assert delivery.driver_id == "drv_a" and delivery.ngo_id == "ngo_1"
    assert delivery.status == DeliveryStatus.DRIVER_ASSIGNED
    assert delivery.route_distance_km > 0 and delivery.estimated_duration_min >= 1
    assert delivery.pickup_time is not None and delivery.estimated_delivery_time > delivery.pickup_time
    assert (await world.get(Vehicle, "veh_drv_a")).availability_status == "BUSY"
    assert (await world.get(Vehicle, "veh_drv_b")).availability_status == "AVAILABLE"

    [assigned] = world.events_named("delivery.driver_assigned")
    assert assigned["_channel"] == "deliveries"
    assert assigned["id"] == delivery.id and assigned["driver_id"] == "drv_a"
    assert assigned["eta_to_pickup_minutes"] >= 0 and assigned["reassigned"] is False
    assert await world.audit_types(delivery.id) == ["driver_assigned"]

    # The donor-facing donation view now carries the driver and ETA.
    world.act_as("donor_u")
    view = (await client.get("/api/v1/donations/don_1")).json()["data"]
    assert view["driver_id"] == "drv_a" and view["eta_minutes"] == delivery.estimated_duration_min


async def test_no_driver_stays_pending_until_a_driver_goes_online(world, client):
    await world.add(
        make_vehicle("drv_a", status="OFFLINE", location=""),
        make_donation("don_1", status=DonationStatus.MATCHED, ngo_id=None),
    )
    assert (await accept(world, client)).status_code == 200
    assert (await world.get(Donation, "don_1")).status == DonationStatus.ACCEPTED
    assert await world.deliveries_for("don_1") == []
    [pending] = world.events_named("donation.dispatch_pending")
    assert pending["donation_id"] == "don_1" and pending["reason"] == "NO_AVAILABLE_DRIVER"
    assert "dispatch_pending" in await world.audit_types("don_1")

    world.act_as("drv_a")
    online = await client.patch("/api/v1/drivers/me/availability", json={
        "availability_status": "AVAILABLE", "latitude": PICKUP["latitude"], "longitude": PICKUP["longitude"],
    })
    assert online.status_code == 200, online.text
    assert online.json()["data"]["availability_status"] == "AVAILABLE"

    assert (await world.get(Donation, "don_1")).status == DonationStatus.DRIVER_ASSIGNED
    [delivery] = await world.deliveries_for("don_1")
    assert delivery.driver_id == "drv_a"


async def test_no_vehicles_at_all_is_pending_with_reason(world, client):
    await world.add(make_donation("don_1"))
    async with world.sessions() as s:
        outcome = await dispatch_donation(s, "don_1")
    assert outcome.status == DispatchStatus.PENDING and outcome.reason == "NO_AVAILABLE_DRIVER"


async def test_capacity_rejection(world, client):
    await world.add(
        make_vehicle("drv_a", capacity_kg=20),
        make_donation("don_1", quantity_kg=35, status=DonationStatus.MATCHED, ngo_id=None),
    )
    assert (await accept(world, client)).status_code == 200
    assert (await world.get(Donation, "don_1")).status == DonationStatus.ACCEPTED
    assert await world.deliveries_for("don_1") == []
    assert (await world.get(Vehicle, "veh_drv_a")).availability_status == "AVAILABLE"

    async with world.sessions() as s:
        outcome = await dispatch_donation(s, "don_1")
    assert outcome.driver_rejections == {"drv_a": "INSUFFICIENT_VEHICLE_CAPACITY"}


async def test_expiry_rejection_picks_the_driver_who_can_make_it(world, client):
    await world.add(
        # Yelahanka: roughly an hour away from the Koramangala pickup in traffic.
        make_vehicle("drv_b", capacity_kg=40, location="13.100700,77.596300"),
        make_vehicle("drv_a", capacity_kg=200, location="12.936000,77.625000"),
        make_donation("don_1", expiry_minutes=40, status=DonationStatus.MATCHED, ngo_id=None),
    )
    assert (await accept(world, client)).status_code == 200
    [delivery] = await world.deliveries_for("don_1")
    assert delivery.driver_id == "drv_a"

    async with world.sessions() as s:
        outcome = await dispatch_donation(s, "don_1")
    assert outcome.status == DispatchStatus.ALREADY_ASSIGNED


async def test_expiry_rejection_leaves_donation_pending(world, client):
    await world.add(
        make_vehicle("drv_b", location="13.100700,77.596300"),
        make_donation("don_1", expiry_minutes=30, status=DonationStatus.MATCHED, ngo_id=None),
    )
    assert (await accept(world, client)).status_code == 200
    assert (await world.get(Donation, "don_1")).status == DonationStatus.ACCEPTED
    async with world.sessions() as s:
        outcome = await dispatch_donation(s, "don_1")
    assert outcome.driver_rejections == {"drv_b": "EXPIRY_NOT_FEASIBLE"}


async def test_admin_dispatch_trigger(world, client):
    await world.add(make_vehicle("drv_a"), make_donation("don_1"))
    world.act_as("drv_a")
    assert (await client.post("/api/v1/dispatch/don_1")).status_code == 403
    world.act_as("admin_u")
    first = await client.post("/api/v1/dispatch/don_1")
    assert first.status_code == 200
    assert first.json()["data"]["status"] == "ASSIGNED"
    again = await client.post("/api/v1/dispatch/don_1")
    assert again.json()["data"]["status"] == "ALREADY_ASSIGNED"
