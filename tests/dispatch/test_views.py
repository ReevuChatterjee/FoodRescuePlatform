"""Read views Person 5 fills in: NGO incoming offers, driver current job."""
from __future__ import annotations

import pytest

from app.models import DonationStatus
from app.routing.geo import decode_polyline
from app.routing.service import offer_route_summary
from tests.dispatch.conftest import NGO_LOCATION, PICKUP, assign, idem, make_donation, make_vehicle

pytestmark = pytest.mark.asyncio

ROUTE_KEYS = {
    "distance_km", "duration_minutes", "geometry", "traffic_aware",
    "traffic_source", "free_flow_duration_minutes", "provider", "departure_time",
}


async def test_incoming_offers_have_eta_and_distance(world, client):
    await world.add(make_donation("don_1", status=DonationStatus.MATCHED))
    world.act_as("ngo_u")
    response = await client.get("/api/v1/ngos/ngo_1/incoming")
    assert response.status_code == 200, response.text
    [offer] = response.json()["data"]
    assert isinstance(offer["eta_minutes"], int) and offer["eta_minutes"] >= 1
    assert isinstance(offer["distance_km"], float) and offer["distance_km"] > 0
    expected = offer_route_summary(PICKUP, NGO_LOCATION)
    assert offer["distance_km"] == expected["distance_km"]
    assert offer["remaining_shelf_life_min"] > 0


async def test_incoming_offer_with_unparseable_pickup_has_null_route(world, client):
    donation = make_donation("don_1", status=DonationStatus.MATCHED)
    donation.pickup_location = {"address": "no coordinates"}
    await world.add(donation)
    world.act_as("ngo_u")
    [offer] = (await client.get("/api/v1/ngos/ngo_1/incoming")).json()["data"]
    assert offer["eta_minutes"] is None and offer["distance_km"] is None


async def test_current_job_payload(world, client):
    await world.add(make_vehicle("drv_a"))
    world.act_as("drv_a")
    idle = (await client.get("/api/v1/drivers/me/current-job")).json()["data"]
    assert idle["job"] is None and idle["driver"]["availability_status"] == "AVAILABLE"

    delivery = await assign(world)
    data = (await client.get("/api/v1/drivers/me/current-job")).json()["data"]
    job = data["job"]
    assert data["driver"]["availability_status"] == "BUSY"
    assert job["delivery_id"] == delivery["id"] and job["next_stop"] == "PICKUP"
    assert job["priority"] == "MEDIUM" and 170 <= job["remaining_shelf_life_min"] <= 180
    assert job["pickup"]["address"] == PICKUP["address"] and job["dropoff"]["organisation_name"] == "Food Bank A"
    assert job["special_handling"] and job["food_safety_info"]["allergen_tags"] == ["dairy"]
    route = job["route_to_next_stop"]
    assert set(route) == ROUTE_KEYS  # same shape as POST /routes/calculate
    assert route["traffic_aware"] is False and route["traffic_source"] == "time_of_day_model"
    assert route["duration_minutes"] >= route["free_flow_duration_minutes"]
    assert decode_polyline(route["geometry"])[-1] == (PICKUP["latitude"], PICKUP["longitude"])
    assert job["timeline"]["slack_minutes"] > 0 and job["timeline"]["estimated_delivery_time"].endswith("Z")

    await client.post(f"/api/v1/deliveries/{delivery['id']}/pickup", json={"confirmed_quantity_kg": 35}, headers=idem())
    job = (await client.get("/api/v1/drivers/me/current-job")).json()["data"]["job"]
    assert job["next_stop"] == "DROPOFF" and job["status"] == "PICKED_UP"


async def test_availability_guards(world, client):
    await world.add(make_vehicle("drv_a"))
    world.act_as("drv_a")
    offline = await client.patch("/api/v1/drivers/me/availability", json={"availability_status": "OFFLINE"})
    assert offline.status_code == 200 and offline.json()["data"]["availability_status"] == "OFFLINE"
    assert (await client.patch("/api/v1/drivers/me/availability", json={"availability_status": "BUSY"})).status_code == 422
    half = await client.patch("/api/v1/drivers/me/availability", json={"availability_status": "AVAILABLE", "latitude": 12.9})
    assert half.status_code == 422

    await client.patch("/api/v1/drivers/me/availability", json={"availability_status": "AVAILABLE"})
    await assign(world)
    busy = await client.patch("/api/v1/drivers/me/availability", json={"availability_status": "OFFLINE"})
    assert busy.status_code == 409
