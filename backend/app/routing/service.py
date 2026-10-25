from __future__ import annotations
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
from app.core.time import IST

import asyncio
import logging
import math
from collections.abc import Mapping
from datetime import datetime, timezone

from app.routing.geo import LatLng, parse_latlng
from app.routing.providers import (
    ChainedRouteProvider,
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
    if settings.tomtom_api_key:
        osrm = OSRMRouteProvider(settings.osrm_base_url, settings.timeout_seconds, settings.traffic_model)
        tomtom = TomTomRouteProvider(
            settings.tomtom_api_key, settings.tomtom_base_url, settings.timeout_seconds
        )
        return ChainedRouteProvider(tomtom, osrm, heuristic)
    if settings.provider == "osrm":
        return FallbackRouteProvider(
            OSRMRouteProvider(settings.osrm_base_url, settings.timeout_seconds, settings.traffic_model),
            heuristic,
        )
    if settings.provider == "tomtom":
        logger.warning("ROUTING_PROVIDER=tomtom but ROUTING_TOMTOM_API_KEY is empty; using heuristic")
        return heuristic
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
    return datetime.now(IST)


def estimate_route(origin: LatLng, destination: LatLng, departure: datetime | None = None) -> RouteEstimate:
    return _heuristic.estimate(origin, destination, departure or _now())


def estimate_routes_from(
    origin: LatLng, destinations: Mapping[str, LatLng], departure: datetime | None = None
) -> dict[str, RouteEstimate]:
    departure = departure or _now()
    return {key: _heuristic.estimate(origin, point, departure) for key, point in destinations.items()}


async def calculate_routes_from(
    origin: LatLng, destinations: Mapping[str, LatLng], departure: datetime | None = None
) -> dict[str, RouteEstimate]:
    """Calculate routes from an origin to multiple destinations concurrently.

    If the configured provider is heuristic, uses the fast synchronous estimator.
    If the configured provider is network-backed (e.g. TomTom with live traffic),
    runs concurrent requests with individual error fallback to heuristic.
    """
    departure = departure or _now()
    provider = get_provider()

    # Short-circuit for heuristic provider
    if isinstance(provider, HeuristicRouteProvider):
        return estimate_routes_from(origin, destinations, departure)

    keys = list(destinations.keys())
    if not keys:
        return {}

    tasks = [calculate_route(origin, destinations[k], departure) for k in keys]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    out: dict[str, RouteEstimate] = {}
    for k, res in zip(keys, results):
        if isinstance(res, Exception) or res is None:
            logger.warning(
                "calculate_route failed for destination %s; falling back to heuristic: %s",
                k,
                res,
            )
            out[k] = _heuristic.estimate(origin, destinations[k], departure)
        else:
            out[k] = res
    return out


def offer_route_summary(
    pickup_location: object, ngo_location: object, departure: datetime | None = None
) -> dict[str, float | int | None]:
    """eta_minutes (int, with congestion) and distance_km (1 dp) from a donation's
    pickup to an NGO, for offer lists such as GET /ngos/{id}/incoming. Accepts any
    stored location shape; both fields are None when a location is unusable rather
    than inventing a number."""
    pickup, dropoff = parse_latlng(pickup_location), parse_latlng(ngo_location)
    if pickup is None or dropoff is None:
        return {"eta_minutes": None, "distance_km": None}
    route = estimate_route(pickup, dropoff, departure)
    return {"eta_minutes": math.ceil(route.eta_minutes), "distance_km": round(route.distance_km, 1)}


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


async def calculate_route_multi(
    waypoints: list[LatLng], departure: datetime | None = None
) -> RouteEstimate:
    """Traffic-aware multi-waypoint route (driver → pickup → dropoff).

    Uses the configured provider (TomTom → OSRM → heuristic) with a TTL cache.
    The cache key is built from the provider name, all waypoints, and a 5-minute
    departure bucket so dashboard refreshes don't re-hit the network provider.
    """
    if len(waypoints) < 2:
        raise ValueError("calculate_route_multi requires at least 2 waypoints")
    if len(waypoints) == 2:
        # Single-leg — use the standard single-route path (shares cache entries).
        return await calculate_route(waypoints[0], waypoints[1], departure)
    departure = departure or _now()
    provider = get_provider()
    # Build a composite cache key from the provider name + all waypoint coords.
    aware = departure if departure.tzinfo else departure.replace(tzinfo=timezone.utc)
    key: tuple = (
        provider.name,
        *[round(p[0], 4) for p in waypoints],
        *[round(p[1], 4) for p in waypoints],
        int(aware.timestamp() // 300),
    )
    cached = _cache.get(key)  # type: ignore[arg-type]
    if cached is not None:
        return cached
    estimate = await provider.route_multi(waypoints, departure)
    _cache.set(key, estimate)  # type: ignore[arg-type]
    return estimate
