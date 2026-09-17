"""Routing configuration, read from the same .env as app.core.config.

Kept in this module (env prefix ROUTING_) so Person 5 never has to edit
Person 1's core settings file.

    ROUTING_PROVIDER=heuristic       heuristic | osrm | tomtom
    ROUTING_OSRM_BASE_URL=https://router.project-osrm.org
    ROUTING_TOMTOM_API_KEY=          required when provider=tomtom
    ROUTING_TIMEOUT_SECONDS=4
    ROUTING_CIRCUITY_FACTOR=1.3      road km per straight-line km (assumption)
    ROUTING_TRAFFIC_MODEL=time_of_day   time_of_day | city_average | free_flow
    ROUTING_CACHE_TTL_SECONDS=120
"""
from __future__ import annotations

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class RoutingSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env", env_file_encoding="utf-8", env_prefix="ROUTING_", extra="ignore"
    )

    provider: Literal["heuristic", "osrm", "tomtom"] = "heuristic"
    osrm_base_url: str = "https://router.project-osrm.org"
    tomtom_base_url: str = "https://api.tomtom.com"
    tomtom_api_key: str | None = None
    timeout_seconds: float = Field(default=4.0, gt=0)
    # Same 1.3 road-network correction Person 4's placeholder used, so ETAs stay
    # comparable. It is an assumption, not a measured Bengaluru figure.
    circuity_factor: float = Field(default=1.3, ge=1.0)
    traffic_model: Literal["time_of_day", "city_average", "free_flow"] = "time_of_day"
    cache_ttl_seconds: float = Field(default=120.0, ge=0)
