"""
Donations router — Person 1 owns this backend surface; Person 2's donor UI is
the only client that should be POSTing to it, Person 4 reads it for matching,
Person 6 reads it for analytics. See §3 of the contract for the exact shapes.

POST   /api/v1/donations                — create (donor)
GET    /api/v1/donations                — list (donor sees own; admin sees all)
GET    /api/v1/donations/{id}           — fetch one
PATCH  /api/v1/donations/{id}           — partial update (matching engine / admin)
PATCH  /api/v1/donations/{id}/cancel    — donor cancels pre-pickup
POST   /api/v1/donations/{id}/photos    — multipart photo upload (audit trail)
"""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db
from app.core.envelope import api_error, envelope, iso_z, list_envelope
from app.core.ids import new_id
from app.dispatch.service import (  # Person 5: release the driver on cancel
    publish,
    release_for_cancelled_donation,
    run_dispatch_pending,
)
from app.donations.schemas import CancelDonationRequest, CreateDonationRequest, UpdateDonationRequest
from app.models import AuditLog, Delivery, Donation, DonationStatus, Donor, User, UserRole
from app.ws.manager import manager

router = APIRouter(prefix="/api/v1/donations", tags=["donations"])


async def _get_donor_profile(user: User, db: AsyncSession) -> Donor:
    result = await db.execute(select(Donor).where(Donor.user_id == user.id))
    donor = result.scalar_one_or_none()
    if donor is None:
        raise api_error(403, "NOT_A_DONOR", "This account has no donor profile.")
    return donor


async def _to_dict(donation: Donation, db: AsyncSession) -> dict:
    """Contract response shape per §3, with driver_id/eta_minutes pulled from
    the latest delivery record (they're not columns on Donation itself)."""
    driver_id = None
    eta_minutes = None
    result = await db.execute(
        select(Delivery).where(Delivery.donation_id == donation.id).order_by(Delivery.id.desc())
    )
    delivery = result.scalars().first()
    if delivery is not None:
        driver_id = delivery.driver_id
        if delivery.estimated_duration_min is not None:
            eta_minutes = delivery.estimated_duration_min

    return {
        "id": donation.id,
        "donor_id": donation.donor_id,
        "food_name": donation.food_name,
        "food_category": donation.food_category,
        "quantity_kg": round(donation.quantity_kg, 1),
        "prepared_at": iso_z(donation.prepared_at),
        "available_from": iso_z(donation.available_from),
        "expiry_time": iso_z(donation.expiry_time),
        "pickup_location": donation.pickup_location,
        "special_handling": donation.special_handling,
        "food_safety_info": donation.food_safety_info,
        "status": donation.status.value,
        "matched_ngo_id": donation.matched_ngo_id,
        "match_score": donation.match_score,
        "weights_version_id": donation.weights_version_id,
        "driver_id": driver_id,
        "eta_minutes": eta_minutes,
        "created_at": iso_z(donation.created_at),
        "updated_at": iso_z(donation.updated_at),
    }


@router.post("", status_code=201)
async def create_donation(
    body: CreateDonationRequest,
    donor_user: Annotated[User, Depends(require_role("DONOR"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    donor = await _get_donor_profile(donor_user, db)

    now = datetime.utcnow()
    donation = Donation(
        id=new_id("don"),
        donor_id=donor.id,
        food_category=body.food_category,
        food_name=body.food_name,
        quantity_kg=body.quantity_kg,
        prepared_at=body.prepared_at,
        available_from=body.available_from,
        expiry_time=body.expiry_time,
        pickup_location=body.pickup_location.model_dump(),
        special_handling=body.special_handling,
        food_safety_info=body.food_safety_info.model_dump() if body.food_safety_info else None,
        status=DonationStatus.AVAILABLE,
        created_at=now,
        updated_at=now,
    )
    db.add(donation)
    await db.commit()
    await db.refresh(donation)

    await manager.broadcast("donations", {
        "event": "donation.created",
        "donation_id": donation.id,
        "status": donation.status.value,
    })

    # Response is deliberately the compact dashboard shape from §3, not the full object.
    return envelope({
        "id": donation.id,
        "status": donation.status.value,
        "matched_ngo_id": None,
        "driver_id": None,
        "eta_minutes": None,
        "created_at": iso_z(donation.created_at),
    })


@router.get("")
async def list_donations(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    query = select(Donation).order_by(Donation.created_at.desc()).limit(limit + 1)

    if user.role == UserRole.DONOR:
        donor = await _get_donor_profile(user, db)
        query = query.where(Donation.donor_id == donor.id)
    elif user.role != UserRole.ADMIN:
        # NGO/driver accounts don't get a bare "all donations" list here — they
        # see donations through /ngos/{id}/incoming and their assigned deliveries.
        raise api_error(403, "FORBIDDEN", "This account cannot list all donations.")

    if status:
        query = query.where(Donation.status == status)

    result = await db.execute(query)
    rows = list(result.scalars().all())
    has_more = len(rows) > limit
    rows = rows[:limit]

    data = [await _to_dict(d, db) for d in rows]
    return list_envelope(data, has_more=has_more)


@router.get("/{donation_id}")
async def get_donation(
    donation_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Donation).where(Donation.id == donation_id))
    donation = result.scalar_one_or_none()
    if donation is None:
        raise api_error(404, "DONATION_NOT_FOUND", f"Donation {donation_id} not found.")

    if user.role == UserRole.DONOR:
        donor = await _get_donor_profile(user, db)
        if donation.donor_id != donor.id:
            raise api_error(403, "FORBIDDEN", "This donation does not belong to you.")

    return envelope(await _to_dict(donation, db))


@router.patch("/{donation_id}")
async def update_donation(
    donation_id: str,
    body: UpdateDonationRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Partial update — used by the matching engine (Person 4, setting status/
    matched_ngo_id/match_score/weights_version_id) and by admin flows. Donors
    should use PATCH /{id}/cancel, not this endpoint, to cancel."""
    if user.role not in (UserRole.ADMIN, UserRole.DONOR):
        raise api_error(403, "FORBIDDEN", "This account cannot update donations.")

    result = await db.execute(select(Donation).where(Donation.id == donation_id))
    donation = result.scalar_one_or_none()
    if donation is None:
        raise api_error(404, "DONATION_NOT_FOUND", f"Donation {donation_id} not found.")

    old_status = donation.status
    if body.status is not None:
        try:
            donation.status = DonationStatus[body.status]
        except KeyError:
            raise api_error(400, "INVALID_STATUS", f"Unknown donation status: {body.status}", "status")
    if body.matched_ngo_id is not None:
        donation.matched_ngo_id = body.matched_ngo_id
    if body.match_score is not None:
        donation.match_score = body.match_score
    if body.weights_version_id is not None:
        donation.weights_version_id = str(body.weights_version_id)

    donation.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(donation)

    if body.status is not None and donation.status != old_status:
        await manager.broadcast("donations", {
            "event": "donation.status_changed",
            "donation_id": donation.id,
            "status": donation.status.value,
        })

    return envelope(await _to_dict(donation, db))


@router.patch("/{donation_id}/cancel")
async def cancel_donation(
    donation_id: str,
    body: CancelDonationRequest,
    background_tasks: BackgroundTasks,  # Person 5: release the driver on cancel
    donor_user: Annotated[User, Depends(require_role("DONOR"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    donor = await _get_donor_profile(donor_user, db)

    result = await db.execute(select(Donation).where(Donation.id == donation_id))
    donation = result.scalar_one_or_none()
    if donation is None:
        raise api_error(404, "DONATION_NOT_FOUND", f"Donation {donation_id} not found.")
    if donation.donor_id != donor.id:
        raise api_error(403, "FORBIDDEN", "This donation does not belong to you.")
    if donation.status in (DonationStatus.PICKED_UP, DonationStatus.IN_TRANSIT, DonationStatus.DELIVERED):
        raise api_error(409, "ALREADY_IN_TRANSIT", "Cannot cancel a donation once it has been picked up.")

    # Person 5: cancel any pre-pickup delivery and free its driver (locks the
    # donation row; 409 if the driver picked up in the meantime).
    release = await release_for_cancelled_donation(db, donation.id, body.reason, donor_user.id)

    donation.status = DonationStatus.CANCELLED
    donation.updated_at = datetime.utcnow()

    db.add(AuditLog(
        entity_type="donation",
        entity_id=donation.id,
        event_type="donation_cancelled",
        payload={"reason": body.reason, "cancelled_by": donor_user.id},
        record_hash="",
        previous_hash=None,
    ))

    await db.commit()
    await db.refresh(donation)

    # So Person 4 removes it from the candidate pool if it's still mid-match.
    await manager.broadcast("donations", {
        "event": "donation.cancelled",
        "donation_id": donation.id,
        "reason": body.reason,
    })
    # Person 5: delivery/driver events after commit; a freed driver can take waiting work.
    await publish(release.events)
    if release.driver_released:
        background_tasks.add_task(run_dispatch_pending)

    return envelope(await _to_dict(donation, db))


@router.post("/{donation_id}/photos", status_code=201)
async def upload_donation_photo(
    donation_id: str,
    donor_user: Annotated[User, Depends(require_role("DONOR"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
):
    """Stub: records the upload in the audit trail Person 6 reads. Swap the
    `stored_at` placeholder for real object storage (S3/GCS/local disk) when
    that's set up — the audit record and response shape won't need to change."""
    result = await db.execute(select(Donation).where(Donation.id == donation_id))
    donation = result.scalar_one_or_none()
    if donation is None:
        raise api_error(404, "DONATION_NOT_FOUND", f"Donation {donation_id} not found.")

    stored_at = f"pending-storage/{donation_id}/{file.filename}"
    db.add(AuditLog(
        entity_type="donation",
        entity_id=donation.id,
        event_type="photo_uploaded",
        payload={"filename": file.filename, "content_type": file.content_type, "stored_at": stored_at},
        record_hash="",
        previous_hash=None,
    ))
    await db.commit()

    return envelope({"donation_id": donation.id, "filename": file.filename, "stored_at": stored_at})
