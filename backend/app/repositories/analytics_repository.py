"""
Analytics repository: DB-side aggregation for all KPIs.

Per [orig §43]: all aggregations happen in SQL, not Python loops.
Per Section B: exact calculation logic for each metric.
"""

from datetime import datetime
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Donation,
    Delivery,
    HandoverRecord,
    NGO,
    Donor,
    Vehicle,
    DonationStatus,
    DeliveryStatus,
    NGOVerificationStatus,
)


class AnalyticsRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_total_donations(self, from_date: datetime | None = None, to_date: datetime | None = None) -> int:
        """Count all donations, optionally filtered by created_at window."""
        query = select(func.count(Donation.id))
        if from_date:
            query = query.where(Donation.created_at >= from_date)
        if to_date:
            query = query.where(Donation.created_at <= to_date)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_total_food_rescued_kg(self, from_date: datetime | None = None, to_date: datetime | None = None) -> float:
        """
        Sum quantity_handed_over from handover_records whose linked delivery is DELIVERED or PARTIALLY_DELIVERED.
        Per [orig §44]: never SUM(donations.quantity_kg).
        """
        query = (
            select(func.coalesce(func.sum(HandoverRecord.quantity_handed_over), 0.0))
            .join(Delivery, HandoverRecord.delivery_id == Delivery.id)
            .where(Delivery.status.in_([DeliveryStatus.DELIVERED, DeliveryStatus.PARTIALLY_DELIVERED]))
        )
        if from_date or to_date:
            # filter on actual_delivery_time for time-window queries
            if from_date:
                query = query.where(Delivery.actual_delivery_time >= from_date)
            if to_date:
                query = query.where(Delivery.actual_delivery_time <= to_date)
        result = await self.db.execute(query)
        return round(result.scalar_one(), 1)

    async def get_active_donations(self) -> int:
        """
        Count donations in non-terminal states.
        Terminal: DELIVERED, PARTIALLY_DELIVERED, NO_MATCH_FOUND, REJECTED, EXPIRED, CANCELLED, DRIVER_ISSUE.
        Active: all others.
        """
        terminal_states = [
            DonationStatus.DELIVERED,
            DonationStatus.PARTIALLY_DELIVERED,
            DonationStatus.NO_MATCH_FOUND,
            DonationStatus.REJECTED,
            DonationStatus.EXPIRED,
            DonationStatus.CANCELLED,
            DonationStatus.DRIVER_ISSUE,
        ]
        query = select(func.count(Donation.id)).where(Donation.status.notin_(terminal_states))
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_active_deliveries(self) -> int:
        """Count deliveries not in terminal states."""
        terminal = [DeliveryStatus.DELIVERED, DeliveryStatus.PARTIALLY_DELIVERED, DeliveryStatus.CANCELLED, DeliveryStatus.DRIVER_ISSUE]
        query = select(func.count(Delivery.id)).where(Delivery.status.notin_(terminal))
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_registered_ngos(self) -> int:
        """Count all NGOs regardless of verification_status (registration count, not eligibility)."""
        result = await self.db.execute(select(func.count(NGO.id)))
        return result.scalar_one()

    async def get_registered_donors(self) -> int:
        """Count all donors."""
        result = await self.db.execute(select(func.count(Donor.id)))
        return result.scalar_one()

    async def get_registered_drivers(self) -> int:
        """Count all registered drivers/vehicles."""
        result = await self.db.execute(select(func.count(Vehicle.id)))
        return result.scalar_one()

    async def get_available_drivers(self) -> int:
        """Count vehicles with availability_status = AVAILABLE."""
        result = await self.db.execute(select(func.count(Vehicle.id)).where(Vehicle.availability_status == "AVAILABLE"))
        return result.scalar_one()

    async def get_delivery_success_rate(self, from_date: datetime | None = None, to_date: datetime | None = None) -> float:
        """
        successfulDeliveries / totalAssignedDeliveries.
        Returns fraction 0–1 (not percentage).
        """
        successful_query = select(func.count(Delivery.id)).where(
            Delivery.status.in_([DeliveryStatus.DELIVERED, DeliveryStatus.PARTIALLY_DELIVERED])
        )
        total_query = select(func.count(Delivery.id)).where(Delivery.status != DeliveryStatus.CANCELLED)

        if from_date:
            successful_query = successful_query.where(Delivery.actual_delivery_time >= from_date)
            total_query = total_query.where(Delivery.actual_delivery_time >= from_date)
        if to_date:
            successful_query = successful_query.where(Delivery.actual_delivery_time <= to_date)
            total_query = total_query.where(Delivery.actual_delivery_time <= to_date)

        successful = (await self.db.execute(successful_query)).scalar_one()
        total = (await self.db.execute(total_query)).scalar_one()

        return round(successful / total, 2) if total > 0 else 0.0

    async def get_avg_matching_time_sec(self, from_date: datetime | None = None, to_date: datetime | None = None) -> float:
        """
        AVG(match_timestamp - donation.created_at) in seconds, over donations that reached MATCHED.
        match_timestamp is inferred from when status became MATCHED; if unavailable, return 0.0 with a warning.
        In production, Person 1/4 must add a `matched_at` timestamp column.
        """
        # Placeholder: assumes matched_at column exists (to be added by Person 1).
        # If not present, this would need to query matching_weights_history or audit_logs — complex.
        # For now, return 0.0 and document the gap.
        # TODO: coordinate with Person 1 to add Donation.matched_at timestamp.
        return 0.0

    async def get_avg_delivery_time_min(self, from_date: datetime | None = None, to_date: datetime | None = None) -> float:
        """
        AVG(actual_delivery_time - actual_pickup_time) in minutes, over deliveries with both timestamps non-null.
        """
        # Fetch rows and compute in Python to avoid dialect-specific interval math (SQLite vs Postgres)
        query = select(Delivery.actual_delivery_time, Delivery.actual_pickup_time).where(
            and_(
                Delivery.actual_pickup_time.isnot(None),
                Delivery.actual_delivery_time.isnot(None),
            )
        )
        if from_date:
            query = query.where(Delivery.actual_delivery_time >= from_date)
        if to_date:
            query = query.where(Delivery.actual_delivery_time <= to_date)

        result = await self.db.execute(query)
        rows = result.all()
        if not rows:
            return 0.0
            
        total_seconds = sum((row.actual_delivery_time - row.actual_pickup_time).total_seconds() for row in rows)
        avg_minutes = (total_seconds / 60.0) / len(rows)
        return round(avg_minutes, 1)

    async def get_organisations_served(self, from_date: datetime | None = None, to_date: datetime | None = None) -> int:
        """
        COUNT(DISTINCT ngo_id) over deliveries with status DELIVERED or PARTIALLY_DELIVERED.
        """
        query = (
            select(func.count(func.distinct(Delivery.ngo_id)))
            .where(Delivery.status.in_([DeliveryStatus.DELIVERED, DeliveryStatus.PARTIALLY_DELIVERED]))
        )
        if from_date:
            query = query.where(Delivery.actual_delivery_time >= from_date)
        if to_date:
            query = query.where(Delivery.actual_delivery_time <= to_date)

        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_route_distance_saved_km(self, from_date: datetime | None = None, to_date: datetime | None = None) -> float:
        """
        Sum of (naive_distance_km - actual_route_distance_km), clipped at 0 per donation.
        Naive distance = Haversine to nearest eligible NGO among candidates at match time.
        This requires historical candidate sets OR falls back to nearest verified NGO at time of match.

        TODO: Implement Haversine calculation + candidate set retrieval.
        Placeholder returns 0.0 until Person 1/4 provide match candidate history table.
        """
        # Complex: requires joining to matching history or recalculating spatial queries.
        # For MVP: return 0.0 and document as future work.
        return 0.0
