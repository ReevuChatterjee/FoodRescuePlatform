"""
NGOs router — the demand side of the contract. Person 1 owns this backend
surface; Person 3's NGO UI writes capacity/demand through it, Person 4 reads
it for scoring, Person 6 reads it for verification. See §4.

GET   /api/v1/ngos/{id}            — profile
PATCH /api/v1/ngos/{id}            — profile fields (address, hours, categories)
PATCH /api/v1/ngos/{id}/demand     — upsert current demand (Person 4 input D)
PATCH /api/v1/ngos/{id}/capacity   — update available capacity (hard-constraint input)
GET   /api/v1/ngos/{id}/incoming   — donations currently offered to this NGO
"""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db
from app.core.envelope import api_error, envelope, iso_z
from app.models import (
    NGO,
    Donation,
    DonationStatus,
    NGODemand,
    NGOFoodCategory,
    User,
    UserRole,
)
from app.ngos.schemas import UpdateCapacityRequest, UpdateDemandRequest, UpdateNGOProfileRequest

router = APIRouter(prefix="/api/v1/ngos", tags=["ngos"])


async def _get_ngo_or_404(ngo_id: str, db: AsyncSession) -> NGO:
    result = await db.execute(select(NGO).where(NGO.id == ngo_id))
    ngo = result.scalar_one_or_none()
    if ngo is None:
        raise api_error(404, "NGO_NOT_FOUND", f"NGO {ngo_id} not found.")
    return ngo


def _require_self_or_admin(user: User, ngo: NGO) -> None:
    if user.role == UserRole.ADMIN:
        return
    if user.role == UserRole.NGO and user.id == ngo.user_id:
        return
    raise api_error(403, "FORBIDDEN", "This account cannot modify this NGO.")


async def _to_dict(ngo: NGO, db: AsyncSession) -> dict:
    categories = await db.execute(
        select(NGOFoodCategory.food_category).where(NGOFoodCategory.ngo_id == ngo.id, NGOFoodCategory.accepted == True)  # noqa: E712
    )
    demand_rows = await db.execute(
        select(NGODemand).where(NGODemand.ngo_id == ngo.id).order_by(NGODemand.updated_at.desc())
    )

    lat, lng = None, None
    if ngo.location and "," in ngo.location:
        lat_str, lng_str = ngo.location.split(",", 1)
        try:
            lat, lng = float(lat_str), float(lng_str)
        except ValueError:
            pass

    return {
        "id": ngo.id,
        "ngo_id": ngo.id,
        "organisation_name": ngo.organisation_name,
        "address": ngo.address,
        "location": {"latitude": lat, "longitude": lng},
        "storage_capacity_kg": round(ngo.storage_capacity_kg, 1),
        "available_capacity_kg": round(ngo.available_capacity_kg, 1),
        "operating_hours": {"start": ngo.operating_start, "end": ngo.operating_end},
        "accepted_categories": [c for c in categories.scalars().all()],
        "is_verified": ngo.verification_status.value == "APPROVED",
        "verification_status": ngo.verification_status.value,
        "demand": [
            {
                "food_category": d.food_category,
                "required_quantity_kg": round(d.required_quantity_kg, 1),
                "priority": d.priority,
                "valid_until": iso_z(d.valid_until),
            }
            for d in demand_rows.scalars().all()
        ],
        "created_at": iso_z(ngo.created_at),
    }


@router.get("")
async def list_ngos(
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    verification_status: str | None = None,
):
    from app.models import NGOVerificationStatus
    query = select(NGO)
    
    if verification_status:
        try:
            status_enum = NGOVerificationStatus[verification_status]
            query = query.where(NGO.verification_status == status_enum)
        except KeyError:
            raise api_error(400, "INVALID_STATUS", f"Invalid verification_status: {verification_status}")

    query = query.order_by(NGO.created_at.desc())
    result = await db.execute(query)
    ngos = result.scalars().all()
    
    # N+1 query but acceptable for MVP
    data = []
    for ngo in ngos:
        data.append(await _to_dict(ngo, db))
        
    return envelope(data)


@router.get("/{ngo_id}")
async def get_ngo(
    ngo_id: str,
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ngo = await _get_ngo_or_404(ngo_id, db)
    return envelope(await _to_dict(ngo, db))


@router.patch("/{ngo_id}")
async def update_ngo(
    ngo_id: str,
    body: UpdateNGOProfileRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ngo = await _get_ngo_or_404(ngo_id, db)
    _require_self_or_admin(user, ngo)

    if body.organisation_name is not None:
        ngo.organisation_name = body.organisation_name
    if body.address is not None:
        ngo.address = body.address
    if body.latitude is not None and body.longitude is not None:
        ngo.location = f"{body.latitude},{body.longitude}"
    if body.operating_start is not None:
        ngo.operating_start = body.operating_start
    if body.operating_end is not None:
        ngo.operating_end = body.operating_end

    if body.accepted_categories is not None:
        await db.execute(delete(NGOFoodCategory).where(NGOFoodCategory.ngo_id == ngo.id))
        for category in body.accepted_categories:
            db.add(NGOFoodCategory(ngo_id=ngo.id, food_category=category, accepted=True))

    await db.commit()
    await db.refresh(ngo)
    return envelope(await _to_dict(ngo, db))


@router.patch("/{ngo_id}/demand")
async def update_demand(
    ngo_id: str,
    body: UpdateDemandRequest,
    ngo_user: Annotated[User, Depends(require_role("NGO", "ADMIN"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ngo = await _get_ngo_or_404(ngo_id, db)
    _require_self_or_admin(ngo_user, ngo)

    db.add(NGODemand(
        ngo_id=ngo.id,
        food_category=body.food_category,
        required_quantity_kg=body.required_quantity_kg,
        priority=body.priority,
        valid_until=body.valid_until,
        updated_at=datetime.utcnow(),
    ))
    await db.commit()

    return envelope({
        "ngo_id": ngo.id,
        "food_category": body.food_category,
        "required_quantity_kg": round(body.required_quantity_kg, 1),
        "priority": body.priority,
        "valid_until": iso_z(body.valid_until),
    })


@router.patch("/{ngo_id}/capacity")
async def update_capacity(
    ngo_id: str,
    body: UpdateCapacityRequest,
    ngo_user: Annotated[User, Depends(require_role("NGO", "ADMIN"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ngo = await _get_ngo_or_404(ngo_id, db)
    _require_self_or_admin(ngo_user, ngo)

    if body.available_capacity_kg > ngo.storage_capacity_kg:
        raise api_error(
            400, "CAPACITY_EXCEEDS_STORAGE",
            "available_capacity_kg cannot exceed storage_capacity_kg.",
            "available_capacity_kg",
        )

    ngo.available_capacity_kg = body.available_capacity_kg
    await db.commit()

    return envelope({"ngo_id": ngo.id, "available_capacity_kg": round(ngo.available_capacity_kg, 1)})


@router.get("/{ngo_id}/incoming")
async def incoming_offers(
    ngo_id: str,
    ngo_user: Annotated[User, Depends(require_role("NGO", "ADMIN"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Donations currently matched to this NGO awaiting accept/reject.

    eta_minutes / distance_km / remaining_shelf_life_min are only meaningful
    once Person 4's matching engine has populated match_score, and Person 5's
    routing has produced a route — until then this returns the matched set
    with those fields null rather than fabricating numbers.
    """
    ngo = await _get_ngo_or_404(ngo_id, db)
    _require_self_or_admin(ngo_user, ngo)

    result = await db.execute(
        select(Donation).where(
            Donation.matched_ngo_id == ngo.id,
            Donation.status.in_([DonationStatus.MATCHED, DonationStatus.MATCHING]),
        ).order_by(Donation.created_at.desc())
    )
    donations = result.scalars().all()

    now = datetime.utcnow()
    data = [
        {
            "donation_id": d.id,
            "food_category": d.food_category,
            "food_name": d.food_name,
            "quantity_kg": round(d.quantity_kg, 1),
            "match_score": d.match_score,
            "eta_minutes": None,  # populated once Person 5's route exists
            "distance_km": None,
            "remaining_shelf_life_min": max(0, int((d.expiry_time - now).total_seconds() // 60)),
        }
        for d in donations
    ]
    return envelope(data)
