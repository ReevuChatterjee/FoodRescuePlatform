"""Driver delivery lifecycle over HTTP: pickup, deliver, idempotency, guards."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Delivery, DeliveryStatus, Donation, DonationStatus, HandoverRecord, Vehicle
from tests.dispatch.conftest import NGO_LOCATION, assign, idem, make_donation, make_vehicle

pytestmark = pytest.mark.asyncio


async def test_pickup_then_full_delivery(world, client):
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world)
    world.act_as("drv_a")

    picked = await client.post(f"/api/v1/deliveries/{delivery['id']}/pickup",
                               json={"confirmed_quantity_kg": 35.0}, headers=idem())
    assert picked.status_code == 200, picked.text
    body = picked.json()["data"]
    assert body["status"] == "PICKED_UP" and body["actual_pickup_time"].endswith("Z")
    assert (await world.get(Donation, "don_1")).status == DonationStatus.PICKED_UP

    delivered = await client.post(
        f"/api/v1/deliveries/{delivery['id']}/deliver",
        json={"quantity_handed_over": 35.0, "condition": "GOOD", "recipient_confirmation": True},
        headers=idem(),
    )
    assert delivered.status_code == 200, delivered.text
    assert delivered.json()["data"]["status"] == "DELIVERED"
    assert (await world.get(Donation, "don_1")).status == DonationStatus.DELIVERED

    vehicle = await world.get(Vehicle, "veh_drv_a")
    assert vehicle.availability_status == "AVAILABLE"
    assert vehicle.current_location == NGO_LOCATION  # the driver is standing at the NGO

    async with world.sessions() as s:
        record = (await s.execute(select(HandoverRecord).where(HandoverRecord.delivery_id == delivery["id"]))).scalar_one()
    assert record.quantity_handed_over == 35.0 and record.ngo_confirmation is True

    assert await world.audit_types(delivery["id"]) == ["driver_assigned", "pickup_confirmed", "delivery_confirmed"]
    statuses = [e["status"] for e in world.events if e["event"] == "delivery.status_changed"]
    assert statuses == ["PICKED_UP", "DELIVERED"]
    assert "driver.status_changed" in world.event_names("drivers")


async def test_start_then_pickup(world, client):
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world)
    world.act_as("drv_a")
    url = f"/api/v1/deliveries/{delivery['id']}/start"
    headers = idem()

    started = await client.post(url, headers=headers)
    assert started.status_code == 200, started.text
    assert started.json()["data"]["status"] == "PICKUP_STARTED"
    assert (await world.get(Donation, "don_1")).status == DonationStatus.PICKUP_STARTED
    assert (await client.post(url, headers=headers)).json() == started.json()  # replay
    assert (await client.post(url, headers=idem())).status_code == 409  # already started

    picked = await client.post(f"/api/v1/deliveries/{delivery['id']}/pickup",
                               json={"confirmed_quantity_kg": 35}, headers=idem())
    assert picked.json()["data"]["status"] == "PICKED_UP"
    assert (await client.post(url, headers=idem())).status_code == 409  # too late to start
    assert await world.audit_types(delivery["id"]) == ["driver_assigned", "pickup_started", "pickup_confirmed"]
    statuses = [e["status"] for e in world.events if e["event"] == "donation.status_changed"]
    assert statuses == ["DRIVER_ASSIGNED", "PICKUP_STARTED", "PICKED_UP"]


async def test_start_requires_own_delivery_and_key(world, client):
    await world.add(make_vehicle("drv_a"), make_vehicle("drv_b", location="13.100000,77.590000"))
    delivery = await assign(world)
    world.act_as("drv_b")
    assert (await client.post(f"/api/v1/deliveries/{delivery['id']}/start", headers=idem())).status_code == 403
    world.act_as("drv_a")
    assert (await client.post(f"/api/v1/deliveries/{delivery['id']}/start")).status_code == 400
    assert (await world.get(Delivery, delivery["id"])).status == DeliveryStatus.DRIVER_ASSIGNED


async def test_partial_delivery(world, client):
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world)
    world.act_as("drv_a")
    await client.post(f"/api/v1/deliveries/{delivery['id']}/pickup", json={"confirmed_quantity_kg": 35}, headers=idem())

    response = await client.post(
        f"/api/v1/deliveries/{delivery['id']}/deliver",
        json={"quantity_handed_over": 28.0, "condition": "GOOD", "recipient_confirmation": True},
        headers=idem(),
    )
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "PARTIALLY_DELIVERED"
    assert (await world.get(Donation, "don_1")).status == DonationStatus.PARTIALLY_DELIVERED
    assert (await world.get(Vehicle, "veh_drv_a")).availability_status == "AVAILABLE"


async def test_idempotent_replay_returns_cached_body_without_rerunning(world, client):
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world)
    world.act_as("drv_a")
    headers = idem()
    url = f"/api/v1/deliveries/{delivery['id']}/pickup"

    first = await client.post(url, json={"confirmed_quantity_kg": 35}, headers=headers)
    replay = await client.post(url, json={"confirmed_quantity_kg": 35}, headers=headers)
    assert first.status_code == replay.status_code == 200
    assert replay.json() == first.json()  # same request_id: served from the cache
    assert (await world.audit_types(delivery["id"])).count("pickup_confirmed") == 1
    assert world.event_names("deliveries").count("delivery.status_changed") == 1

    # A different key for an action that already happened is a real conflict.
    again = await client.post(url, json={"confirmed_quantity_kg": 35}, headers=idem())
    assert again.status_code == 409
    assert again.json()["detail"]["error"]["code"] == "INVALID_DELIVERY_STATUS"


async def test_idempotency_key_is_scoped_per_delivery(world, client):
    await world.add(make_vehicle("drv_a"), make_vehicle("drv_b"))
    first = await assign(world, "don_1")
    second = await assign(world, "don_2")
    headers = idem()
    for delivery in (first, second):
        world.act_as(delivery["driver_id"])
        response = await client.post(f"/api/v1/deliveries/{delivery['id']}/pickup",
                                     json={"confirmed_quantity_kg": 35}, headers=headers)
        assert response.status_code == 200
        assert response.json()["data"]["id"] == delivery["id"]


async def test_wrong_driver_gets_403_even_on_a_replayed_key(world, client):
    await world.add(make_vehicle("drv_a"), make_vehicle("drv_b", location="13.100000,77.590000"))
    delivery = await assign(world)
    assert delivery["driver_id"] == "drv_a"
    headers = idem()
    world.act_as("drv_a")
    assert (await client.post(f"/api/v1/deliveries/{delivery['id']}/pickup",
                              json={"confirmed_quantity_kg": 35}, headers=headers)).status_code == 200

    world.act_as("drv_b")
    for key in (headers, idem()):
        response = await client.post(f"/api/v1/deliveries/{delivery['id']}/pickup",
                                     json={"confirmed_quantity_kg": 35}, headers=key)
        assert response.status_code == 403


async def test_non_driver_and_missing_key_and_unknown_delivery(world, client):
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world)

    world.act_as("donor_u")
    assert (await client.post(f"/api/v1/deliveries/{delivery['id']}/pickup",
                              json={"confirmed_quantity_kg": 35}, headers=idem())).status_code == 403
    world.act_as("drv_a")
    missing = await client.post(f"/api/v1/deliveries/{delivery['id']}/pickup", json={"confirmed_quantity_kg": 35})
    assert missing.status_code == 400
    unknown = await client.post("/api/v1/deliveries/dlv_nope/pickup", json={"confirmed_quantity_kg": 35}, headers=idem())
    assert unknown.status_code == 404


async def test_state_guards_return_409(world, client):
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world)
    world.act_as("drv_a")
    early = await client.post(
        f"/api/v1/deliveries/{delivery['id']}/deliver",
        json={"quantity_handed_over": 35.0, "condition": "GOOD", "recipient_confirmation": True},
        headers=idem(),
    )
    assert early.status_code == 409
    assert (await world.get(Delivery, delivery["id"])).status == DeliveryStatus.DRIVER_ASSIGNED
    assert (await world.get(Vehicle, "veh_drv_a")).availability_status == "BUSY"


async def test_pickup_validates_quantity_against_vehicle(world, client):
    await world.add(make_vehicle("drv_a", capacity_kg=40))
    delivery = await assign(world)
    world.act_as("drv_a")
    url = f"/api/v1/deliveries/{delivery['id']}/pickup"
    too_much = await client.post(url, json={"confirmed_quantity_kg": 41}, headers=idem())
    assert too_much.status_code == 400
    assert too_much.json()["detail"]["error"]["code"] == "EXCEEDS_VEHICLE_CAPACITY"
    zero = await client.post(url, json={"confirmed_quantity_kg": 0}, headers=idem())
    assert zero.status_code == 400
    assert (await world.get(Delivery, delivery["id"])).status == DeliveryStatus.DRIVER_ASSIGNED


async def test_delivery_frees_driver_for_a_waiting_donation(world, client):
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world, "don_1")
    await world.add(make_donation("don_2", quantity_kg=20))
    async with world.sessions() as s:
        from app.dispatch.service import DispatchStatus, dispatch_donation
        assert (await dispatch_donation(s, "don_2")).status == DispatchStatus.PENDING

    world.act_as("drv_a")
    await client.post(f"/api/v1/deliveries/{delivery['id']}/pickup", json={"confirmed_quantity_kg": 35}, headers=idem())
    await client.post(
        f"/api/v1/deliveries/{delivery['id']}/deliver",
        json={"quantity_handed_over": 35.0, "condition": "GOOD", "recipient_confirmation": True},
        headers=idem(),
    )
    # The background run_dispatch_pending has finished by the time the client returns.
    assert (await world.get(Donation, "don_2")).status == DonationStatus.DRIVER_ASSIGNED
    [waiting] = await world.deliveries_for("don_2")
    assert waiting.driver_id == "drv_a"
