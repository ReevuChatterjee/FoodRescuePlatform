"""NGO profile, capacity, category, demand, and incoming-offer APIs."""

from app.core.time import ist_now
from datetime import datetime
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_ngo
from app.core.database import get_db
from app.models import Donation, DonationStatus, NGO, NGOFoodCategory, NGODemand, NGOVerificationStatus
from app.models.user import User

router = APIRouter(prefix="/api/v1/ngos", tags=["ngos"])


def envelope(data: object) -> dict:
    return {"data": data, "meta": {"request_id": str(uuid4())}}


def ngo_response(ngo: NGO) -> dict:
    return {
        "id": ngo.id,
        "organisation_name": ngo.organisation_name,
        "address": ngo.address,
        "location": ngo.location,
        "storage_capacity_kg": ngo.storage_capacity_kg,
        "available_capacity_kg": ngo.available_capacity_kg,
        "operating_start": ngo.operating_start,
        "operating_end": ngo.operating_end,
        "verification_status": ngo.verification_status.value,
        "created_at": ngo.created_at.isoformat() + "Z",
    }


class NGOProfileRequest(BaseModel):
    organisation_name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1)
    location: str = Field(min_length=1, max_length=200)
    storage_capacity_kg: float = Field(ge=0)
    available_capacity_kg: float = Field(ge=0)
    operating_start: str = Field(min_length=1, max_length=10)
    operating_end: str = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def capacity_is_valid(self):
        if self.available_capacity_kg > self.storage_capacity_kg:
            raise ValueError("available_capacity_kg cannot exceed storage_capacity_kg")
        return self


class CapacityRequest(BaseModel):
    available_capacity_kg: float = Field(ge=0)


class CategoryRequest(BaseModel):
    categories: list[str] = Field(default_factory=list)


class DemandRequest(BaseModel):
    food_category: str = Field(min_length=1, max_length=50)
    required_quantity_kg: float = Field(gt=0)
    priority: str = Field(pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    valid_until: datetime


async def owned_ngo(ngo_id: str, user: User, db: AsyncSession) -> NGO:
    result = await db.execute(select(NGO).where(NGO.id == ngo_id))
    ngo = result.scalar_one_or_none()
    if not ngo:
        raise HTTPException(404, "NGO not found")
    if ngo.user_id != user.id:
        raise HTTPException(403, "You can only manage your own NGO profile")
    return ngo


@router.post("", status_code=201)
async def create_ngo(
    body: NGOProfileRequest,
    user: Annotated[User, Depends(require_ngo)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    existing = await db.execute(select(NGO).where(NGO.user_id == user.id))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "An NGO profile already exists for this user")
    ngo = NGO(id=f"ngo_{uuid4().hex[:12]}", user_id=user.id, verification_status=NGOVerificationStatus.PENDING, **body.model_dump())
    db.add(ngo)
    await db.commit()
    await db.refresh(ngo)
    return envelope(ngo_response(ngo))


@router.get("")
async def list_ngos(
    user: Annotated[User, Depends(require_ngo)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    statement = select(NGO).where(NGO.user_id == user.id)
    result = await db.execute(statement.order_by(NGO.created_at.desc()))
    return envelope([ngo_response(ngo) for ngo in result.scalars().all()])


@router.get("/{ngo_id}")
async def get_ngo(
    ngo_id: str,
    user: Annotated[User, Depends(require_ngo)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ngo = await owned_ngo(ngo_id, user, db)
    return envelope(ngo_response(ngo))


@router.patch("/{ngo_id}")
async def update_ngo(ngo_id: str, body: NGOProfileRequest, user: Annotated[User, Depends(require_ngo)], db: Annotated[AsyncSession, Depends(get_db)]):
    ngo = await owned_ngo(ngo_id, user, db)
    for field, value in body.model_dump().items():
        setattr(ngo, field, value)
    await db.commit()
    await db.refresh(ngo)
    return envelope(ngo_response(ngo))


@router.patch("/{ngo_id}/capacity")
async def update_capacity(ngo_id: str, body: CapacityRequest, user: Annotated[User, Depends(require_ngo)], db: Annotated[AsyncSession, Depends(get_db)]):
    ngo = await owned_ngo(ngo_id, user, db)
    if body.available_capacity_kg > ngo.storage_capacity_kg:
        raise HTTPException(422, "available_capacity_kg cannot exceed storage_capacity_kg")
    ngo.available_capacity_kg = body.available_capacity_kg
    await db.commit()
    return envelope(ngo_response(ngo))


@router.get("/{ngo_id}/categories")
async def get_categories(ngo_id: str, user: Annotated[User, Depends(require_ngo)], db: Annotated[AsyncSession, Depends(get_db)]):
    await owned_ngo(ngo_id, user, db)
    result = await db.execute(select(NGOFoodCategory).where(NGOFoodCategory.ngo_id == ngo_id, NGOFoodCategory.accepted.is_(True)))
    return envelope([row.food_category for row in result.scalars().all()])


@router.put("/{ngo_id}/categories")
async def replace_categories(ngo_id: str, body: CategoryRequest, user: Annotated[User, Depends(require_ngo)], db: Annotated[AsyncSession, Depends(get_db)]):
    await owned_ngo(ngo_id, user, db)
    categories = sorted(set(category.strip().upper() for category in body.categories if category.strip()))
    result = await db.execute(select(NGOFoodCategory).where(NGOFoodCategory.ngo_id == ngo_id))
    rows = result.scalars().all()
    for row in rows:
        row.accepted = row.food_category in categories
    existing = {row.food_category for row in rows}
    for category in categories:
        if category not in existing:
            db.add(NGOFoodCategory(ngo_id=ngo_id, food_category=category, accepted=True))
    await db.commit()
    return envelope(categories)


@router.get("/{ngo_id}/demand")
async def get_demands(ngo_id: str, user: Annotated[User, Depends(require_ngo)], db: Annotated[AsyncSession, Depends(get_db)]):
    await owned_ngo(ngo_id, user, db)
    result = await db.execute(select(NGODemand).where(NGODemand.ngo_id == ngo_id).order_by(NGODemand.updated_at.desc()))
    return envelope([demand_response(row) for row in result.scalars().all()])


def demand_response(demand: NGODemand) -> dict:
    return {"id": demand.id, "food_category": demand.food_category, "required_quantity_kg": demand.required_quantity_kg, "priority": demand.priority, "valid_until": demand.valid_until.isoformat() + "Z", "updated_at": demand.updated_at.isoformat() + "Z"}


@router.post("/{ngo_id}/demand", status_code=201)
async def create_demand(ngo_id: str, body: DemandRequest, user: Annotated[User, Depends(require_ngo)], db: Annotated[AsyncSession, Depends(get_db)]):
    await owned_ngo(ngo_id, user, db)
    demand = NGODemand(ngo_id=ngo_id, **body.model_dump(), updated_at=ist_now())
    db.add(demand)
    await db.commit()
    await db.refresh(demand)
    return envelope(demand_response(demand))


@router.patch("/{ngo_id}/demand/{demand_id}")
async def update_demand(ngo_id: str, demand_id: int, body: DemandRequest, user: Annotated[User, Depends(require_ngo)], db: Annotated[AsyncSession, Depends(get_db)]):
    await owned_ngo(ngo_id, user, db)
    demand = (await db.execute(select(NGODemand).where(NGODemand.id == demand_id, NGODemand.ngo_id == ngo_id))).scalar_one_or_none()
    if not demand:
        raise HTTPException(404, "Demand not found")
    for field, value in body.model_dump().items():
        setattr(demand, field, value)
    demand.updated_at = ist_now()
    await db.commit()
    return envelope(demand_response(demand))


@router.delete("/{ngo_id}/demand/{demand_id}", status_code=204)
async def delete_demand(ngo_id: str, demand_id: int, user: Annotated[User, Depends(require_ngo)], db: Annotated[AsyncSession, Depends(get_db)]):
    await owned_ngo(ngo_id, user, db)
    demand = (await db.execute(select(NGODemand).where(NGODemand.id == demand_id, NGODemand.ngo_id == ngo_id))).scalar_one_or_none()
    if not demand:
        raise HTTPException(404, "Demand not found")
    await db.delete(demand)
    await db.commit()


@router.get("/{ngo_id}/incoming")
async def incoming_donations(ngo_id: str, user: Annotated[User, Depends(require_ngo)], db: Annotated[AsyncSession, Depends(get_db)]):
    await owned_ngo(ngo_id, user, db)
    result = await db.execute(select(Donation).where(Donation.matched_ngo_id == ngo_id, Donation.status == DonationStatus.MATCHED).order_by(Donation.expiry_time))
    return envelope([{"id": d.id, "food_name": d.food_name, "food_category": d.food_category, "quantity_kg": d.quantity_kg, "available_from": d.available_from.isoformat() + "Z", "expiry_time": d.expiry_time.isoformat() + "Z", "pickup_location": d.pickup_location, "special_requirements": d.special_requirements, "status": d.status.value} for d in result.scalars().all()])
