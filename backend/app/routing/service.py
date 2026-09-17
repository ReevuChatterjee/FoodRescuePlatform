"""Routing service — the only entry point other modules should import.

Two deliberate paths:

- estimate_route / estimate_routes_from (sync, heuristic, no I/O): used where
  many routes are scored at once (Person 4's candidate ranking, NGO incoming
  offers). Deterministic and fast, so matching never waits on a network call.
- calculate_route (async, configured provider + heuristic fallback + cache):
  used for the single route that actually gets driven (dispatch refinement,
  driver dashboard, POST /routes/calculate).

With the default ROUTING_PROVIDER=heuristic both paths return identical numbers.
"""
from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone

from app.routing.geo import LatLng
from app.routing.providers import (
    FallbackRouteProvider,
    HeuristicRouteProvider,
    OSRMRouteProvider,
    RouteCache,
    RouteEstimate,
    RouteProvider,
    TomTomRouteProvider,
)
from app.routing.settings import RoutingSettings

logger = logging.getLogger(__name__)

_settings = RoutingSettings()
_heuristic = HeuristicRouteProvider(
    circuity_factor=_settings.circuity_factor, traffic_model=_settings.traffic_model
)
_cache = RouteCache(ttl_seconds=_settings.cache_ttl_seconds)
_provider: RouteProvider | None = None


def build_provider(settings: RoutingSettings, heuristic: HeuristicRouteProvider) -> RouteProvider:
    if settings.provider == "osrm":
        return FallbackRouteProvider(
            OSRMRouteProvider(settings.osrm_base_url, settings.timeout_seconds, settings.traffic_model),
            heuristic,
        )
    if settings.provider == "tomtom":
        if not settings.tomtom_api_key:
            logger.warning("ROUTING_PROVIDER=tomtom but ROUTING_TOMTOM_API_KEY is empty; using heuristic")
            return heuristic
        return FallbackRouteProvider(
            TomTomRouteProvider(
                settings.tomtom_api_key, settings.tomtom_base_url, settings.timeout_seconds
            ),
            heuristic,
        )
    return heuristic


def get_provider() -> RouteProvider:
    global _provider
    if _provider is None:
        _provider = build_provider(_settings, _heuristic)
    return _provider


def configure(provider: RouteProvider | None = None) -> None:
    """Swap the provider (tests, demos). None restores the env-configured one."""
    global _provider
    _provider = provider
    _cache.clear()


def get_heuristic() -> HeuristicRouteProvider:
    return _heuristic


def _now() -> datetime:
    return datetime.now(timezone.utc)


def estimate_route(origin: LatLng, destination: LatLng, departure: datetime | None = None) -> RouteEstimate:
    return _heuristic.estimate(origin, destination, departure or _now())


def estimate_routes_from(
    origin: LatLng, destinations: Mapping[str, LatLng], departure: datetime | None = None
) -> dict[str, RouteEstimate]:
    departure = departure or _now()
    return {key: _heuristic.estimate(origin, point, departure) for key, point in destinations.items()}


async def calculate_route(
    origin: LatLng, destination: LatLng, departure: datetime | None = None
) -> RouteEstimate:
    departure = departure or _now()
    provider = get_provider()
    key = RouteCache.key(provider.name, origin, destination, departure)
    cached = _cache.get(key)
    if cached is not None:
        return cached
    estimate = await provider.route(origin, destination, departure)
    _cache.set(key, estimate)
    return estimate
