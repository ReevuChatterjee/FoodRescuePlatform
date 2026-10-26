from __future__ import annotations
"""
Matching router — Person 4 endpoints, wired to Person 1 backend.

Implements the three endpoints per the frozen API contract (§4):

  GET  /api/v1/matching/{donation_id}/candidates
        Returns ranked NGO candidates for a donation. Consumed by Person 3
        (NGO offer screen) and used to trigger the MATCHING state transition.

  POST /api/v1/matching/{donation_id}/accept
        NGO claims the top-ranked donation. Row-level lock prevents double-accept.
        Transitions donation → ACCEPTED, sets matched_ngo_id / match_score /
        weights_version_id.

  POST /api/v1/matching/{donation_id}/reject
        NGO declines. Logs the rejection, re-runs matching with accumulated
        excluded set. Sets donation → NO_MATCH_FOUND when no candidates remain.

Auth summary (per contract):
  GET /candidates  — DONOR (own) | NGO | ADMIN
  POST /accept     — NGO (self) | ADMIN
  POST /reject     — NGO (self) | ADMIN
"""
from app.core.time import IST
from app.core.time import ist_now

from datetime import datetime, timezone
from typing import Annotated
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.dispatch.service import run_dispatch  # Person 5: dispatch hook
from app.core.envelope import api_error, envelope, iso_z
from app.matching.schemas import AcceptMatchRequest, RejectMatchRequest
from app.matching_engine import match, rematch, serialize_matching_result
from app.models import (
    AuditLog,
    Donation as OrmDonation,
    DonationRejection as OrmDonationRejection,
    DonationStatus,
    NGO as OrmNGO,
    NGOVerificationStatus,
    User,
    UserRole,
)
from app.services.matching_service import (
    get_excluded_ngo_ids,
    load_active_ngos,
    load_active_weights,
    load_donation,
    load_routes,
)
from app.ws.manager import manager

router = APIRouter(prefix="/api/v1/matching", tags=["matching"])


# ─── helpers ────────────────────────────────────────────────────────────────

async def _get_ngo_profile_for_user(user: User, db: AsyncSession) -> OrmNGO | None:
    """Return the NGO profile owned by this user, or None."""
    if user.role != UserRole.NGO:
        return None
    result = await db.execute(select(OrmNGO).where(OrmNGO.user_id == user.id))
    return result.scalar_one_or_none()


def _require_roles(user: User, *roles: UserRole) -> None:
    if user.role not in roles:
        raise api_error(403, "FORBIDDEN", "You are not authorized to perform this action.")


# ─── GET /api/v1/matching/{donation_id}/candidates ───────────────────────────

@router.get("/{donation_id}/candidates")
async def get_candidates(
    donation_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return ranked NGO candidates for a donation.

    Response body matches the frozen contract exactly:
      {
        "data": {
          "donation_id": "...",
          "weights_version_id": "...",
          "matches": [
            {
              "ngo_id": "...",
              "score": 0.801,
              "capacity_score": ..., "shelf_life_score": ...,
              "transit_score": ..., "demand_score": ..., "route_score": ...,
              "eta_minutes": 18
            },
            ...
          ]
        }
      }

    When matches == [] the donation transitions to NO_MATCH_FOUND.
    """
    _require_roles(user, UserRole.DONOR, UserRole.NGO, UserRole.ADMIN)

    # Load and validate donation
    donation = await load_donation(donation_id, db)
    if donation is None:
        raise api_error(404, "DONATION_NOT_FOUND", f"Donation {donation_id} not found.")

    # Authorization: donors can only query their own donations
    if user.role == UserRole.DONOR:
        result = await db.execute(select(OrmDonation).where(OrmDonation.id == donation_id))
        orm_don = result.scalar_one_or_none()
        if orm_don is not None:
            from app.models import Donor
            donor_result = await db.execute(select(Donor).where(Donor.user_id == user.id))
            donor = donor_result.scalar_one_or_none()
            if donor is None or orm_don.donor_id != donor.id:
                raise api_error(403, "FORBIDDEN", "This donation does not belong to you.")

    # Transition donation status to MATCHING on first match call (if still AVAILABLE)
    orm_result = await db.execute(select(OrmDonation).where(OrmDonation.id == donation_id))
    orm_donation = orm_result.scalar_one_or_none()
    if orm_donation and orm_donation.status == DonationStatus.AVAILABLE:
        orm_donation.status = DonationStatus.MATCHING
        orm_donation.updated_at = ist_now()
        await db.commit()
        await manager.broadcast("donations", {
            "event": "donation.status_changed",
            "donation_id": donation_id,
            "status": DonationStatus.MATCHING.value,
        })

    # Load NGOs, routes and weights
    ngos = await load_active_ngos(db)
    routes = await load_routes(donation, ngos)
    weights = await load_active_weights(donation, db)

    # Retrieve already-excluded NGOs from previous rejections
    excluded = await get_excluded_ngo_ids(donation_id, db)

    # Run the matching algorithm
    result = match(
        donation=donation,
        ngos=ngos,
        routes=routes,
        weights=weights,
        reference_time=max(datetime.now(IST), donation.available_from),
        excluded_ngo_ids=excluded if excluded else None,
    )

    # If no candidates survive, transition to NO_MATCH_FOUND
    if not result.matches and orm_donation:
        orm_donation.status = DonationStatus.NO_MATCH_FOUND
        orm_donation.updated_at = ist_now()
        await db.commit()
        await manager.broadcast("donations", {
            "event": "donation.no_match_found",
            "donation_id": donation_id,
        })
    elif result.matches and orm_donation:
        orm_donation.status = DonationStatus.MATCHED
        orm_donation.matched_ngo_id = result.matches[0].ngo_id
        orm_donation.updated_at = ist_now()
        await db.commit()
        await manager.broadcast("donations", {
            "event": "donation.matched",
            "donation_id": donation_id,
            "ngo_id": result.matches[0].ngo_id,
        })

    return serialize_matching_result(result)


# ─── POST /api/v1/matching/{donation_id}/accept ──────────────────────────────

@router.post("/{donation_id}/accept")
async def accept_match(
    donation_id: str,
    body: AcceptMatchRequest,
    background_tasks: BackgroundTasks,  # Person 5: dispatch hook
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """NGO accepts the donation offer.

    Performs a row-level lock (SELECT FOR UPDATE) to prevent race conditions
    when two NGOs try to accept the same donation concurrently. Returns 409
    if the donation has already been accepted by another NGO.

    Transitions donation status: MATCHING | MATCHED → ACCEPTED.
    """
    _require_roles(user, UserRole.NGO, UserRole.ADMIN)

    # NGOs can only accept on behalf of their own profile
    if user.role == UserRole.NGO:
        ngo = await _get_ngo_profile_for_user(user, db)
        if ngo is None:
            raise api_error(404, "NGO_PROFILE_NOT_FOUND", "No NGO profile found for this account.")
        if ngo.id != body.ngo_id:
            raise api_error(403, "FORBIDDEN", "You can only accept donations on behalf of your own NGO.")
        if ngo.verification_status != NGOVerificationStatus.APPROVED:
            raise api_error(403, "NGO_NOT_VERIFIED", "Your NGO must be verified before accepting donations.")

    # Row-level lock to prevent double-accept
    result = await db.execute(
        select(OrmDonation)
        .where(OrmDonation.id == donation_id)
        .with_for_update()
    )
    donation = result.scalar_one_or_none()
    if donation is None:
        raise api_error(404, "DONATION_NOT_FOUND", f"Donation {donation_id} not found.")

    # Conflict: already accepted by someone else
    if donation.status == DonationStatus.ACCEPTED:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "ALREADY_ACCEPTED",
                    "message": "This donation has already been accepted by another NGO.",
                    "field": None,
                    "request_id": str(uuid.uuid4()),
                }
            },
        )

    # Only accept donations that are in a matchable state
    if donation.status not in (DonationStatus.MATCHING, DonationStatus.MATCHED, DonationStatus.AVAILABLE):
        raise api_error(
            409,
            "INVALID_STATUS",
            f"Donation cannot be accepted from status '{donation.status.value}'.",
        )

    # Resolve canonical NGO ID
    target_id = body.ngo_id or donation.matched_ngo_id
    ngo_check = await db.execute(select(OrmNGO).where(or_(OrmNGO.id == target_id, OrmNGO.user_id == target_id)))
    matched_ngo_entity = ngo_check.scalar_one_or_none()
    canonical_ngo_id = matched_ngo_entity.id if matched_ngo_entity else body.ngo_id

    # Transition
    donation.status = DonationStatus.ACCEPTED
    donation.matched_ngo_id = canonical_ngo_id
    donation.match_score = body.match_score
    donation.weights_version_id = body.weights_version_id
    donation.updated_at = ist_now()

    db.add(AuditLog(
        entity_type="donation",
        entity_id=donation.id,
        event_type="donation_accepted",
        payload={
            "ngo_id": body.ngo_id,
            "match_score": body.match_score,
            "weights_version_id": body.weights_version_id,
            "accepted_by_user": user.id,
        },
        record_hash="",
        previous_hash=None,
    ))

    await db.commit()
    await db.refresh(donation)
    # Dispatch hook — inline dispatch avoids Vercel serverless background_tasks cancellation
    try:
        from app.dispatch.service import dispatch_donation
        await dispatch_donation(db, donation.id)
        await db.refresh(donation)
    except Exception as _e:
        import logging as _log
        _log.getLogger(__name__).warning("Inline dispatch on accept failed: %s", _e)

    # Recalculate NGO dynamic available capacity and sync to database
    from app.ngos.router import compute_dynamic_ngo_capacity
    target_id = body.ngo_id or donation.matched_ngo_id
    ngo_res = await db.execute(select(OrmNGO).where(or_(OrmNGO.id == target_id, OrmNGO.user_id == target_id)))
    ngo = ngo_res.scalar_one_or_none()
    new_capacity = None
    if ngo is not None:
        new_capacity = await compute_dynamic_ngo_capacity(ngo, db, auto_sync_db=True)

    await manager.broadcast("donations", {
        "event": "donation.accepted",
        "donation_id": donation.id,
        "ngo_id": body.ngo_id,
        "status": donation.status.value,
        "quantity_kg": donation.quantity_kg,
        "available_capacity_kg": new_capacity,
    })
    await manager.broadcast("deliveries", {
        "event": "donation.accepted",
        "donation_id": donation.id,
        "ngo_id": body.ngo_id,
        "status": donation.status.value,
        "quantity_kg": donation.quantity_kg,
        "available_capacity_kg": new_capacity,
    })

    return envelope({
        "donation_id": donation.id,
        "status": donation.status.value,
        "matched_ngo_id": donation.matched_ngo_id,
        "match_score": donation.match_score,
        "weights_version_id": donation.weights_version_id,
        "available_capacity_kg": new_capacity,
        "storage_capacity_kg": ngo.storage_capacity_kg if ngo else None,
        "updated_at": iso_z(donation.updated_at),
    })


# ─── POST /api/v1/matching/{donation_id}/reject ──────────────────────────────

@router.post("/{donation_id}/reject")
async def reject_match(
    donation_id: str,
    body: RejectMatchRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """NGO rejects the donation offer.

    Records the rejection in donation_rejections, then immediately re-runs
    the matching algorithm with the updated excluded set. If no candidates
    remain, transitions the donation to NO_MATCH_FOUND. Otherwise, leaves
    the donation in MATCHING state so the next candidate can accept.

    The caller (Person 3's NGO UI) should re-poll GET /candidates after a
    reject to show the next ranked offer.
    """
    _require_roles(user, UserRole.NGO, UserRole.ADMIN)

    # NGOs can only reject on behalf of their own profile
    if user.role == UserRole.NGO:
        ngo = await _get_ngo_profile_for_user(user, db)
        if ngo is None:
            raise api_error(404, "NGO_PROFILE_NOT_FOUND", "No NGO profile found for this account.")
        if ngo.id != body.ngo_id:
            raise api_error(403, "FORBIDDEN", "You can only reject donations on behalf of your own NGO.")

    # Verify donation exists
    result = await db.execute(select(OrmDonation).where(OrmDonation.id == donation_id))
    donation = result.scalar_one_or_none()
    if donation is None:
        raise api_error(404, "DONATION_NOT_FOUND", f"Donation {donation_id} not found.")

    if donation.status not in (DonationStatus.MATCHING, DonationStatus.MATCHED, DonationStatus.AVAILABLE):
        raise api_error(
            409,
            "INVALID_STATUS",
            f"Donation cannot be rejected from status '{donation.status.value}'.",
        )

    # Record rejection
    db.add(OrmDonationRejection(
        donation_id=donation_id,
        ngo_id=body.ngo_id,
        reason=body.reason,
        rejected_at=ist_now(),
    ))
    db.add(AuditLog(
        entity_type="donation",
        entity_id=donation_id,
        event_type="donation_rejected_by_ngo",
        payload={"ngo_id": body.ngo_id, "reason": body.reason, "rejected_by_user": user.id},
        record_hash="",
        previous_hash=None,
    ))
    await db.commit()

    # Re-run matching with the now-updated excluded set
    engine_donation = await load_donation(donation_id, db)
    if engine_donation is None:
        raise api_error(500, "INTERNAL_ERROR", "Could not reload donation for rematching.")

    ngos = await load_active_ngos(db)
    routes = await load_routes(engine_donation, ngos)
    weights = await load_active_weights(engine_donation, db)
    excluded = await get_excluded_ngo_ids(donation_id, db)

    rematch_result = rematch(
        donation=engine_donation,
        ngos=ngos,
        routes=routes,
        weights=weights,
        excluded_ngo_ids=excluded,
        reference_time=max(datetime.now(IST), engine_donation.available_from),
    )

    # Recompute capacity for the rejected NGO and sync to database
    from app.ngos.router import compute_dynamic_ngo_capacity
    rejected_ngo_res = await db.execute(select(OrmNGO).where(or_(OrmNGO.id == body.ngo_id, OrmNGO.user_id == body.ngo_id)))
    rejected_ngo = rejected_ngo_res.scalar_one_or_none()
    if rejected_ngo is not None:
        await compute_dynamic_ngo_capacity(rejected_ngo, db, auto_sync_db=True)

    # Update donation status
    if not rematch_result.matches:
        donation.status = DonationStatus.NO_MATCH_FOUND
        donation.updated_at = ist_now()
        await db.commit()
        await manager.broadcast("donations", {
            "event": "donation.no_match_found",
            "donation_id": donation_id,
        })
        await manager.broadcast("deliveries", {
            "event": "donation.no_match_found",
            "donation_id": donation_id,
        })
    else:
        # Transition to MATCHED for the next candidate
        donation.status = DonationStatus.MATCHED
        donation.matched_ngo_id = rematch_result.matches[0].ngo_id
        donation.updated_at = ist_now()
        await db.commit()

        new_ngo_res = await db.execute(select(OrmNGO).where(or_(OrmNGO.id == donation.matched_ngo_id, OrmNGO.user_id == donation.matched_ngo_id)))
        new_ngo = new_ngo_res.scalar_one_or_none()
        new_ngo_cap = None
        if new_ngo:
            new_ngo_cap = await compute_dynamic_ngo_capacity(new_ngo, db, auto_sync_db=True)

        await manager.broadcast("donations", {
            "event": "donation.rematched",
            "donation_id": donation_id,
            "candidate_count": len(rematch_result.matches),
            "top_ngo_id": rematch_result.matches[0].ngo_id,
            "available_capacity_kg": new_ngo_cap,
        })
        await manager.broadcast("deliveries", {
            "event": "donation.rematched",
            "donation_id": donation_id,
            "candidate_count": len(rematch_result.matches),
            "top_ngo_id": rematch_result.matches[0].ngo_id,
            "available_capacity_kg": new_ngo_cap,
        })

    return envelope({
        "donation_id": donation_id,
        "status": donation.status.value,
        "rejected_ngo_id": body.ngo_id,
        "rematch_candidates": len(rematch_result.matches),
        "next_candidate": {
            "ngo_id": rematch_result.matches[0].ngo_id,
            "score": rematch_result.matches[0].score,
            "eta_minutes": rematch_result.matches[0].eta_minutes,
        } if rematch_result.matches else None,
    })
