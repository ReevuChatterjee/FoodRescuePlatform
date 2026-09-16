"""API tests for NGO profile, capacity, categories, demand, and incoming offers."""

from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from httpx import AsyncClient

from app.auth.dependencies import get_current_user, require_ngo
from app.core.database import get_db
from app.main import app
from app.models import Donation, DonationStatus, User, UserRole
from tests.fixtures.seed import db_session, seed_donors, seed_ngos, seed_users


def ngo_payload(**overrides):
    payload = {
        "organisation_name": "Community Food Bank",
        "address": "10 Relief Road, Bengaluru",
        "location": "12.9716,77.5946",
        "storage_capacity_kg": 100.0,
        "available_capacity_kg": 75.0,
        "operating_start": "08:00",
        "operating_end": "20:00",
    }
    payload.update(overrides)
    return payload


@pytest.fixture
async def ngo_client(db_session, seed_users):
    async def override_get_db():
        yield db_session

    def override_current_user():
        return seed_users["ngo_001"]

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_current_user
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


def test_non_ngo_user_is_rejected_by_role_guard():
    donor = User(
        id="donor_guard",
        name="Donor",
        email="guard@example.test",
        phone="+910000000000",
        password_hash="unused",
        role=UserRole.DONOR,
    )

    with pytest.raises(HTTPException) as error:
        require_ngo(donor)

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_ngo_registration_and_profile_is_scoped_to_current_ngo(ngo_client):
    created = await ngo_client.post("/api/v1/ngos", json=ngo_payload())

    assert created.status_code == 201
    ngo = created.json()["data"]
    assert ngo["organisation_name"] == "Community Food Bank"
    assert ngo["available_capacity_kg"] == 75.0

    listed = await ngo_client.get("/api/v1/ngos/me")
    assert listed.status_code == 200
    assert listed.json()["data"]["ngo_id"] == ngo["ngo_id"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        ngo_payload(storage_capacity_kg=-1),
        ngo_payload(available_capacity_kg=-1),
        ngo_payload(storage_capacity_kg=20, available_capacity_kg=21),
    ],
)
async def test_registration_rejects_invalid_capacity(ngo_client, payload):
    response = await ngo_client.post("/api/v1/ngos", json=payload)

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_capacity_update_cannot_exceed_storage(ngo_client):
    created = await ngo_client.post("/api/v1/ngos", json=ngo_payload(storage_capacity_kg=50, available_capacity_kg=20))
    ngo_id = created.json()["data"]["ngo_id"]

    invalid = await ngo_client.patch(f"/api/v1/ngos/{ngo_id}/capacity", json={"available_capacity_kg": 51})
    valid = await ngo_client.patch(f"/api/v1/ngos/{ngo_id}/capacity", json={"available_capacity_kg": 50})

    assert invalid.status_code == 422
    assert valid.status_code == 200
    assert valid.json()["data"]["available_capacity_kg"] == 50


@pytest.mark.asyncio
async def test_categories_and_demand_crud(ngo_client):
    created = await ngo_client.post("/api/v1/ngos", json=ngo_payload())
    ngo_id = created.json()["data"]["ngo_id"]

    categories = await ngo_client.put(f"/api/v1/ngos/{ngo_id}/categories", json={"categories": ["prepared_meals", "packaged"]})
    assert categories.status_code == 200
    assert categories.json()["data"] == ["PACKAGED", "PREPARED_MEALS"]

    demand_body = {
        "food_category": "PREPARED_MEALS",
        "required_quantity_kg": 30,
        "priority": "HIGH",
        "valid_until": (datetime.utcnow() + timedelta(days=1)).isoformat(),
    }
    demand = await ngo_client.post(f"/api/v1/ngos/{ngo_id}/demand", json=demand_body)
    assert demand.status_code == 201
    demand_id = demand.json()["data"]["id"]
    assert demand.json()["data"]["priority"] == "HIGH"

    updated = await ngo_client.patch(f"/api/v1/ngos/{ngo_id}/demand/{demand_id}", json={**demand_body, "required_quantity_kg": 35})
    assert updated.status_code == 200
    assert updated.json()["data"]["required_quantity_kg"] == 35

    listed = await ngo_client.get(f"/api/v1/ngos/{ngo_id}/demand")
    assert len(listed.json()["data"]) == 1

    deleted = await ngo_client.delete(f"/api/v1/ngos/{ngo_id}/demand/{demand_id}")
    assert deleted.status_code == 204
    assert (await ngo_client.get(f"/api/v1/ngos/{ngo_id}/demand")).json()["data"] == []


@pytest.mark.asyncio
async def test_incoming_endpoint_returns_only_matched_donations(ngo_client, db_session, seed_donors, seed_ngos):
    matched = Donation(
        id="don_matched",
        donor_id="donor_001",
        food_category="PREPARED_MEALS",
        food_name="Vegetable Rice",
        quantity_kg=20,
        prepared_at=datetime.utcnow(),
        available_from=datetime.utcnow(),
        expiry_time=datetime.utcnow() + timedelta(hours=2),
        pickup_location="12.9716,77.5946",
        special_requirements="Keep chilled",
        status=DonationStatus.MATCHED,
        matched_ngo_id="ngo_001",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    not_matched = Donation(
        id="don_available",
        donor_id="donor_001",
        food_category="PREPARED_MEALS",
        food_name="Unmatched food",
        quantity_kg=5,
        prepared_at=datetime.utcnow(),
        available_from=datetime.utcnow(),
        expiry_time=datetime.utcnow() + timedelta(hours=2),
        pickup_location="12.9716,77.5946",
        special_requirements=None,
        status=DonationStatus.AVAILABLE,
        matched_ngo_id="ngo_001",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db_session.add_all([matched, not_matched])
    await db_session.commit()

    response = await ngo_client.get("/api/v1/ngos/ngo_001/incoming")

    assert response.status_code == 200
    offers = response.json()["data"]
    assert [offer["id"] for offer in offers] == ["don_matched"]
    assert offers[0]["status"] == "MATCHED"
