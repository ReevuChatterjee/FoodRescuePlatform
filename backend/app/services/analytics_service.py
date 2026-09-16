"""
Analytics service: applies formulas on top of repository aggregations.

Per Section B.2–B.5: exact formula logic, documented constants, rounding rules.
"""

from datetime import datetime
from app.repositories.analytics_repository import AnalyticsRepository
from app.analytics.constants import MEAL_WEIGHT_KG, MEALS_PER_BENEFICIARY_PER_PERIOD


class AnalyticsService:
    def __init__(self, repo: AnalyticsRepository):
        self.repo = repo

    async def get_overview(self, from_date: datetime | None = None, to_date: datetime | None = None) -> dict:
        """
        GET /api/v1/analytics/overview response.
        All counts are plain integers; total_food_rescued_kg rounded to 1 decimal.
        """
        return {
            "total_donations": await self.repo.get_total_donations(from_date, to_date),
            "total_food_rescued_kg": await self.repo.get_total_food_rescued_kg(from_date, to_date),
            "active_donations": await self.repo.get_active_donations(),
            "active_deliveries": await self.repo.get_active_deliveries(),
            "registered_ngos": await self.repo.get_registered_ngos(),
            "registered_donors": await self.repo.get_registered_donors(),
            "registered_drivers": await self.repo.get_registered_drivers(),
            "available_drivers": await self.repo.get_available_drivers(),
        }

    async def get_food_metrics(self, from_date: datetime | None = None, to_date: datetime | None = None) -> dict:
        """
        GET /api/v1/analytics/food response.
        kg_diverted is identical to total_food_rescued_kg (different field name, same query).
        meals_recovered = kg_diverted / MEAL_WEIGHT_KG, rounded to nearest integer.
        """
        kg_diverted = await self.repo.get_total_food_rescued_kg(from_date, to_date)
        meals_recovered = round(kg_diverted / MEAL_WEIGHT_KG)
        return {
            "kg_diverted": kg_diverted,
            "meals_recovered": meals_recovered,
        }

    async def get_logistics_metrics(self, from_date: datetime | None = None, to_date: datetime | None = None) -> dict:
        """
        GET /api/v1/analytics/logistics response.
        delivery_success_rate: fraction 0–1, not percentage (per contract example 0.94, not 94).
        avg_matching_time_sec, avg_delivery_time_min: rounded as returned by repo.
        route_distance_saved_km: rounded to 1 decimal.
        """
        return {
            "delivery_success_rate": await self.repo.get_delivery_success_rate(from_date, to_date),
            "avg_matching_time_sec": await self.repo.get_avg_matching_time_sec(from_date, to_date),
            "avg_delivery_time_min": await self.repo.get_avg_delivery_time_min(from_date, to_date),
            "route_distance_saved_km": round(await self.repo.get_route_distance_saved_km(from_date, to_date), 1),
        }

    async def get_social_metrics(self, from_date: datetime | None = None, to_date: datetime | None = None) -> dict:
        """
        GET /api/v1/analytics/social response.
        organisations_served: COUNT(DISTINCT ngo_id) from delivered deliveries.
        beneficiaries_reached: estimate only — meals_recovered / MEALS_PER_BENEFICIARY_PER_PERIOD.
        Per [orig §10]: explicit warning that beneficiaries_reached is an estimate until real tracking exists.
        """
        kg_diverted = await self.repo.get_total_food_rescued_kg(from_date, to_date)
        meals_recovered = round(kg_diverted / MEAL_WEIGHT_KG)
        beneficiaries_reached = round(meals_recovered / MEALS_PER_BENEFICIARY_PER_PERIOD)

        return {
            "organisations_served": await self.repo.get_organisations_served(from_date, to_date),
            "beneficiaries_reached": beneficiaries_reached,  # ESTIMATE — document in response comment
        }
