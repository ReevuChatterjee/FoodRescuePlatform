"""Whole journeys over HTTP, and the no-double-assignment guarantees under concurrency."""
from __future__ import annotations

import asyncio

import pytest
from sqlalchemy import select

from app.dispatch.service import DispatchStatus, dispatch_donation
from app.models import AuditLog, Delivery, DeliveryStatus, Donation, DonationStatus, Vehicle
from tests.dispatch.conftest import NGO_LOCATION, idem, make_donation, make_vehicle

pytestmark = pytest.mark.asyncio


async def test_accept_start_pickup_ping_partial_delivery(world, client):
    await world.add(make_vehicle("drv_a"), make_donation("don_1", status=DonationStatus.MATCHED, ngo_id=None))

    world.act_as("ngo_u")
    accepted = await client.post("/api/v1/matching/don_1/accept",
                                 json={"ngo_id": "ngo_1", "weights_version_id": "wv", "match_score": 0.9})
    assert accepted.status_code == 200

    world.act_as("drv_a")
    job = (await client.get("/api/v1/drivers/me/current-job")).json()["data"]["job"]
    delivery_id = job["delivery_id"]
    steps = [
        ("post", f"/api/v1/deliveries/{delivery_id}/start", None, "PICKUP_STARTED"),
        ("post", f"/api/v1/deliveries/{delivery_id}/pickup", {"confirmed_quantity_kg": 35.0}, "PICKED_UP"),
        ("post", "/api/v1/drivers/location", {"latitude": 12.9420, "longitude": 77.6200}, "IN_TRANSIT"),
        ("post", f"/api/v1/deliveries/{delivery_id}/deliver",
         {"quantity_handed_over": 28.0, "condition": "GOOD", "recipient_confirmation": True}, "PARTIALLY_DELIVERED"),
    ]
    for _, url, body, expected in steps:
        headers = {} if url.endswith("/location") else idem()
        response = await client.post(url, json=body, headers=headers)
        assert response.status_code == 200, (url, response.text)
        assert (await world.get(Delivery, delivery_id)).status.value == expected
        assert (await world.get(Donation, "don_1")).status.value == expected

    vehicle = await world.get(Vehicle, "veh_drv_a")
    assert vehicle.availability_status == "AVAILABLE" and vehicle.current_location == NGO_LOCATION
    assert (await client.get("/api/v1/drivers/me/current-job")).json()["data"]["job"] is None
    assert await world.audit_types(delivery_id) == [
        "driver_assigned", "pickup_started", "pickup_confirmed", "movement_detected", "delivery_confirmed",
    ]
    donation_statuses = [e["status"] for e in world.events_named("donation.status_changed")]
    assert donation_statuses == [
        "DRIVER_ASSIGNED", "PICKUP_STARTED", "PICKED_UP", "IN_TRANSIT", "PARTIALLY_DELIVERED",
    ]

    # Person 3's NGO handover still works on top of the driver's delivery.
    world.act_as("ngo_u")
    handover = await client.post(f"/api/v1/handover/{delivery_id}", headers=idem(),
                                 json={"ngo_confirmation": True, "quantity_handed_over": 28.0, "condition": "GOOD"})
    assert handover.status_code == 200, handover.text
    assert (await world.get(Donation, "don_1")).status == DonationStatus.PARTIALLY_DELIVERED


async def test_concurrent_dispatch_of_one_donation_assigns_once(world):
    await world.add(make_vehicle("drv_a"), make_vehicle("drv_b"), make_donation("don_1"))

    async def run():
        async with world.sessions() as s:
            return await dispatch_donation(s, "don_1")

    outcomes = await asyncio.gather(run(), run(), run())
    assert sorted(o.status for o in outcomes) == [
        DispatchStatus.ALREADY_ASSIGNED, DispatchStatus.ALREADY_ASSIGNED, DispatchStatus.ASSIGNED,
    ]
    assert len(await world.deliveries_for("don_1")) == 1
    async with world.sessions() as s:
        busy = (await s.execute(select(Vehicle).where(Vehicle.availability_status == "BUSY"))).scalars().all()
        audits = (await s.execute(select(AuditLog).where(AuditLog.event_type == "driver_assigned"))).scalars().all()
    assert len(busy) == 1 and len(audits) == 1


async def test_two_donations_racing_for_one_driver(world):
    await world.add(make_vehicle("drv_a"), make_donation("don_1"), make_donation("don_2"))

    async def run(donation_id):
        async with world.sessions() as s:
            return await dispatch_donation(s, donation_id)

    outcomes = await asyncio.gather(run("don_1"), run("don_2"))
    assert sorted(o.status for o in outcomes) == [DispatchStatus.ASSIGNED, DispatchStatus.PENDING]
    async with world.sessions() as s:
        deliveries = (await s.execute(select(Delivery))).scalars().all()
    assert len(deliveries) == 1 and deliveries[0].status == DeliveryStatus.DRIVER_ASSIGNED


async def test_expired_donation_is_not_dispatchable(world):
    await world.add(make_vehicle("drv_a"), make_donation("don_1", expiry_minutes=-1))
    async with world.sessions() as s:
        outcome = await dispatch_donation(s, "don_1")
    assert outcome.status == DispatchStatus.NOT_DISPATCHABLE and outcome.reason == "DONATION_EXPIRED"
    assert (await world.get(Vehicle, "veh_drv_a")).availability_status == "AVAILABLE"
