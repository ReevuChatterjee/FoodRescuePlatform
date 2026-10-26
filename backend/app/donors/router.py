from __future__ import annotations
"""
Donors router — Admin & Donor APIs for viewing registered commercial donors,
aggregating rescue volumes, and updating verification status.
"""
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin
from app.core.database import get_db
from app.core.envelope import api_error, envelope, iso_z
from app.models import Donation, DonationStatus, Donor, User
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/donors", tags=["donors"])


class VerifyDonorRequest(BaseModel):
    status: str  # "VERIFIED", "PENDING", "REJECTED"


@router.get("")
async def list_donors(
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    category: str | None = Query(None),
    status: str | None = Query(None),
):
    """List all registered donors with aggregated donation metrics."""
    query = select(Donor, User).outerjoin(User, Donor.user_id == User.id).order_by(Donor.created_at.desc())
    if category:
        query = query.where(Donor.daily_waste_category == category)
    if status:
        query = query.where(Donor.verification_status == status)

    result = await db.execute(query)
    rows = result.all()

    active_statuses = [
        DonationStatus.AVAILABLE,
        DonationStatus.MATCHING,
        DonationStatus.MATCHED,
        DonationStatus.ACCEPTED,
        DonationStatus.DRIVER_ASSIGNED,
        DonationStatus.PICKUP_STARTED,
        DonationStatus.PICKED_UP,
        DonationStatus.IN_TRANSIT,
    ]

    data = []
    for donor, user in rows:
        # Aggregate donation metrics for this donor
        metrics_res = await db.execute(
            select(
                func.count(Donation.id).label("total_count"),
                func.coalesce(func.sum(Donation.quantity_kg), 0.0).label("total_kg"),
                func.coalesce(
                    func.sum(
                        func.case(
                            (Donation.status.in_(active_statuses), 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("active_count"),
            ).where(Donation.donor_id == donor.id)
        )
        total_count, total_kg, active_count = metrics_res.one()

        data.append({
            "id": donor.id,
            "donor_id": donor.id,
            "user_id": donor.user_id,
            "organisation_name": donor.organisation_name,
            "address": donor.address,
            "location": donor.location,
            "contact_person": donor.contact_person,
            "email": user.email if user else None,
            "phone": user.phone if user else None,
            "name": user.name if user else None,
            "verification_status": donor.verification_status or "VERIFIED",
            "daily_waste_category": donor.daily_waste_category or "PRODUCE",
            "total_donations": int(total_count or 0),
            "total_donated_kg": round(float(total_kg or 0.0), 1),
            "active_donations": int(active_count or 0),
            "created_at": iso_z(donor.created_at),
        })

    return envelope(data)


@router.get("/{donor_id}")
async def get_donor(
    donor_id: str,
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get single donor details including their recent donations."""
    result = await db.execute(
        select(Donor, User).outerjoin(User, Donor.user_id == User.id).where(Donor.id == donor_id)
    )
    row = result.first()
    if not row:
        raise api_error(404, "DONOR_NOT_FOUND", f"Donor {donor_id} not found.")

    donor, user = row

    donations_res = await db.execute(
        select(Donation).where(Donation.donor_id == donor.id).order_by(Donation.created_at.desc()).limit(10)
    )
    recent_donations = [
        {
            "id": d.id,
            "food_name": d.food_name,
            "food_category": d.food_category,
            "quantity_kg": round(d.quantity_kg, 1),
            "status": d.status.value,
            "created_at": iso_z(d.created_at),
        }
        for d in donations_res.scalars().all()
    ]

    metrics_res = await db.execute(
        select(
            func.count(Donation.id).label("total_count"),
            func.coalesce(func.sum(Donation.quantity_kg), 0.0).label("total_kg"),
        ).where(Donation.donor_id == donor.id)
    )
    total_count, total_kg = metrics_res.one()

    return envelope({
        "id": donor.id,
        "user_id": donor.user_id,
        "organisation_name": donor.organisation_name,
        "address": donor.address,
        "location": donor.location,
        "contact_person": donor.contact_person,
        "email": user.email if user else None,
        "phone": user.phone if user else None,
        "verification_status": donor.verification_status or "VERIFIED",
        "daily_waste_category": donor.daily_waste_category or "PRODUCE",
        "total_donations": int(total_count or 0),
        "total_donated_kg": round(float(total_kg or 0.0), 1),
        "recent_donations": recent_donations,
        "created_at": iso_z(donor.created_at),
    })


@router.patch("/{donor_id}/verify")
async def verify_donor(
    donor_id: str,
    body: VerifyDonorRequest,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Admin endpoint to update donor verification status."""
    donor = await db.get(Donor, donor_id)
    if not donor:
        raise api_error(404, "DONOR_NOT_FOUND", f"Donor {donor_id} not found.")

    donor.verification_status = body.status
    await db.commit()
    await db.refresh(donor)
    return envelope({
        "donor_id": donor.id,
        "verification_status": donor.verification_status,
    })
