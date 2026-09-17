"""Driver issue -> reassignment (same NGO); donor cancel -> driver released."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.dispatch.service import release_for_cancelled_donation
from app.models import Delivery, DeliveryStatus, Donation, DonationStatus, Vehicle
from tests.dispatch.conftest import assign, idem, make_donation, make_vehicle

pytestmark = pytest.mark.asyncio

CANCEL = {"reason": "Event ran late, food served"}


async def cancel(world, client, donation_id: str = "don_1"):
    world.act_as("donor_u")
    return await client.patch(f"/api/v1/donations/{donation_id}/cancel", json=CANCEL)


async def test_report_issue_reassigns_same_ngo_reusing_the_delivery(world, client):
    await world.add(make_vehicle("drv_a"), make_vehicle("drv_b", location="12.950000,77.640000"))
    delivery = await assign(world)
    assert delivery["driver_id"] == "drv_a"
    world.act_as("drv_a")
    headers = idem()
    url = f"/api/v1/deliveries/{delivery['id']}/report-issue"

    response = await client.post(url, json={"reason": "Flat tyre"}, headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["data"]["status"] == "DRIVER_ISSUE"
    assert (await world.get(Vehicle, "veh_drv_a")).availability_status == "OFFLINE"

    # Background run_dispatch reassigned it: same row, same NGO, new driver.
    [row] = await world.deliveries_for("don_1")
    assert row.id == delivery["id"] and row.ngo_id == "ngo_1"
    assert row.driver_id == "drv_b" and row.status == DeliveryStatus.DRIVER_ASSIGNED
    assert (await world.get(Donation, "don_1")).status == DonationStatus.DRIVER_ASSIGNED
    assert await world.audit_types(delivery["id"]) == ["driver_assigned", "driver_issue_reported", "driver_reassigned"]
    [issue] = world.events_named("delivery.driver_issue")
    assert issue["reason"] == "Flat tyre" and issue["driver_id"] == "drv_a"
    assert world.events_named("delivery.driver_assigned")[-1]["reassigned"] is True

    assert (await client.post(url, json={"reason": "Flat tyre"}, headers=headers)).json() == response.json()
    assert (await client.post(url, json={"reason": "Flat tyre"}, headers=idem())).status_code == 403


async def test_report_issue_not_allowed_after_pickup(world, client):
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world)
    world.act_as("drv_a")
    await client.post(f"/api/v1/deliveries/{delivery['id']}/pickup", json={"confirmed_quantity_kg": 35}, headers=idem())
    response = await client.post(f"/api/v1/deliveries/{delivery['id']}/report-issue",
                                 json={"reason": "Flat tyre"}, headers=idem())
    assert response.status_code == 409


@pytest.mark.parametrize("started", [False, True])
async def test_donor_cancel_before_pickup_frees_the_driver(world, client, started):
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world)
    if started:
        world.act_as("drv_a")
        assert (await client.post(f"/api/v1/deliveries/{delivery['id']}/start", headers=idem())).status_code == 200

    response = await cancel(world, client)
    assert response.status_code == 200, response.text
    assert response.json()["data"]["status"] == "CANCELLED"
    assert (await world.get(Delivery, delivery["id"])).status == DeliveryStatus.CANCELLED
    assert (await world.get(Vehicle, "veh_drv_a")).availability_status == "AVAILABLE"
    assert "delivery_cancelled" in await world.audit_types(delivery["id"])
    assert world.events_named("delivery.status_changed")[-1]["status"] == "CANCELLED"
    assert world.events_named("driver.status_changed")[-1]["availability_status"] == "AVAILABLE"

    # The driver's app no longer shows a job.
    world.act_as("drv_a")
    job = await client.get("/api/v1/drivers/me/current-job")
    assert job.status_code == 200 and job.json()["data"]["job"] is None


async def test_cancel_frees_driver_for_a_waiting_donation(world, client):
    await world.add(make_vehicle("drv_a"))
    await assign(world, "don_1")
    await world.add(make_donation("don_2", quantity_kg=20))
    world.act_as("admin_u")
    assert (await client.post("/api/v1/dispatch/don_2")).json()["data"]["status"] == "PENDING"

    assert (await cancel(world, client)).status_code == 200
    [waiting] = await world.deliveries_for("don_2")
    assert waiting.driver_id == "drv_a" and waiting.status == DeliveryStatus.DRIVER_ASSIGNED


async def test_cancel_after_pickup_is_409_and_changes_nothing(world, client):
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world)
    world.act_as("drv_a")
    await client.post(f"/api/v1/deliveries/{delivery['id']}/pickup", json={"confirmed_quantity_kg": 35}, headers=idem())

    assert (await cancel(world, client)).status_code == 409
    assert (await world.get(Delivery, delivery["id"])).status == DeliveryStatus.PICKED_UP
    assert (await world.get(Vehicle, "veh_drv_a")).availability_status == "BUSY"


async def test_release_helper_refuses_when_pickup_raced_the_status_check(world):
    """The donations router checks a status it read before taking the lock; the
    helper re-checks the delivery under the lock."""
    await world.add(make_vehicle("drv_a"))
    delivery = await assign(world)
    async with world.sessions() as s:
        row = await s.get(Delivery, delivery["id"])
        row.status = DeliveryStatus.PICKED_UP  # donation row still says DRIVER_ASSIGNED
        await s.commit()
    async with world.sessions() as s:
        with pytest.raises(HTTPException) as error:
            await release_for_cancelled_donation(s, "don_1", "late", "donor_u")
    assert error.value.status_code == 409


async def test_cancel_while_waiting_for_reassignment_closes_the_issue_delivery(world, client):
    await world.add(make_vehicle("drv_a"))  # only driver: nobody to reassign to
    delivery = await assign(world)
    world.act_as("drv_a")
    await client.post(f"/api/v1/deliveries/{delivery['id']}/report-issue", json={"reason": "Engine"}, headers=idem())
    assert (await world.get(Donation, "don_1")).status == DonationStatus.DRIVER_ISSUE

    assert (await cancel(world, client)).status_code == 200
    assert (await world.get(Delivery, delivery["id"])).status == DeliveryStatus.CANCELLED
    assert (await world.get(Vehicle, "veh_drv_a")).availability_status == "OFFLINE"  # stays offline


async def test_cancel_without_delivery_is_unchanged(world, client):
    await world.add(make_donation("don_1", status=DonationStatus.MATCHED))
    response = await cancel(world, client)
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "CANCELLED"
    assert world.events_named("delivery.status_changed") == []
