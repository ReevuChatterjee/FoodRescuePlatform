"""Lock order: every path that changes a delivery locks the donation row first.

Deterministic check instead of trying to provoke a real deadlock: a separate
transaction holds the donation row lock, the request under test is started and
must block on it, and while it waits the delivery and vehicle rows must still be
free (FOR UPDATE NOWAIT succeeds). A path that locked the delivery or vehicle
first would make NOWAIT fail. Then the holder commits and the request completes.
"""
from __future__ import annotations

import asyncio

import pytest
from sqlalchemy import text

from app.models import Delivery, DeliveryStatus
from tests.dispatch.conftest import assign, idem, make_vehicle

pytestmark = pytest.mark.asyncio

DELIVER_BODY = {"quantity_handed_over": 35.0, "condition": "GOOD", "recipient_confirmation": True}


async def _wait_until_blocked(world, timeout: float = 5.0) -> None:
    async with world.sessions() as s:
        for _ in range(int(timeout / 0.05)):
            waiting = (await s.execute(text(
                "SELECT count(*) FROM pg_stat_activity "
                "WHERE datname = current_database() AND wait_event_type = 'Lock'"
            ))).scalar_one()
            if waiting:
                return
            await asyncio.sleep(0.05)
    raise AssertionError("request never blocked on the donation lock")


async def _prepare(world, client, action: str) -> tuple[dict, str, str, dict | None, dict]:
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world)
    world.act_as("drv_a")
    base = f"/api/v1/deliveries/{delivery['id']}"
    if action in ("deliver", "location"):
        picked = await client.post(f"{base}/pickup", json={"confirmed_quantity_kg": 35}, headers=idem())
        assert picked.status_code == 200
    requests = {
        "start": ("post", f"{base}/start", None, idem()),
        "pickup": ("post", f"{base}/pickup", {"confirmed_quantity_kg": 35}, idem()),
        "deliver": ("post", f"{base}/deliver", DELIVER_BODY, idem()),
        "report-issue": ("post", f"{base}/report-issue", {"reason": "Flat tyre"}, idem()),
        "location": ("post", "/api/v1/drivers/location", {"latitude": 12.9400, "longitude": 77.6245}, {}),
        "cancel": ("patch", "/api/v1/donations/don_1/cancel", {"reason": "No longer available"}, {}),
    }
    return delivery, *requests[action]


@pytest.mark.parametrize("action", ["start", "pickup", "deliver", "report-issue", "location", "cancel"])
async def test_donation_row_is_locked_before_delivery_and_vehicle(world, client, action):
    delivery, method, url, body, headers = await _prepare(world, client, action)
    world.act_as("donor_u" if action == "cancel" else "drv_a")

    async with world.sessions() as holder:
        await holder.execute(text("SELECT id FROM donations WHERE id = 'don_1' FOR UPDATE"))
        request = asyncio.create_task(client.request(method, url, json=body, headers=headers))
        try:
            await _wait_until_blocked(world)
            # While the request waits for the donation, delivery and vehicle rows are free.
            await holder.execute(text("SELECT id FROM deliveries WHERE id = :id FOR UPDATE NOWAIT"),
                                 {"id": delivery["id"]})
            await holder.execute(text("SELECT id FROM vehicles WHERE id = 'veh_drv_a' FOR UPDATE NOWAIT"))
        finally:
            # Always release the donation lock and let the request finish, so a
            # failure here can't leave a transaction blocking the next test.
            await holder.rollback()
            response = await asyncio.wait_for(request, timeout=15)

    assert response.status_code == 200, response.text


async def test_ping_racing_a_delivery_does_not_resurrect_in_transit(world, client):
    """The IN_TRANSIT ping re-checks the delivery under the lock, so a /deliver that
    committed while the ping waited is not overwritten."""
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world)
    world.act_as("drv_a")
    await client.post(f"/api/v1/deliveries/{delivery['id']}/pickup", json={"confirmed_quantity_kg": 35}, headers=idem())

    async with world.sessions() as holder:
        await holder.execute(text("SELECT id FROM donations WHERE id = 'don_1' FOR UPDATE"))
        ping = asyncio.create_task(client.post("/api/v1/drivers/location", json={"latitude": 12.94, "longitude": 77.6245}))
        try:
            await _wait_until_blocked(world)
            # Simulate /deliver committing first, inside the lock holder's transaction.
            await holder.execute(text("UPDATE deliveries SET status = 'DELIVERED' WHERE id = :id"),
                                 {"id": delivery["id"]})
            await holder.commit()
        finally:
            await holder.rollback()  # no-op after a commit; releases the lock on failure
            response = await asyncio.wait_for(ping, timeout=15)

    assert response.status_code == 200
    assert (await world.get(Delivery, delivery["id"])).status == DeliveryStatus.DELIVERED
    assert world.events_named("delivery.location_update") == []
