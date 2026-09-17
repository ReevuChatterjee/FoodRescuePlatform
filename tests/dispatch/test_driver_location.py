"""POST /api/v1/drivers/location: rate limit, broadcasts, IN_TRANSIT, dispatch trigger."""
from __future__ import annotations

import pytest

from app.models import Delivery, DeliveryStatus, Donation, DonationStatus, Vehicle
from tests.dispatch.conftest import PICKUP, assign, idem, make_donation, make_vehicle

pytestmark = pytest.mark.asyncio

LOCATION_URL = "/api/v1/drivers/location"
AT_PICKUP = {"latitude": 12.9355, "longitude": 77.6247}  # ~40 m from the pickup
AWAY = {"latitude": 12.9400, "longitude": 77.6245}  # ~530 m north


async def test_available_driver_broadcasts_only_on_drivers_channel(world, client):
    await world.add(make_vehicle("drv_a"))
    world.act_as("drv_a")
    response = await client.post(LOCATION_URL, json={"latitude": 12.95, "longitude": 77.63})
    assert response.status_code == 200
    assert response.json()["data"] == {"driver_id": "drv_a", "latitude": 12.95, "longitude": 77.63}
    assert world.event_names("drivers") == ["driver.location_update"]
    assert world.event_names("deliveries") == []
    event = world.events_named("driver.location_update")[0]
    assert event["latitude"] == 12.95 and event["timestamp"].endswith("Z")
    assert (await world.get(Vehicle, "veh_drv_a")).current_location == "12.950000,77.630000"


async def test_rate_limit_is_one_per_five_seconds_with_grace(world, client):
    await world.add(make_vehicle("drv_a"), make_vehicle("drv_b"))
    world.act_as("drv_a")
    assert (await client.post(LOCATION_URL, json=AWAY)).status_code == 200

    world.advance(2)
    limited = await client.post(LOCATION_URL, json=AWAY)
    assert limited.status_code == 429
    assert limited.json()["detail"]["error"]["code"] == "RATE_LIMITED"

    world.advance(2.6)  # 4.6 s after the accepted ping: within the 0.5 s jitter grace
    assert (await client.post(LOCATION_URL, json=AWAY)).status_code == 200
    world.advance(4.4)
    assert (await client.post(LOCATION_URL, json=AWAY)).status_code == 429

    world.act_as("drv_b")  # per driver, not global
    assert (await client.post(LOCATION_URL, json=AWAY)).status_code == 200


async def test_rejected_pings_do_not_consume_the_slot(world, client):
    await world.add(make_vehicle("drv_a"))
    world.act_as("drv_a")
    assert (await client.post(LOCATION_URL, json={"latitude": 91, "longitude": 0})).status_code == 422
    assert (await client.post(LOCATION_URL, json=AWAY)).status_code == 200


async def test_driver_without_vehicle_and_non_driver(world, client):
    world.act_as("drv_a")
    assert (await client.post(LOCATION_URL, json=AWAY)).status_code == 404
    world.act_as("donor_u")
    assert (await client.post(LOCATION_URL, json=AWAY)).status_code == 403


async def test_assigned_driver_ping_is_enriched_and_does_not_start_pickup(world, client):
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world)
    world.act_as("drv_a")

    assert (await client.post(LOCATION_URL, json=AWAY)).status_code == 200
    assert (await world.get(Delivery, delivery["id"])).status == DeliveryStatus.DRIVER_ASSIGNED
    [update] = world.events_named("delivery.location_update")
    assert update["_channel"] == "deliveries"
    assert {k: update[k] for k in ("delivery_id", "donation_id", "driver_id", "status", "next_stop")} == {
        "delivery_id": delivery["id"], "donation_id": "don_1", "driver_id": "drv_a",
        "status": "DRIVER_ASSIGNED", "next_stop": "PICKUP",
    }
    assert isinstance(update["eta_minutes"], int) and update["eta_minutes"] >= 1
    assert update["latitude"] == AWAY["latitude"] and update["timestamp"].endswith("Z")
    assert "driver.location_update" in world.event_names("drivers")


async def test_in_transit_only_after_pickup_and_150m_away(world, client):
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world)
    world.act_as("drv_a")
    await client.post(f"/api/v1/deliveries/{delivery['id']}/pickup", json={"confirmed_quantity_kg": 35}, headers=idem())

    assert (await client.post(LOCATION_URL, json=AT_PICKUP)).status_code == 200
    assert (await world.get(Delivery, delivery["id"])).status == DeliveryStatus.PICKED_UP

    world.advance(5)
    assert (await client.post(LOCATION_URL, json=AWAY)).status_code == 200
    assert (await world.get(Delivery, delivery["id"])).status == DeliveryStatus.IN_TRANSIT
    assert (await world.get(Donation, "don_1")).status == DonationStatus.IN_TRANSIT
    assert "movement_detected" in await world.audit_types(delivery["id"])

    updates = world.events_named("delivery.location_update")
    assert [(u["status"], u["next_stop"]) for u in updates] == [("PICKED_UP", "DROPOFF"), ("IN_TRANSIT", "DROPOFF")]
    # The status change is published before the location update that caused it.
    in_transit = [(e["event"]) for e in world.events if e.get("status") == "IN_TRANSIT"]
    assert in_transit == ["delivery.status_changed", "donation.status_changed", "delivery.location_update"]

    world.advance(5)
    await client.post(LOCATION_URL, json=AT_PICKUP)  # coming back doesn't revert
    assert (await world.get(Delivery, delivery["id"])).status == DeliveryStatus.IN_TRANSIT

    delivered = await client.post(
        f"/api/v1/deliveries/{delivery['id']}/deliver",
        json={"quantity_handed_over": 35.0, "condition": "GOOD", "recipient_confirmation": True},
        headers=idem(),
    )
    assert delivered.json()["data"]["status"] == "DELIVERED"

    world.events.clear()
    world.advance(5)
    await client.post(LOCATION_URL, json=AWAY)  # done: back to /ws/drivers only
    assert world.event_names("deliveries") == []


async def test_first_known_location_of_available_driver_triggers_dispatch(world, client):
    await world.add(make_vehicle("drv_a", location=""))
    await world.add(make_donation("don_1"))
    async with world.sessions() as s:
        from app.dispatch.service import DispatchStatus, dispatch_donation
        outcome = await dispatch_donation(s, "don_1")
    assert outcome.status == DispatchStatus.PENDING
    assert outcome.driver_rejections == {"drv_a": "DRIVER_LOCATION_UNKNOWN"}

    world.act_as("drv_a")
    near = {"latitude": PICKUP["latitude"] + 0.001, "longitude": PICKUP["longitude"]}
    assert (await client.post(LOCATION_URL, json=near)).status_code == 200
    assert (await world.get(Donation, "don_1")).status == DonationStatus.DRIVER_ASSIGNED
    [delivery] = await world.deliveries_for("don_1")
    assert delivery.driver_id == "drv_a"


async def test_offline_driver_with_new_location_does_not_trigger_dispatch(world, client):
    await world.add(make_vehicle("drv_a", location="", status="OFFLINE"), make_donation("don_1"))
    world.act_as("drv_a")
    assert (await client.post(LOCATION_URL, json=AWAY)).status_code == 200
    assert (await world.get(Donation, "don_1")).status == DonationStatus.ACCEPTED
    assert await world.deliveries_for("don_1") == []
