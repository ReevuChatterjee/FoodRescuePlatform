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
import os

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class RoutingSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), env_file_encoding="utf-8", env_prefix="ROUTING_", extra="ignore"
    )

    provider: Literal["heuristic", "osrm", "tomtom"] = Field(
        default="heuristic",
        validation_alias=AliasChoices("ROUTING_PROVIDER", "PROVIDER", "provider"),
    )
    osrm_base_url: str = "https://router.project-osrm.org"
    tomtom_base_url: str = "https://api.tomtom.com"
    tomtom_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "ROUTING_TOMTOM_API_KEY",
            "TOMTOM_API_KEY",
            "ROUTING_TOM_TOM_API_KEY",
            "TOM_TOM_API_KEY",
            "TOMTOM_KEY",
            "TOMTOM",
            "tomtom_api_key",
            "tom_tom_api_key",
        ),
    )
    timeout_seconds: float = Field(default=8.0, gt=0)
    # Same 1.3 road-network correction Person 4's placeholder used, so ETAs stay
    # comparable. It is an assumption, not a measured Bengaluru figure.
    circuity_factor: float = Field(default=1.3, ge=1.0)
    traffic_model: Literal["time_of_day", "city_average", "free_flow"] = "time_of_day"
    cache_ttl_seconds: float = Field(default=120.0, ge=0)

    @field_validator("tomtom_api_key", mode="before")
    @classmethod
    def clean_api_key(cls, v: object) -> str | None:
        def is_valid(s: str) -> bool:
            return bool(
                s
                and s not in ("ROUTING_TOMTOM_API_KEY", "TOMTOM_API_KEY", "VITE_TOMTOM_API_KEY", "None", "null", "")
                and "API_KEY" not in s
            )

        if v:
            cleaned = str(v).strip().strip("'\"")
            if is_valid(cleaned):
                return cleaned
        # Fallback: scan os.environ directly for any TomTom variable name
        for k, val in os.environ.items():
            k_upper = k.upper()
            if ("TOMTOM" in k_upper or "TOM_TOM" in k_upper) and "URL" not in k_upper:
                cleaned = str(val).strip().strip("'\"")
                if is_valid(cleaned):
                    return cleaned
        return None

