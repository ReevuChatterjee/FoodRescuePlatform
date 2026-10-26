"""
NGOs router — the demand side of the contract. Person 1 owns this backend
surface; Person 3's NGO UI writes capacity/demand through it, Person 4 reads
it for scoring, Person 6 reads it for verification. See §4.

GET   /api/v1/ngos                 — list NGOs (ADMIN, filterable by verification_status)
GET   /api/v1/ngos/{id}            — profile
PATCH /api/v1/ngos/{id}            — profile fields (address, hours, categories)
PATCH /api/v1/ngos/{id}/demand     — upsert current demand (Person 4 input D)
PATCH /api/v1/ngos/{id}/capacity   — update available capacity (hard-constraint input)
GET   /api/v1/ngos/{id}/incoming   — donations currently offered to this NGO
"""
from app.core.time import ist_now, to_naive_ist
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db
from app.core.envelope import api_error, envelope, iso_z
from app.models import (
    NGO,
    AuditLog,
    Delivery,
    DeliveryStatus,
    Donation,
    DonationStatus,
    HandoverRecord,
    NGODemand,
    NGOFoodCategory,
    NGOVerificationStatus,
    User,
    UserRole,
)
from app.ngos.schemas import CreateNGOProfileRequest, ReplaceCategoriesRequest, UpdateCapacityRequest, UpdateDemandRequest, UpdateNGOProfileRequest
from app.routing.service import offer_route_summary  # Person 5: incoming ETA/distance

router = APIRouter(prefix="/api/v1/ngos", tags=["ngos"])


async def compute_dynamic_ngo_capacity(ngo: NGO, db: AsyncSession, auto_sync_db: bool = True) -> float:
    """Dynamically calculates available capacity (in kg) from active and non-expired donations/deliveries.

    Formula:
        available_capacity = max(0.0, storage_capacity_kg - total_occupied_kg)

    Occupied food includes:
        1. Non-expired delivered or in-transit deliveries assigned to this NGO
           (using HandoverRecord.quantity_handed_over if recorded, else Donation.quantity_kg).
        2. Accepted donations matched to this NGO awaiting driver assignment.

    Terminal statuses (CANCELLED, REJECTED, EXPIRED, DRIVER_ISSUE, NO_MATCH_FOUND) and expired food
    do not occupy storage. If delivery/donation records are deleted from the database, available capacity
    immediately returns to 100% of storage_capacity_kg (0% utilized).
    """
    storage_capacity = float(ngo.storage_capacity_kg or 0.0)
    if storage_capacity <= 0:
        return 0.0

    ngo_identifiers = [ngo.id]
    if ngo.user_id and ngo.user_id != ngo.id:
        ngo_identifiers.append(ngo.user_id)

    # Also include any other NGO records for the same user
    if ngo.user_id:
        try:
            extra_ids = (await db.execute(select(NGO.id).where(NGO.user_id == ngo.user_id))).scalars().all()
            for xid in extra_ids:
                if xid not in ngo_identifiers:
                    ngo_identifiers.append(xid)
        except Exception:
            pass

    # Auto-heal: verify and restore any donation accepted by this NGO user/ID in audit logs
    try:
        audit_res = await db.execute(
            select(AuditLog.entity_id, AuditLog.payload)
            .where(
                AuditLog.entity_type == "donation",
                AuditLog.event_type == "donation_accepted",
            )
        )
        for entity_id, payload in audit_res.all():
            if isinstance(payload, dict):
                accepted_user = payload.get("accepted_by_user")
                accepted_ngo = payload.get("ngo_id")
                if (accepted_user and accepted_user == ngo.user_id) or (accepted_ngo and accepted_ngo in ngo_identifiers):
                    don_row = await db.get(Donation, entity_id)
                    if don_row:
                        changed = False
                        if don_row.matched_ngo_id not in ngo_identifiers:
                            don_row.matched_ngo_id = ngo.id
                            changed = True
                        if don_row.status == DonationStatus.EXPIRED:
                            don_row.status = DonationStatus.ACCEPTED
                            changed = True
                        if changed:
                            del_res = await db.execute(select(Delivery).where(Delivery.donation_id == entity_id))
                            for del_row in del_res.scalars().all():
                                del_row.ngo_id = ngo.id
                            await db.commit()
    except Exception:
        pass

    # 1. Deduplicated latest handover quantity per donation
    latest_handover_subquery = (
        select(
            HandoverRecord.donation_id,
            func.max(HandoverRecord.quantity_handed_over).label("quantity_handed_over")
        )
        .where(HandoverRecord.donation_id.isnot(None))
        .group_by(HandoverRecord.donation_id)
        .subquery()
    )

    # Deliveries assigned to this NGO (to link donations where matched_ngo_id might not have synced)
    delivery_donation_ids = (
        select(Delivery.donation_id).where(
            Delivery.ngo_id.in_(ngo_identifiers),
            Delivery.donation_id.isnot(None),
            Delivery.status.in_([
                DeliveryStatus.DRIVER_ASSIGNED,
                DeliveryStatus.PICKUP_STARTED,
                DeliveryStatus.PICKED_UP,
                DeliveryStatus.IN_TRANSIT,
                DeliveryStatus.DELIVERED,
                DeliveryStatus.PARTIALLY_DELIVERED,
            ])
        )
    )

    # Active and delivered statuses that occupy storage
    active_statuses = [
        DonationStatus.MATCHED,
        DonationStatus.ACCEPTED,
        DonationStatus.DRIVER_ASSIGNED,
        DonationStatus.PICKUP_STARTED,
        DonationStatus.PICKED_UP,
        DonationStatus.IN_TRANSIT,
        DonationStatus.DELIVERED,
        DonationStatus.PARTIALLY_DELIVERED,
    ]

    # 2. All donations assigned to this NGO that are active or delivered
    occupied_query = (
        select(
            func.coalesce(
                func.sum(
                    func.coalesce(
                        latest_handover_subquery.c.quantity_handed_over,
                        Donation.quantity_kg
                    )
                ),
                0.0
            )
        )
        .select_from(Donation)
        .outerjoin(latest_handover_subquery, latest_handover_subquery.c.donation_id == Donation.id)
        .where(
            or_(
                Donation.matched_ngo_id.in_(ngo_identifiers),
                Donation.id.in_(delivery_donation_ids)
            ),
            Donation.status.in_(active_statuses)
        )
    )

    total_occupied = float((await db.execute(occupied_query)).scalar_one() or 0.0)
    available_kg = max(0.0, round(storage_capacity - total_occupied, 1))

    # Sync back to NGO row so any external consumers or direct SQL queries remain accurate
    if auto_sync_db and abs((ngo.available_capacity_kg or 0.0) - available_kg) > 0.001:
        ngo.available_capacity_kg = available_kg
        try:
            await db.commit()
            from app.ws.manager import manager
            await manager.broadcast("donations", {
                "event": "ngo.capacity_updated",
                "ngo_id": ngo.id,
                "storage_capacity_kg": storage_capacity,
                "available_capacity_kg": available_kg,
            })
            await manager.broadcast("deliveries", {
                "event": "ngo.capacity_updated",
                "ngo_id": ngo.id,
                "storage_capacity_kg": storage_capacity,
                "available_capacity_kg": available_kg,
            })
        except Exception:
            await db.rollback()

    return available_kg


async def _get_ngo_or_404(ngo_id: str, db: AsyncSession) -> NGO:
    result = await db.execute(select(NGO).where(or_(NGO.id == ngo_id, NGO.user_id == ngo_id)))
    ngo = result.scalar_one_or_none()
    if ngo is None:
        raise api_error(404, "NGO_NOT_FOUND", f"NGO {ngo_id} not found.")
    return ngo


def _require_self_or_admin(user: User, ngo: NGO) -> None:
    if user.role == UserRole.ADMIN:
        return
    if user.role == UserRole.NGO and (user.id == ngo.user_id or user.id == ngo.id):
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

    dynamic_available_kg = await compute_dynamic_ngo_capacity(ngo, db)

    return {
        "id": ngo.id,
        "ngo_id": ngo.id,
        "organisation_name": ngo.organisation_name,
        "address": ngo.address,
        "location": {"latitude": lat, "longitude": lng},
        "location_text": ngo.location,
        "storage_capacity_kg": round(ngo.storage_capacity_kg, 1),
        "available_capacity_kg": round(dynamic_available_kg, 1),
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


@router.post("", status_code=201)
async def create_ngo(
    body: CreateNGOProfileRequest,
    ngo_user: Annotated[User, Depends(require_role("NGO"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    existing = await db.execute(select(NGO).where(NGO.user_id == ngo_user.id))
    if existing.scalar_one_or_none() is not None:
        raise api_error(409, "NGO_ALREADY_EXISTS", "An NGO profile already exists for this account.")

    ngo = NGO(
        id=f"ngo_{uuid4().hex[:12]}",
        user_id=ngo_user.id,
        verification_status=NGOVerificationStatus.PENDING,
        **body.model_dump(),
    )
    db.add(ngo)
    await db.commit()
    await db.refresh(ngo)
    return envelope(await _to_dict(ngo, db))


@router.get("/me")
async def get_my_ngo(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(NGO).where(NGO.user_id == user.id))
    ngo = result.scalar_one_or_none()
    if ngo is None and user.role == UserRole.ADMIN:
        result = await db.execute(select(NGO).order_by(NGO.created_at.desc()))
        ngo = result.scalars().first()
    return envelope(await _to_dict(ngo, db) if ngo is not None else None)


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
    elif body.location is not None:
        ngo.location = body.location
    storage_capacity_kg = body.storage_capacity_kg if body.storage_capacity_kg is not None else ngo.storage_capacity_kg
    available_capacity_kg = body.available_capacity_kg if body.available_capacity_kg is not None else ngo.available_capacity_kg
    if available_capacity_kg > storage_capacity_kg:
        raise api_error(
            400, "CAPACITY_EXCEEDS_STORAGE",
            "available_capacity_kg cannot exceed storage_capacity_kg.",
            "available_capacity_kg",
        )
    ngo.storage_capacity_kg = storage_capacity_kg
    ngo.available_capacity_kg = available_capacity_kg
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


@router.get("/{ngo_id}/categories")
async def get_categories(
    ngo_id: str,
    ngo_user: Annotated[User, Depends(require_role("NGO", "ADMIN"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ngo = await _get_ngo_or_404(ngo_id, db)
    _require_self_or_admin(ngo_user, ngo)
    result = await db.execute(
        select(NGOFoodCategory.food_category).where(
            NGOFoodCategory.ngo_id == ngo_id, NGOFoodCategory.accepted == True  # noqa: E712
        )
    )
    return envelope(result.scalars().all())


@router.put("/{ngo_id}/categories")
async def replace_categories(
    ngo_id: str,
    body: ReplaceCategoriesRequest,
    ngo_user: Annotated[User, Depends(require_role("NGO", "ADMIN"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ngo = await _get_ngo_or_404(ngo_id, db)
    _require_self_or_admin(ngo_user, ngo)
    normalized = sorted({category.strip().upper() for category in body.categories if category.strip()})
    await db.execute(delete(NGOFoodCategory).where(NGOFoodCategory.ngo_id == ngo_id))
    for category in normalized:
        db.add(NGOFoodCategory(ngo_id=ngo_id, food_category=category, accepted=True))
    await db.commit()
    return envelope(normalized)


@router.get("/{ngo_id}/demand")
async def list_demand(
    ngo_id: str,
    ngo_user: Annotated[User, Depends(require_role("NGO", "ADMIN"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ngo = await _get_ngo_or_404(ngo_id, db)
    _require_self_or_admin(ngo_user, ngo)
    result = await db.execute(select(NGODemand).where(NGODemand.ngo_id == ngo_id).order_by(NGODemand.updated_at.desc()))
    return envelope([_demand_to_dict(demand) for demand in result.scalars().all()])


def _demand_to_dict(demand: NGODemand) -> dict:
    return {
        "id": demand.id,
        "food_category": demand.food_category,
        "required_quantity_kg": demand.required_quantity_kg,
        "priority": demand.priority,
        "valid_until": iso_z(demand.valid_until),
        "updated_at": iso_z(demand.updated_at),
    }


@router.post("/{ngo_id}/demand", status_code=201)
async def create_demand(
    ngo_id: str,
    body: UpdateDemandRequest,
    ngo_user: Annotated[User, Depends(require_role("NGO", "ADMIN"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ngo = await _get_ngo_or_404(ngo_id, db)
    _require_self_or_admin(ngo_user, ngo)
    demand = NGODemand(ngo_id=ngo.id, **body.model_dump(exclude={"valid_until"}), valid_until=to_naive_ist(body.valid_until), updated_at=ist_now())
    db.add(demand)
    await db.commit()
    await db.refresh(demand)
    return envelope(_demand_to_dict(demand))


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
        valid_until=to_naive_ist(body.valid_until),
        updated_at=ist_now(),
    ))
    await db.commit()

    return envelope({
        "ngo_id": ngo.id,
        "food_category": body.food_category,
        "required_quantity_kg": round(body.required_quantity_kg, 1),
        "priority": body.priority,
        "valid_until": iso_z(body.valid_until),
    })


@router.patch("/{ngo_id}/demand/{demand_id}")
async def update_specific_demand(
    ngo_id: str,
    demand_id: int,
    body: UpdateDemandRequest,
    ngo_user: Annotated[User, Depends(require_role("NGO", "ADMIN"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ngo = await _get_ngo_or_404(ngo_id, db)
    _require_self_or_admin(ngo_user, ngo)
    result = await db.execute(select(NGODemand).where(NGODemand.id == demand_id, NGODemand.ngo_id == ngo_id))
    demand = result.scalar_one_or_none()
    if demand is None:
        raise api_error(404, "DEMAND_NOT_FOUND", f"Demand {demand_id} not found.")
    for field, value in body.model_dump().items():
        if field == "valid_until" and value is not None:
            value = to_naive_ist(value)
        setattr(demand, field, value)
    demand.updated_at = ist_now()
    await db.commit()
    return envelope(_demand_to_dict(demand))


@router.delete("/{ngo_id}/demand/{demand_id}", status_code=204)
async def delete_demand(
    ngo_id: str,
    demand_id: int,
    ngo_user: Annotated[User, Depends(require_role("NGO", "ADMIN"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ngo = await _get_ngo_or_404(ngo_id, db)
    _require_self_or_admin(ngo_user, ngo)
    result = await db.execute(select(NGODemand).where(NGODemand.id == demand_id, NGODemand.ngo_id == ngo_id))
    demand = result.scalar_one_or_none()
    if demand is None:
        raise api_error(404, "DEMAND_NOT_FOUND", f"Demand {demand_id} not found.")
    await db.delete(demand)
    await db.commit()


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

    from app.ws.manager import manager
    await manager.broadcast("donations", {
        "event": "ngo.capacity_updated",
        "ngo_id": ngo.id,
        "storage_capacity_kg": ngo.storage_capacity_kg,
        "available_capacity_kg": round(ngo.available_capacity_kg, 1),
    })
    await manager.broadcast("deliveries", {
        "event": "ngo.capacity_updated",
        "ngo_id": ngo.id,
        "storage_capacity_kg": ngo.storage_capacity_kg,
        "available_capacity_kg": round(ngo.available_capacity_kg, 1),
    })

    return envelope({"ngo_id": ngo.id, "available_capacity_kg": round(ngo.available_capacity_kg, 1)})


@router.get("/me/incoming")
async def my_incoming_offers(
    ngo_user: Annotated[User, Depends(require_role("NGO", "ADMIN"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Direct incoming offers endpoint for the authenticated NGO."""
    return await _get_incoming_offers_for_ngo("me", ngo_user, db)


@router.get("/{ngo_id}/incoming")
async def incoming_offers(
    ngo_id: str,
    ngo_user: Annotated[User, Depends(require_role("NGO", "ADMIN"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Donations currently matched to this NGO awaiting accept/reject.

    eta_minutes / distance_km come from Person 5's heuristic route (pickup ->
    this NGO) and are null only when a location can't be parsed, rather than
    fabricating numbers.
    """
    return await _get_incoming_offers_for_ngo(ngo_id, ngo_user, db)


async def _get_incoming_offers_for_ngo(
    ngo_id: str,
    ngo_user: User,
    db: AsyncSession,
):
    if ngo_id == "me":
        result = await db.execute(select(NGO).where(or_(NGO.user_id == ngo_user.id, NGO.id == ngo_user.id)))
        ngo = result.scalar_one_or_none()
        if ngo is None and ngo_user.role == UserRole.ADMIN:
            result = await db.execute(select(NGO).order_by(NGO.created_at.desc()))
            ngo = result.scalars().first()
        if ngo is None:
            raise api_error(404, "NGO_NOT_FOUND", "No NGO profile found for current user.")
    else:
        ngo = await _get_ngo_or_404(ngo_id, db)
        _require_self_or_admin(ngo_user, ngo)

    ngo_identifiers = [ngo.id]
    if ngo.user_id and ngo.user_id != ngo.id:
        ngo_identifiers.append(ngo.user_id)
    if ngo.user_id:
        other_ids = (await db.execute(select(NGO.id).where(NGO.user_id == ngo.user_id))).scalars().all()
        for x in other_ids:
            if x not in ngo_identifiers:
                ngo_identifiers.append(x)

    # Auto-heal: If any donation was matched to this NGO (matched_ngo_id in ngo_identifiers)
    # but status is stuck in AVAILABLE or MATCHING (e.g. from an unhandled exception post-match),
    # heal it to MATCHED status so it displays in incoming offers and can be accepted/rejected.
    stuck_donations = (await db.execute(
        select(Donation).where(
            Donation.matched_ngo_id.in_(ngo_identifiers),
            Donation.status.in_([DonationStatus.AVAILABLE, DonationStatus.MATCHING]),
        )
    )).scalars().all()
    if stuck_donations:
        for sd in stuck_donations:
            sd.status = DonationStatus.MATCHED
            sd.updated_at = ist_now()
        await db.commit()

    result = await db.execute(
        select(Donation).where(
            Donation.matched_ngo_id.in_(ngo_identifiers),
            or_(
                Donation.status == DonationStatus.MATCHED,
                Donation.status == "MATCHED",
            ),
        ).order_by(Donation.created_at.desc())
    )
    donations = result.scalars().all()

    now = ist_now()
    # Route estimation with timezone safety and error fallback
    routes = {}
    for d in donations:
        try:
            d_avail = to_naive_ist(d.available_from) if d.available_from else now
            dep_time = max(now, d_avail)
            routes[d.id] = offer_route_summary(d.pickup_location, ngo.location, dep_time)
        except Exception as _re:
            routes[d.id] = {"eta_minutes": 15, "distance_km": 3.0}

    data = []
    for d in donations:
        route_info = routes.get(d.id, {})
        d_exp = to_naive_ist(d.expiry_time) if d.expiry_time else now
        rem_min = max(0, int((d_exp - now).total_seconds() // 60))
        status_val = d.status.value if hasattr(d.status, "value") else str(d.status)
        data.append({
            "id": d.id,
            "donation_id": d.id,
            "food_category": d.food_category,
            "food_name": d.food_name,
            "quantity_kg": round(d.quantity_kg, 1),
            "available_from": iso_z(d.available_from),
            "expiry_time": iso_z(d.expiry_time),
            "pickup_location": d.pickup_location,
            "special_requirements": d.special_requirements or d.special_handling,
            "status": status_val,
            "match_score": d.match_score,
            "weights_version_id": d.weights_version_id,
            "eta_minutes": route_info.get("eta_minutes") if route_info else None,
            "distance_km": route_info.get("distance_km") if route_info else None,
            "remaining_shelf_life_min": rem_min,
        })
    return envelope(data)
