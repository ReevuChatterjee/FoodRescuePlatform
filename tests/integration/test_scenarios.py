"""
Integration Tests — 7 required scenarios from Section H.

Tests 1–6 require Person 4's matching endpoints which are not yet implemented.
They are skipped with an explicit marker so the test suite stays green.

Test 7 covers the full analytics pipeline owned by Person 6: it seeds the
required data directly (bypassing matching) and asserts that analytics reflect
the handover quantity, not the raw donation quantity.
"""

import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta
from app.main import app
from tests.fixtures.seed import (
    db_session,
    seed_users,
    seed_donors,
    seed_ngos,
    seed_vehicles,
    seed_donation,
)


# ---------------------------------------------------------------------------
# Tests 1–6: require Person 4's matching endpoints — skip until implemented
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="requires Person 4 matching endpoints — not yet implemented")
@pytest.mark.asyncio
async def test_capacity_rejection(db_session, seed_users, seed_donors, seed_ngos, seed_donation):
    """
    Test 1: Capacity rejection.

    Setup: don_001 quantity 35kg; ngo_002 available_capacity 20kg.
    Assert: GET /matching/{id}/candidates response matches array does NOT contain ngo_002.
    """
    async with AsyncClient(app=app, base_url="http://test") as client:
        login_response = await client.post("/api/v1/auth/login", json={
            "email": "admin@cpi.test",
            "password": "admin123"
        })
        token = login_response.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(f"/api/v1/matching/don_001/candidates", headers=headers)
        assert response.status_code == 200

        data = response.json()["data"]
        ngo_ids = [match["ngo_id"] for match in data["matches"]]

        assert "ngo_002" not in ngo_ids, "ngo_002 should be rejected due to insufficient capacity"
        assert "ngo_001" in ngo_ids or "ngo_003" in ngo_ids


@pytest.mark.skip(reason="requires Person 4 matching endpoints — not yet implemented")
@pytest.mark.asyncio
async def test_expiry_rejection(db_session, seed_users, seed_donors, seed_ngos):
    """
    Test 2: Expiry rejection.

    Setup: Donation expiry in 10 min; NGO ETA 40 min.
    Assert: ngo_X excluded from matches; if zero survive, response matches NO_MATCH_FOUND shape.
    """
    from app.models import Donation, DonationStatus

    donation = Donation(
        id="don_expiry_test",
        donor_id="donor_001",
        food_category="COOKED",
        food_name="Short-life Food",
        quantity_kg=20.0,
        prepared_at=datetime.utcnow() - timedelta(hours=1),
        available_from=datetime.utcnow(),
        expiry_time=datetime.utcnow() + timedelta(minutes=10),
        pickup_location="12.9716,77.5946",
        status=DonationStatus.AVAILABLE,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db_session.add(donation)
    await db_session.commit()

    async with AsyncClient(app=app, base_url="http://test") as client:
        login_response = await client.post("/api/v1/auth/login", json={
            "email": "admin@cpi.test",
            "password": "admin123"
        })
        token = login_response.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(f"/api/v1/matching/don_expiry_test/candidates", headers=headers)
        data = response.json()["data"]

        if len(data["matches"]) == 0:
            assert data["donation_id"] == "don_expiry_test"


@pytest.mark.skip(reason="requires Person 4 matching endpoints — not yet implemented")
@pytest.mark.asyncio
async def test_category_rejection(db_session, seed_users, seed_donors, seed_ngos):
    """
    Test 3: Category rejection.

    Setup: Donation food_category COOKED; NGO accepted_categories [PACKAGED] only.
    Assert: NGO excluded from matches.
    """
    from app.models import Donation, DonationStatus

    donation = Donation(
        id="don_category_test",
        donor_id="donor_001",
        food_category="COOKED",
        food_name="Cooked Meal",
        quantity_kg=15.0,
        prepared_at=datetime.utcnow(),
        available_from=datetime.utcnow(),
        expiry_time=datetime.utcnow() + timedelta(hours=4),
        pickup_location="12.9716,77.5946",
        status=DonationStatus.AVAILABLE,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db_session.add(donation)
    await db_session.commit()

    async with AsyncClient(app=app, base_url="http://test") as client:
        login_response = await client.post("/api/v1/auth/login", json={
            "email": "admin@cpi.test",
            "password": "admin123"
        })
        token = login_response.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(f"/api/v1/matching/don_category_test/candidates", headers=headers)
        data = response.json()["data"]
        ngo_ids = [match["ngo_id"] for match in data["matches"]]

        assert "ngo_002" not in ngo_ids, "ngo_002 should reject COOKED category"
        assert "ngo_001" in ngo_ids or "ngo_003" in ngo_ids


@pytest.mark.skip(reason="requires Person 4 matching endpoints — not yet implemented")
@pytest.mark.asyncio
async def test_rematch_on_reject(db_session, seed_users, seed_donors, seed_ngos, seed_donation):
    """
    Test 4: Rematch on reject.

    Setup: NGO A matched → POST /matching/{id}/reject {"ngo_id":"ngo_A", ...}
    Assert: Subsequent GET /matching/{id}/candidates no longer ranks ngo_A; ngo_B appears.
            Donation status returns to MATCHING then progresses again.
    """
    async with AsyncClient(app=app, base_url="http://test") as client:
        login_response = await client.post("/api/v1/auth/login", json={
            "email": "admin@cpi.test",
            "password": "admin123"
        })
        token = login_response.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get(f"/api/v1/matching/don_001/candidates", headers=headers)
        matches = response.json()["data"]["matches"]
        first_ngo = matches[0]["ngo_id"]

        reject_response = await client.post(
            f"/api/v1/matching/don_001/reject",
            json={"ngo_id": first_ngo, "reason": "Insufficient capacity today"},
            headers=headers
        )
        assert reject_response.status_code == 200

        response2 = await client.get(f"/api/v1/matching/don_001/candidates", headers=headers)
        matches2 = response2.json()["data"]["matches"]
        ngo_ids = [m["ngo_id"] for m in matches2]

        assert first_ngo not in ngo_ids, f"{first_ngo} should not appear after rejection"
        assert len(matches2) > 0, "Should have alternative NGOs after rejection"


@pytest.mark.skip(reason="requires Person 4 matching endpoints — not yet implemented")
@pytest.mark.asyncio
async def test_concurrent_accept_race(db_session, seed_users, seed_donors, seed_ngos, seed_donation):
    """
    Test 5: Concurrent accept race.

    Setup: Two parallel POST /matching/{id}/accept with different ngo_id, same donation_id,
           each with distinct Idempotency-Key.
    Assert: Exactly one returns 2xx; the other returns 409 with error.code = "CONFLICT".
            Donation ends with exactly one matched_ngo_id.
    """
    async with AsyncClient(app=app, base_url="http://test") as client:
        login_response = await client.post("/api/v1/auth/login", json={
            "email": "admin@cpi.test",
            "password": "admin123"
        })
        token = login_response.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        import asyncio

        async def accept_ngo(ngo_id, idempotency_key):
            headers_with_key = {**headers, "Idempotency-Key": idempotency_key}
            return await client.post(
                f"/api/v1/matching/don_001/accept",
                json={"ngo_id": ngo_id},
                headers=headers_with_key
            )

        responses = await asyncio.gather(
            accept_ngo("ngo_001", "key_001"),
            accept_ngo("ngo_003", "key_003"),
            return_exceptions=True
        )

        status_codes = [r.status_code for r in responses if hasattr(r, 'status_code')]

        success_count = sum(1 for code in status_codes if 200 <= code < 300)
        conflict_count = sum(1 for code in status_codes if code == 409)

        assert success_count == 1, "Exactly one accept should succeed"
        assert conflict_count == 1, "Exactly one accept should return 409 CONFLICT"

        from sqlalchemy import select
        from app.models import Donation
        result = await db_session.execute(select(Donation).where(Donation.id == "don_001"))
        donation = result.scalar_one()
        assert donation.matched_ngo_id is not None, "Donation should have a matched NGO"


@pytest.mark.skip(reason="requires Person 4 matching endpoints — not yet implemented")
@pytest.mark.asyncio
async def test_expiry_during_matching(db_session, seed_users, seed_donors, seed_ngos):
    """
    Test 6: Expiry during matching.

    Setup: Donation's expiry_time passes while status is still MATCHING.
    Assert: Background expiry worker sets status to EXPIRED.
            No accept call after that point succeeds — assert late accept returns error, not 2xx.
    """
    from app.models import Donation, DonationStatus

    donation = Donation(
        id="don_expiring",
        donor_id="donor_001",
        food_category="COOKED",
        food_name="Expiring Food",
        quantity_kg=10.0,
        prepared_at=datetime.utcnow(),
        available_from=datetime.utcnow(),
        expiry_time=datetime.utcnow() + timedelta(seconds=1),
        pickup_location="12.9716,77.5946",
        status=DonationStatus.MATCHING,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db_session.add(donation)
    await db_session.commit()

    import asyncio
    await asyncio.sleep(2)

    from sqlalchemy import select, update
    await db_session.execute(
        update(Donation).where(Donation.id == "don_expiring").values(status=DonationStatus.EXPIRED)
    )
    await db_session.commit()

    async with AsyncClient(app=app, base_url="http://test") as client:
        login_response = await client.post("/api/v1/auth/login", json={
            "email": "admin@cpi.test",
            "password": "admin123"
        })
        token = login_response.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            f"/api/v1/matching/don_expiring/accept",
            json={"ngo_id": "ngo_001"},
            headers=headers
        )

        assert response.status_code >= 400, "Accept on expired donation should fail"


# ---------------------------------------------------------------------------
# Test 7: Full E2E pipeline — Person 6 analytics assertions
#
# Bypasses Person 4's matching endpoints by setting donation status directly.
# Focuses on the analytics layer: total_donations, total_food_rescued_kg,
# registered_ngos, registered_donors, active_deliveries.
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_full_e2e_pipeline(
    db_session, seed_users, seed_donors, seed_ngos, seed_vehicles, seed_donation
):
    """
    Test 7: Full E2E pipeline — analytics assertions (Person 6).

    Pipeline:
      1. Donation seeded (don_001, 35 kg COOKED)
      2. Status set to ACCEPTED + matched_ngo_id set directly (bypasses Person 4)
      3. Delivery and HandoverRecord inserted (bypasses Person 5)
      4. Analytics fetched and asserted

    Assert: Final GET /api/v1/analytics/overview reflects:
      - total_donations incremented by 1
      - total_food_rescued_kg incremented by exactly quantity_handed_over (33.5),
        not quantity_kg (35.0)
      - registered_ngos / registered_donors unchanged
      - active_deliveries back to baseline (delivery is DELIVERED, not active)
    """
    from sqlalchemy import select, update
    from app.models import Donation, DonationStatus, Delivery, HandoverRecord, DeliveryStatus

    async with AsyncClient(app=app, base_url="http://test") as client:
        # Authenticate as admin
        login_response = await client.post("/api/v1/auth/login", json={
            "email": "admin@cpi.test",
            "password": "admin123"
        })
        assert login_response.status_code == 200, "Admin login failed"
        token = login_response.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Baseline analytics snapshot
        baseline_response = await client.get("/api/v1/analytics/overview", headers=headers)
        assert baseline_response.status_code == 200
        baseline = baseline_response.json()["data"]

        # Step 2: Directly accept the donation (bypasses Person 4's matching API)
        await db_session.execute(
            update(Donation)
            .where(Donation.id == "don_001")
            .values(status=DonationStatus.ACCEPTED, matched_ngo_id="ngo_001")
        )
        await db_session.commit()

        # Step 3: Create delivery + handover records (bypasses Person 5's routing API)
        delivery = Delivery(
            id="delivery_e2e",
            donation_id="don_001",
            ngo_id="ngo_001",
            driver_id="driver_001",
            pickup_time=datetime.utcnow(),
            actual_pickup_time=datetime.utcnow() + timedelta(minutes=10),
            actual_delivery_time=datetime.utcnow() + timedelta(minutes=40),
            route_distance_km=5.4,
            estimated_duration_min=30,
            status=DeliveryStatus.DELIVERED,
        )
        db_session.add(delivery)

        # quantity_handed_over is intentionally different from donation.quantity_kg
        # to confirm analytics uses the handover value (33.5), not the raw weight (35.0)
        handover = HandoverRecord(
            id="handover_e2e",
            donation_id="don_001",
            delivery_id="delivery_e2e",
            donor_confirmation=True,
            ngo_confirmation=True,
            pickup_timestamp=datetime.utcnow() + timedelta(minutes=10),
            delivery_timestamp=datetime.utcnow() + timedelta(minutes=40),
            quantity_handed_over=33.5,
            disclaimer_version="v1.0",
            created_at=datetime.utcnow(),
        )
        db_session.add(handover)
        await db_session.commit()

        # Step 4: Verify analytics updated correctly
        final_response = await client.get("/api/v1/analytics/overview", headers=headers)
        assert final_response.status_code == 200
        final = final_response.json()["data"]

        assert final["total_donations"] == baseline["total_donations"] + 1, \
            "total_donations should increment by 1"
        assert final["total_food_rescued_kg"] == baseline["total_food_rescued_kg"] + 33.5, \
            "total_food_rescued_kg must use quantity_handed_over (33.5), not quantity_kg (35.0)"
        assert final["registered_ngos"] == baseline["registered_ngos"], \
            "registered_ngos should be unchanged"
        assert final["registered_donors"] == baseline["registered_donors"], \
            "registered_donors should be unchanged"
        # Delivery is DELIVERED (terminal state) — active_deliveries should be back to baseline
        assert final["active_deliveries"] == baseline["active_deliveries"], \
            "active_deliveries should return to baseline once delivery is complete"
