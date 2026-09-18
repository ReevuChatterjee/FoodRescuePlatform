"""
Admin API router.

PATCH /api/v1/admin/ngos/{id}/verify — NGO verification workflow
Consumed by Person 3's NGO UI (sees verification status updates via WebSocket).
Per Section C: state machine PENDING → APPROVED/REJECTED.
"""

from app.core.time import ist_now
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import uuid4

from app.auth.dependencies import require_admin
from app.core.database import get_db
from app.models import NGO, NGOVerificationStatus, AuditLog
from app.models.user import User
import json
from datetime import datetime

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class VerifyNGORequest(BaseModel):
    status: str  # "APPROVED" or "REJECTED"
    reason: str  # required regardless of status chosen


def _envelope(data: dict) -> dict:
    return {"data": data, "meta": {"request_id": str(uuid4())}}


def _error_envelope(code: str, message: str, field: str | None = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "field": field,
            "request_id": str(uuid4()),
        }
    }


@router.patch("/ngos/{ngo_id}/verify")
async def verify_ngo(
    ngo_id: Annotated[str, Path()],
    body: VerifyNGORequest,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Verify or reject an NGO's registration.

    State machine:
      PENDING → APPROVED (gates matching eligibility)
      PENDING → REJECTED (NGO excluded from candidate pool)
      REJECTED → PENDING (if NGO resubmits documents — re-verify from scratch)

    Matching candidate filter (Person 4) must only ever consider verification_status = APPROVED.
    This is enforced upstream in Person 4's code, not here.

    Request body:
      - status: "APPROVED" or "REJECTED" (case-sensitive)
      - reason: free text, required

    Returns:
      - ngo_id
      - verification_status (new value)
      - reason (from request)
      - verified_by (admin user_id)
      - verified_at (timestamp)
    """
    # Validate status
    if body.status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(
            status_code=400,
            detail=_error_envelope(
                "INVALID_STATUS",
                f"status must be APPROVED or REJECTED, got {body.status}",
                "status",
            ),
        )

    # Fetch NGO
    result = await db.execute(select(NGO).where(NGO.id == ngo_id))
    ngo = result.scalar_one_or_none()
    if not ngo:
        raise HTTPException(
            status_code=404,
            detail=_error_envelope("NGO_NOT_FOUND", f"NGO {ngo_id} not found", None),
        )

    # Update verification status
    old_status = ngo.verification_status
    ngo.verification_status = NGOVerificationStatus[body.status]
    verified_at = ist_now()

    # Write audit log
    audit_entry = AuditLog(
        entity_type="ngo",
        entity_id=ngo_id,
        event_type="verification_status_changed",
        payload={
            "old_status": old_status.value if old_status else None,
            "new_status": body.status,
            "reason": body.reason,
            "verified_by": admin.id,
            "verified_at": verified_at.isoformat(),
        },
        record_hash="",  # compute hash in production (SHA256 of payload + previous_hash)
        previous_hash=None,
    )
    db.add(audit_entry)

    await db.commit()
    await db.refresh(ngo)

    # TODO: emit WebSocket event to /ws/ngos for Person 3's UI to update live

    return _envelope({
        "ngo_id": ngo.id,
        "verification_status": ngo.verification_status.value,
        "reason": body.reason,
        "verified_by": admin.id,
        "verified_at": verified_at.isoformat() + "Z",
    })
