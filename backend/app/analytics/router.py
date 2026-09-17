"""
Analytics API router.

GET /api/v1/analytics/overview — all-time system summary (optionally filtered by from/to query params)
GET /api/v1/analytics/food — food rescue metrics
GET /api/v1/analytics/logistics — delivery/routing efficiency metrics
GET /api/v1/analytics/social — impact metrics

All endpoints require ADMIN role per [orig §21].
All responses use the frozen contract envelope: { "data": {...}, "meta": { "request_id": "..." } }.
"""

from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4

from app.auth.dependencies import require_admin
from app.core.database import get_db
from app.models.user import User
from app.repositories.analytics_repository import AnalyticsRepository
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


def _envelope(data: dict) -> dict:
    """Wrap response in standard success envelope with request_id."""
    return {"data": data, "meta": {"request_id": str(uuid4())}}


@router.get("/overview")
async def get_analytics_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    from_date: datetime | None = Query(None, alias="from", description="Start of time window (ISO-8601 UTC)"),
    to_date: datetime | None = Query(None, alias="to", description="End of time window (ISO-8601 UTC)"),
):
    """
    System-wide overview metrics.

    Returns:
        - total_donations: int
        - total_food_rescued_kg: float (1 decimal)
        - active_donations: int
        - active_deliveries: int
        - registered_ngos: int
        - registered_donors: int
        - available_drivers: int

    Query params from/to are optional; omitting both = all-time.
    Invalid range (from > to) would be caught here; for now, trust the client.
    """
    repo = AnalyticsRepository(db)
    service = AnalyticsService(repo)
    data = await service.get_overview(from_date, to_date)
    return _envelope(data)


@router.get("/food")
async def get_food_metrics(
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
):
    """
    Food rescue metrics.

    Returns:
        - kg_diverted: float (1 decimal) — total food rescued in kg
        - meals_recovered: int — estimated meals (kg_diverted / MEAL_WEIGHT_KG)
    """
    repo = AnalyticsRepository(db)
    service = AnalyticsService(repo)
    data = await service.get_food_metrics(from_date, to_date)
    return _envelope(data)


@router.get("/logistics")
async def get_logistics_metrics(
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
):
    """
    Logistics efficiency metrics.

    Returns:
        - delivery_success_rate: float (0–1, not percentage)
        - avg_matching_time_sec: float
        - avg_delivery_time_min: float
        - route_distance_saved_km: float (1 decimal)
    """
    repo = AnalyticsRepository(db)
    service = AnalyticsService(repo)
    data = await service.get_logistics_metrics(from_date, to_date)
    return _envelope(data)


@router.get("/social")
async def get_social_metrics(
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
):
    """
    Social impact metrics.

    Returns:
        - organisations_served: int — distinct NGOs who received deliveries
        - beneficiaries_reached: int — ESTIMATE (meals_recovered / MEALS_PER_BENEFICIARY_PER_PERIOD)
          This is an approximation until real beneficiary tracking is implemented by Person 1/3.
    """
    repo = AnalyticsRepository(db)
    service = AnalyticsService(repo)
    data = await service.get_social_metrics(from_date, to_date)
    return _envelope(data)
