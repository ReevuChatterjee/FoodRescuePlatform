from __future__ import annotations
"""
Matching service — bridges the SQLAlchemy ORM layer and the pure matching engine.

This module is the ONLY place that translates between:
  - ORM models  (app.models.*)
  - Engine models (app.matching_engine.models.*)

The algorithm (matching_engine.*) never imports SQLAlchemy or touches the DB.
The router (app.matching.router) calls these helpers rather than writing its
own ORM queries.

Route data (Person 5)
---------------------
`load_routes` now delegates to Person 5's routing engine (app.routing.service):
road-distance estimate, free-flow duration and a traffic-adjusted duration for
the time of day. It uses the deterministic estimator (no network I/O) so ranking
many candidates stays fast; dispatch re-checks the chosen route with the
configured provider. Signature and return type are unchanged.
"""
from app.core.time import IST

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
from app.routing.service import estimate_routes_from


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

import json
from typing import Any

CATEGORY_MAP = {
    "RAW_PRODUCE": me.FoodCategory.PRODUCE,
    "PRODUCE": me.FoodCategory.PRODUCE,
    "BAKED_GOODS": me.FoodCategory.BAKERY,
    "BAKERY": me.FoodCategory.BAKERY,
    "COOKED": me.FoodCategory.COOKED,
    "PACKAGED": me.FoodCategory.PACKAGED,
    "DAIRY": me.FoodCategory.DAIRY,
    "MIXED": me.FoodCategory.OTHER,
    "OTHER": me.FoodCategory.OTHER,
}

def to_engine_category(raw_cat: Any) -> me.FoodCategory:
    """Safely convert any raw food category string (from frontend or DB) to an engine FoodCategory.
    Maps frontend-specific terms ('RAW_PRODUCE', 'BAKED_GOODS', 'MIXED') to standard engine enums."""
    if not raw_cat:
        return me.FoodCategory.OTHER
    cleaned = str(raw_cat).strip().upper()
    if cleaned in CATEGORY_MAP:
        return CATEGORY_MAP[cleaned]
    try:
        return me.FoodCategory(cleaned)
    except ValueError:
        return me.FoodCategory.OTHER


def _parse_location(location_val: Any) -> Optional[tuple[float, float]]:
    """Parse NGO or Donation location from string, json, or dict."""
    if not location_val:
        return None
    if isinstance(location_val, dict):
        lat = location_val.get("latitude") if location_val.get("latitude") is not None else location_val.get("lat")
        lng = location_val.get("longitude") if location_val.get("longitude") is not None else location_val.get("lng")
        if lat is not None and lng is not None:
            try:
                return float(lat), float(lng)
            except (ValueError, TypeError):
                pass
    if isinstance(location_val, str):
        val_str = location_val.strip()
        if val_str.startswith("{"):
            try:
                parsed = json.loads(val_str)
                return _parse_location(parsed)
            except Exception:
                pass
        if "," in val_str:
            try:
                lat_str, lng_str = val_str.split(",", 1)
                return float(lat_str.strip()), float(lng_str.strip())
            except ValueError:
                pass
    return None


# ---------------------------------------------------------------------------
# Public service functions (called by the matching router)
# ---------------------------------------------------------------------------

async def load_donation(donation_id: str, db: AsyncSession) -> Optional[me.Donation]:
    """Fetch and map an ORM Donation to the engine's Pydantic Donation.

    Returns None if the donation is not found.
    Location is stored as a JSON dict {"latitude": ..., "longitude": ...}
    or string on the ORM model.
    """
    result = await db.execute(select(OrmDonation).where(OrmDonation.id == donation_id))
    row: Optional[OrmDonation] = result.scalar_one_or_none()
    if row is None:
        return None

    coords = _parse_location(row.pickup_location)
    if coords:
        lat, lng = coords
    else:
        lat, lng = 28.6273, 77.2190  # Default fallback coordinates (Janpath / Delhi) if completely missing

    # Ensure timezone-aware datetimes — DB stores naive IST datetimes (from ist_now()).
    def _to_aware_ist(dt: Optional[datetime], field_name: str) -> datetime:
        if dt is None:
            raise ValueError(
                f"Donation {donation_id}: required timestamp '{field_name}' is NULL in the database."
            )
        return dt.replace(tzinfo=IST) if dt.tzinfo is None else dt

    try:
        available_from = _to_aware_ist(row.available_from, "available_from")
        expiry_time = _to_aware_ist(row.expiry_time, "expiry_time")
    except ValueError:
        return None

    return me.Donation(
        id=row.id,
        food_category=to_engine_category(row.food_category),
        quantity_kg=row.quantity_kg,
        pickup_location=me.Location(latitude=lat, longitude=lng),
        available_from=available_from,
        expiry_time=expiry_time,
    )


async def load_active_ngos(db: AsyncSession) -> list[me.NGOCandidate]:
    """Fetch all active NGOs with their food categories and current demand.

    Maps each ORM NGO to the engine's NGOCandidate Pydantic model.
    Demand is the latest NGODemand row per ngo_id (by updated_at desc).
    If no APPROVED NGOs exist in DB, falls back to PENDING NGOs for development/testing resilience.
    """
    # 1. Fetch APPROVED NGOs first
    ngo_result = await db.execute(
        select(OrmNGO).where(OrmNGO.verification_status == NGOVerificationStatus.APPROVED)
    )
    ngo_rows: list[OrmNGO] = list(ngo_result.scalars().all())

    # Fallback to PENDING NGOs if no APPROVED NGOs exist in the database (e.g. testing)
    if not ngo_rows:
        pending_result = await db.execute(
            select(OrmNGO).where(OrmNGO.verification_status == NGOVerificationStatus.PENDING)
        )
        pending_rows = list(pending_result.scalars().all())
        if pending_rows:
            import logging as _log
            _log.getLogger(__name__).warning(
                "No APPROVED NGOs in database. Using %d PENDING NGOs for matching test/demo.",
                len(pending_rows),
            )
            ngo_rows = pending_rows

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
        fc = to_engine_category(cat_row.food_category)
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

    def _to_aware_ist(dt: Optional[datetime]) -> Optional[datetime]:
        """Make a naive IST datetime tz-aware; pass through None safely."""
        if dt is None:
            return None
        return dt.replace(tzinfo=IST) if dt.tzinfo is None else dt

    candidates: list[me.NGOCandidate] = []
    for ngo in ngo_rows:
        coords = _parse_location(ngo.location)
        if coords is None:
            # Fallback coordinates if location string was plain text
            coords = (28.6315, 77.2167)
        lat, lng = coords

        accepted = cat_map.get(ngo.id, [])
        if not accepted:
            # If NGO registered without explicit categories (e.g. from UI registration),
            # default to accepting all food categories so it's not silently dropped.
            accepted = list(me.FoodCategory)

        demand: Optional[me.NGODemand] = None
        orm_demand = demand_map.get(ngo.id)
        if orm_demand is not None:
            try:
                demand = me.NGODemand(
                    food_category=to_engine_category(orm_demand.food_category),
                    required_quantity_kg=orm_demand.required_quantity_kg,
                    priority=me.Priority(orm_demand.priority) if orm_demand.priority else me.Priority.MEDIUM,
                    valid_until=_to_aware_ist(orm_demand.valid_until),
                )
            except Exception:
                demand = None

        capacity = (
            ngo.available_capacity_kg
            if ngo.available_capacity_kg and ngo.available_capacity_kg > 0
            else (ngo.storage_capacity_kg or 500.0)
        )

        try:
            candidates.append(
                me.NGOCandidate(
                    ngo_id=ngo.id,
                    location=me.Location(latitude=lat, longitude=lng),
                    available_capacity_kg=capacity,
                    accepted_categories=accepted,
                    operating_hours=me.OperatingHours(
                        start=ngo.operating_start or "00:00",
                        end=ngo.operating_end or "23:59",
                    ),
                    is_verified=True,  # All selected active/fallback candidates treated as verified
                    demand=demand,
                    storage_capacity_kg=ngo.storage_capacity_kg if ngo.storage_capacity_kg else capacity,
                )
            )
        except Exception:
            continue

    return candidates


def load_routes(
    donation: me.Donation,
    ngos: list[me.NGOCandidate],
) -> dict[str, me.RouteMetrics]:
    """Build route metrics for each candidate NGO via Person 5's routing engine.

    duration_minutes is the free-flow time; traffic_duration_minutes is the
    time-of-day estimate the engine prefers when present (see
    candidate_filter.py check 6 and scoring.route_score).
    """
    estimates = estimate_routes_from(
        (donation.pickup_location.latitude, donation.pickup_location.longitude),
        {ngo.ngo_id: (ngo.location.latitude, ngo.location.longitude) for ngo in ngos},
        departure=datetime.now(IST),
    )
    return {
        ngo_id: me.RouteMetrics(
            ngo_id=ngo_id,
            distance_km=round(estimate.distance_km, 2),
            duration_minutes=round(estimate.duration_minutes, 1),
            traffic_duration_minutes=round(estimate.traffic_duration_minutes, 1),
        )
        for ngo_id, estimate in estimates.items()
    }


def _normalize_weights(
    w_capacity: float,
    w_shelf_life: float,
    w_transit: float,
    w_demand: float,
    w_route: float,
    weights_version_id: str,
) -> tuple[float, float, float, float, float]:
    """Re-normalize weights read from Supabase if they are close to 1.0 but
    drifted due to floating-point storage (e.g. 0.9999999 or 1.0000001).

    The engine's MatchingWeights validator requires |sum - 1.0| <= 1e-6, which
    is tight. If the sum is within 1% of 1.0 we rescale all weights so the
    sum is exactly 1.0; otherwise we raise so the admin knows the row is bad.
    """
    total = w_capacity + w_shelf_life + w_transit + w_demand + w_route
    if abs(total - 1.0) <= 1e-6:
        # Already within the engine's tolerance — no adjustment needed.
        return w_capacity, w_shelf_life, w_transit, w_demand, w_route
    if abs(total - 1.0) <= 0.01:
        # Float storage drift: rescale to exactly 1.0.
        import logging as _logging
        _logging.getLogger(__name__).warning(
            "Weights %r sum to %.8f (expected 1.0); rescaling. "
            "Fix the matching_weights_history row to silence this.",
            weights_version_id, total,
        )
        factor = 1.0 / total
        return (
            w_capacity * factor,
            w_shelf_life * factor,
            w_transit * factor,
            w_demand * factor,
            w_route * factor,
        )
    raise ValueError(
        f"Weights {weights_version_id!r} sum to {total:.6f}, expected 1.0. "
        "Update the matching_weights_history row."
    )


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
            try:
                wc, ws, wt, wd, wr = _normalize_weights(
                    row.w_capacity, row.w_shelf_life, row.w_transit,
                    row.w_demand, row.w_route, row.weights_version_id,
                )
                return me.MatchingWeights(
                    weights_version_id=row.weights_version_id,
                    w_capacity=wc,
                    w_shelf_life=ws,
                    w_transit=wt,
                    w_demand=wd,
                    w_route=wr,
                )
            except ValueError:
                # Bad weights row — fall through to the next category filter.
                continue

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
