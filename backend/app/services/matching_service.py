"""
Matching service — bridges the SQLAlchemy ORM layer and the pure matching engine.

This module is the ONLY place that translates between:
  - ORM models  (app.models.*)
  - Engine models (app.matching_engine.models.*)

The algorithm (matching_engine.*) never imports SQLAlchemy or touches the DB.
The router (app.matching.router) calls these helpers rather than writing its
own ORM queries.

Route data (Person 5 dependency)
---------------------------------
Person 5's /routes/calculate API is not yet available. `load_routes` uses a
Haversine-based mock that approximates distance_km and duration_minutes from
straight-line distance. When Person 5 delivers, replace the body of
`load_routes` — the signature and return type are fixed by the engine contract
and must not change.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.matching_engine import models as me
from app.models import (
    Donation as OrmDonation,
    DonationRejection as OrmDonationRejection,
    MatchingWeightsHistory as OrmWeights,
    NGO as OrmNGO,
    NGODemand as OrmNGODemand,
    NGOFoodCategory as OrmNGOFoodCategory,
    NGOVerificationStatus,
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km between two WGS-84 coordinates."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _mock_route(ngo_id: str, distance_km: float) -> me.RouteMetrics:
    """Estimate route metrics from straight-line distance.

    Assumes an average urban speed of ~20 km/h with a 1.3 detour factor.
    Replace this function body with a real HTTP call to Person 5 when ready.
    """
    effective_km = distance_km * 1.3  # road-network correction factor
    duration_minutes = (effective_km / 20.0) * 60.0  # 20 km/h average speed
    return me.RouteMetrics(
        ngo_id=ngo_id,
        distance_km=round(effective_km, 2),
        duration_minutes=round(duration_minutes, 1),
        traffic_duration_minutes=None,  # unknown until Person 5 delivers
    )


def _parse_location(location_str: Optional[str]) -> Optional[tuple[float, float]]:
    """Parse the NGO 'lat,lng' string stored in the DB."""
    if not location_str or "," not in location_str:
        return None
    try:
        lat_str, lng_str = location_str.split(",", 1)
        return float(lat_str.strip()), float(lng_str.strip())
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Public service functions (called by the matching router)
# ---------------------------------------------------------------------------

async def load_donation(donation_id: str, db: AsyncSession) -> Optional[me.Donation]:
    """Fetch and map an ORM Donation to the engine's Pydantic Donation.

    Returns None if the donation is not found.
    Location is stored as a JSON dict {"latitude": ..., "longitude": ...}
    on the ORM model (see §3 of the contract).
    """
    result = await db.execute(select(OrmDonation).where(OrmDonation.id == donation_id))
    row: Optional[OrmDonation] = result.scalar_one_or_none()
    if row is None:
        return None

    loc = row.pickup_location or {}
    lat = loc.get("latitude") or 0.0
    lng = loc.get("longitude") or 0.0

    # Ensure timezone-aware datetimes — DB stores naive UTC datetimes.
    def _utc(dt: datetime) -> datetime:
        if dt is None:
            return dt
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt

    return me.Donation(
        id=row.id,
        food_category=me.FoodCategory(row.food_category),
        quantity_kg=row.quantity_kg,
        pickup_location=me.Location(latitude=lat, longitude=lng),
        available_from=_utc(row.available_from),
        expiry_time=_utc(row.expiry_time),
    )


async def load_active_ngos(db: AsyncSession) -> list[me.NGOCandidate]:
    """Fetch all APPROVED NGOs with their food categories and current demand.

    Maps each ORM NGO to the engine's NGOCandidate Pydantic model.
    Demand is the latest NGODemand row per ngo_id (by updated_at desc).
    """
    # All APPROVED NGOs
    ngo_result = await db.execute(
        select(OrmNGO).where(OrmNGO.verification_status == NGOVerificationStatus.APPROVED)
    )
    ngo_rows: list[OrmNGO] = list(ngo_result.scalars().all())
    if not ngo_rows:
        return []

    ngo_ids = [n.id for n in ngo_rows]

    # Food categories for each NGO
    cat_result = await db.execute(
        select(OrmNGOFoodCategory).where(
            OrmNGOFoodCategory.ngo_id.in_(ngo_ids),
            OrmNGOFoodCategory.accepted == True,  # noqa: E712
        )
    )
    # Build a dict: ngo_id -> list[FoodCategory]
    cat_map: dict[str, list[me.FoodCategory]] = {}
    for cat_row in cat_result.scalars().all():
        try:
            fc = me.FoodCategory(cat_row.food_category)
        except ValueError:
            continue
        cat_map.setdefault(cat_row.ngo_id, []).append(fc)

    # Latest demand row per NGO (take only the most-recently-updated row)
    demand_result = await db.execute(
        select(OrmNGODemand)
        .where(OrmNGODemand.ngo_id.in_(ngo_ids))
        .order_by(OrmNGODemand.updated_at.desc())
    )
    demand_map: dict[str, OrmNGODemand] = {}
    for d in demand_result.scalars().all():
        demand_map.setdefault(d.ngo_id, d)  # first = most recent

    def _utc(dt: datetime) -> datetime:
        if dt is None:
            return dt
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt

    candidates: list[me.NGOCandidate] = []
    for ngo in ngo_rows:
        coords = _parse_location(ngo.location)
        if coords is None:
            # Can't compute routes without a location — skip gracefully.
            continue
        lat, lng = coords

        accepted = cat_map.get(ngo.id, [])
        if not accepted:
            continue  # Engine would reject for FOOD_CATEGORY_NOT_ACCEPTED anyway.

        demand: Optional[me.NGODemand] = None
        orm_demand = demand_map.get(ngo.id)
        if orm_demand is not None:
            try:
                demand = me.NGODemand(
                    food_category=me.FoodCategory(orm_demand.food_category),
                    required_quantity_kg=orm_demand.required_quantity_kg,
                    priority=me.Priority(orm_demand.priority) if orm_demand.priority else me.Priority.MEDIUM,
                    valid_until=_utc(orm_demand.valid_until) if orm_demand.valid_until else None,
                )
            except (ValueError, Exception):
                demand = None

        try:
            candidates.append(
                me.NGOCandidate(
                    ngo_id=ngo.id,
                    location=me.Location(latitude=lat, longitude=lng),
                    available_capacity_kg=ngo.available_capacity_kg,
                    accepted_categories=accepted,
                    operating_hours=me.OperatingHours(
                        start=ngo.operating_start or "00:00",
                        end=ngo.operating_end or "23:59",
                    ),
                    is_verified=ngo.verification_status == NGOVerificationStatus.APPROVED,
                    demand=demand,
                    storage_capacity_kg=ngo.storage_capacity_kg if ngo.storage_capacity_kg else None,
                )
            )
        except Exception:
            # Skip malformed NGO rows rather than crashing the entire match run.
            continue

    return candidates


def load_routes(
    donation: me.Donation,
    ngos: list[me.NGOCandidate],
) -> dict[str, me.RouteMetrics]:
    """Build route metrics for each candidate NGO.

    PLACEHOLDER: uses Haversine straight-line distance with urban corrections.
    Replace this function body with real HTTP calls to Person 5's
    /routes/calculate endpoint. The signature is fixed by the engine contract.
    """
    routes: dict[str, me.RouteMetrics] = {}
    pickup_lat = donation.pickup_location.latitude
    pickup_lng = donation.pickup_location.longitude

    for ngo in ngos:
        dist = _haversine_km(
            pickup_lat, pickup_lng,
            ngo.location.latitude, ngo.location.longitude,
        )
        routes[ngo.ngo_id] = _mock_route(ngo.ngo_id, dist)

    return routes


async def load_active_weights(
    donation: me.Donation,
    db: AsyncSession,
) -> me.MatchingWeights:
    """Look up active MatchingWeights for this donation's food_category.

    Lookup priority:
      1. city-specific + category-specific row  (future use)
      2. 'default' city + category-specific row (future use)
      3. 'default' city + 'ALL' category fallback row (seeded by migration 003)

    If the table has no rows at all, falls back to hard-coded equal weights so
    the service never fails to produce a result.
    """
    food_cat = donation.food_category.value

    # Try category-specific first, then 'ALL'
    for category_filter in (food_cat, "ALL"):
        result = await db.execute(
            select(OrmWeights)
            .where(OrmWeights.is_active == True, OrmWeights.food_category == category_filter)  # noqa: E712
            .order_by(OrmWeights.id.desc())
            .limit(1)
        )
        row: Optional[OrmWeights] = result.scalar_one_or_none()
        if row is not None:
            return me.MatchingWeights(
                weights_version_id=row.weights_version_id,
                w_capacity=row.w_capacity,
                w_shelf_life=row.w_shelf_life,
                w_transit=row.w_transit,
                w_demand=row.w_demand,
                w_route=row.w_route,
            )

    # Hard-coded ultimate fallback — should never be reached after migration 003.
    return me.MatchingWeights(
        weights_version_id="wv_fallback_hardcoded",
        w_capacity=0.2,
        w_shelf_life=0.2,
        w_transit=0.2,
        w_demand=0.2,
        w_route=0.2,
    )


async def get_excluded_ngo_ids(donation_id: str, db: AsyncSession) -> set[str]:
    """Return the set of NGO IDs that have already rejected this donation."""
    result = await db.execute(
        select(OrmDonationRejection.ngo_id).where(
            OrmDonationRejection.donation_id == donation_id
        )
    )
    return {row for row in result.scalars().all()}
