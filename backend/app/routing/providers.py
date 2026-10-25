"""Route providers.

Every provider returns the same RouteEstimate, so matching, dispatch and the
/routes/calculate endpoint never care which engine produced a route.

- HeuristicRouteProvider: deterministic, no network. Straight-line distance x
  circuity factor, free-flow speed from the cited TomTom figure, congestion from
  traffic.py. Always available; the default and the fallback.
- OSRMRouteProvider: real road distance and geometry from an OSRM server (the
  public demo server needs no key but is for light use only; self-host for
  anything heavier). OSRM durations do not include traffic, so the congestion
  model is applied on top.
- TomTomRouteProvider: live traffic (traffic=true). Needs an API key. Written
  against TomTom's Calculate Route documentation and unit-tested with recorded
  response shapes, but not yet exercised against the live API.
- FallbackRouteProvider: any failure of the primary silently degrades to the
  heuristic, and the estimate's `provider` field says so.
"""
from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Protocol

import httpx

from app.routing.geo import LatLng, encode_polyline, haversine_km, interpolate_line
from app.routing.traffic import FREE_FLOW_MIN_PER_KM, TrafficModel, congestion_multiplier

logger = logging.getLogger(__name__)


TrafficSource = Literal["live", "time_of_day_model", "city_average_model", "none"]

# How the congestion in traffic_duration_minutes was obtained, per traffic model.
MODEL_TRAFFIC_SOURCE: dict[TrafficModel, TrafficSource] = {
    "time_of_day": "time_of_day_model",
    "city_average": "city_average_model",
    "free_flow": "none",  # no congestion applied: the ETA is free-flow time
}


def _iso_z(dt: datetime) -> str:
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.isoformat(timespec="seconds") + "Z"


@dataclass(frozen=True)
class RouteEstimate:
    distance_km: float
    duration_minutes: float  # without traffic (free-flow / provider base time)
    traffic_duration_minutes: float  # expected with traffic at departure_time
    geometry: str  # encoded polyline, precision 5
    provider: str  # which engine actually produced this estimate
    departure_time: datetime
    traffic_source: TrafficSource  # where the congestion in traffic_duration_minutes came from
    traffic_segments: list[dict[str, Any]] = field(default_factory=list)

    @property
    def eta_minutes(self) -> float:
        return self.traffic_duration_minutes

    @property
    def traffic_aware(self) -> bool:
        """True only when live traffic data produced the ETA (TomTom)."""
        return self.traffic_source == "live"

    def to_dict(self) -> dict[str, Any]:
        """HTTP shape (contract §6 plus additive fields). `duration_minutes` is the
        ETA including congestion, as in the contract. `traffic_source` says how that
        congestion was obtained: live data, one of the models, or "none" (free-flow);
        consumers must not apply their own congestion on top."""
        out = {
            "distance_km": round(self.distance_km, 1),
            "duration_minutes": round(self.traffic_duration_minutes, 1),
            "geometry": self.geometry,
            "traffic_aware": self.traffic_aware,
            # Additive (see docs/person5-contract-additions.md)
            "traffic_source": self.traffic_source,
            "free_flow_duration_minutes": round(self.duration_minutes, 1),
            "provider": self.provider,
            "departure_time": _iso_z(self.departure_time),
        }
        if self.traffic_segments:
            out["traffic_segments"] = self.traffic_segments
        return out


class RoutingProviderError(RuntimeError):
    """Raised by network providers; FallbackRouteProvider catches it."""


class RouteProvider(Protocol):
    name: str

    async def route(self, origin: LatLng, destination: LatLng, departure: datetime) -> RouteEstimate:
        ...

    async def route_multi(self, waypoints: list[LatLng], departure: datetime) -> RouteEstimate:
        ...


def _checked(value: Any, label: str) -> float:
    number = float(value)
    if not math.isfinite(number) or number < 0:
        raise RoutingProviderError(f"invalid {label} in provider response")
    return number


class HeuristicRouteProvider:
    name = "heuristic"

    def __init__(
        self,
        circuity_factor: float = 1.3,
        traffic_model: TrafficModel = "time_of_day",
        geometry_segments: int = 8,
    ) -> None:
        self.circuity_factor = circuity_factor
        self.traffic_model = traffic_model
        self.geometry_segments = geometry_segments

    def estimate(self, origin: LatLng, destination: LatLng, departure: datetime) -> RouteEstimate:
        road_km = haversine_km(origin, destination) * self.circuity_factor
        free_flow = road_km * FREE_FLOW_MIN_PER_KM
        return RouteEstimate(
            distance_km=road_km,
            duration_minutes=free_flow,
            traffic_duration_minutes=free_flow * congestion_multiplier(departure, self.traffic_model),
            # A straight line; the UI draws it dashed so nobody mistakes it for a road path.
            geometry=encode_polyline(interpolate_line(origin, destination, self.geometry_segments)),
            provider=self.name,
            departure_time=departure,
            traffic_source=MODEL_TRAFFIC_SOURCE[self.traffic_model],
        )

    def estimate_multi(self, waypoints: list[LatLng], departure: datetime) -> RouteEstimate:
        """Stitch multiple straight-line segments into a single estimate."""
        if len(waypoints) < 2:
            raise ValueError("estimate_multi requires at least 2 waypoints")
        total_km = 0.0
        all_points: list[LatLng] = []
        for i in range(len(waypoints) - 1):
            seg_km = haversine_km(waypoints[i], waypoints[i + 1]) * self.circuity_factor
            total_km += seg_km
            seg_points = interpolate_line(waypoints[i], waypoints[i + 1], self.geometry_segments)
            # Avoid duplicate junction points between segments
            if all_points:
                seg_points = seg_points[1:]
            all_points.extend(seg_points)
        free_flow = total_km * FREE_FLOW_MIN_PER_KM
        return RouteEstimate(
            distance_km=total_km,
            duration_minutes=free_flow,
            traffic_duration_minutes=free_flow * congestion_multiplier(departure, self.traffic_model),
            geometry=encode_polyline(all_points),
            provider=self.name,
            departure_time=departure,
            traffic_source=MODEL_TRAFFIC_SOURCE[self.traffic_model],
        )

    async def route(self, origin: LatLng, destination: LatLng, departure: datetime) -> RouteEstimate:
        return self.estimate(origin, destination, departure)

    async def route_multi(self, waypoints: list[LatLng], departure: datetime) -> RouteEstimate:
        return self.estimate_multi(waypoints, departure)


class OSRMRouteProvider:
    name = "osrm"

    def __init__(
        self,
        base_url: str,
        timeout_seconds: float = 4.0,
        traffic_model: TrafficModel = "time_of_day",
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.traffic_model = traffic_model
        self._transport = transport

    async def _fetch_osrm(self, waypoints: list[LatLng], departure: datetime) -> RouteEstimate:
        """Shared OSRM fetch logic for both single-leg and multi-leg routes."""
        # OSRM wants lng,lat order.
        coords = ";".join(f"{p[1]:.6f},{p[0]:.6f}" for p in waypoints)
        params = {"overview": "full", "geometries": "polyline", "alternatives": "false", "steps": "false"}
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds, transport=self._transport) as client:
                response = await client.get(f"{self.base_url}/route/v1/driving/{coords}", params=params)
        except httpx.HTTPError as exc:
            raise RoutingProviderError(f"OSRM request failed: {type(exc).__name__}") from exc
        if response.status_code != 200:
            raise RoutingProviderError(f"OSRM returned HTTP {response.status_code}")
        body = response.json()
        routes = body.get("routes") or []
        if body.get("code") != "Ok" or not routes:
            raise RoutingProviderError(f"OSRM returned code {body.get('code')!r}")
        best = routes[0]
        base_minutes = _checked(best.get("duration"), "duration") / 60
        fallback_geom = encode_polyline(waypoints)
        return RouteEstimate(
            distance_km=_checked(best.get("distance"), "distance") / 1000,
            duration_minutes=base_minutes,
            traffic_duration_minutes=base_minutes * congestion_multiplier(departure, self.traffic_model),
            geometry=best.get("geometry") or fallback_geom,
            provider=self.name,
            departure_time=departure,
            traffic_source=MODEL_TRAFFIC_SOURCE[self.traffic_model],
        )

    async def route(self, origin: LatLng, destination: LatLng, departure: datetime) -> RouteEstimate:
        return await self._fetch_osrm([origin, destination], departure)

    async def route_multi(self, waypoints: list[LatLng], departure: datetime) -> RouteEstimate:
        return await self._fetch_osrm(waypoints, departure)


class TomTomRouteProvider:
    name = "tomtom"

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.tomtom.com",
        timeout_seconds: float = 8.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not api_key:
            raise ValueError("TomTom provider needs ROUTING_TOMTOM_API_KEY")
        self._api_key = api_key.strip().strip("'\"")
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self._transport = transport

    async def _fetch_tomtom(self, waypoints: list[LatLng], departure: datetime) -> RouteEstimate:
        """Shared TomTom fetch logic for both single-leg and multi-leg routes.

        TomTom's calculateRoute endpoint accepts colon-separated lat,lon pairs,
        so driver:pickup:dropoff is a single request with two legs.
        """
        # Deduplicate consecutive points too close to each other (~22 m)
        deduped: list[LatLng] = [waypoints[0]]
        for wp in waypoints[1:]:
            last = deduped[-1]
            if abs(wp[0] - last[0]) > 0.0002 or abs(wp[1] - last[1]) > 0.0002:
                deduped.append(wp)
        if len(deduped) < 2:
            deduped = [waypoints[0], (waypoints[-1][0] + 0.0003, waypoints[-1][1] + 0.0003)]

        locations = ":".join(f"{p[0]:.6f},{p[1]:.6f}" for p in deduped)
        params = {
            "key": self._api_key,
            "traffic": "true",
            "travelMode": "car",
            "routeType": "fastest",
            "computeTravelTimeFor": "all",
            "sectionType": "traffic",
        }
        aware = departure if departure.tzinfo else departure.replace(tzinfo=timezone.utc)
        if aware > datetime.now(timezone.utc) + timedelta(minutes=1):
            params["departAt"] = aware.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds, transport=self._transport) as client:
                response = await client.get(
                    f"{self.base_url}/routing/1/calculateRoute/{locations}/json", params=params
                )
        except httpx.HTTPError as exc:
            # Never include the URL: it carries the API key.
            raise RoutingProviderError(f"TomTom request failed: {type(exc).__name__}") from exc
        if response.status_code != 200:
            err_text = response.text[:200]
            logger.warning("TomTom returned HTTP %s: %s", response.status_code, err_text)
            raise RoutingProviderError(f"TomTom returned HTTP {response.status_code}: {err_text}")
        routes = response.json().get("routes") or []
        if not routes:
            raise RoutingProviderError("TomTom returned no routes")
        summary = routes[0].get("summary") or {}
        with_traffic = _checked(summary.get("travelTimeInSeconds"), "travelTimeInSeconds") / 60
        if summary.get("noTrafficTravelTimeInSeconds") is not None:
            without_traffic = _checked(summary["noTrafficTravelTimeInSeconds"], "noTrafficTravelTime") / 60
        else:
            delay = float(summary.get("trafficDelayInSeconds") or 0) / 60
            without_traffic = max(0.0, with_traffic - delay)
        points: list[LatLng] = [
            (float(p["latitude"]), float(p["longitude"]))
            for leg in routes[0].get("legs") or []
            for p in leg.get("points") or []
        ]
        fallback_geom = encode_polyline(waypoints)

        traffic_segments: list[dict[str, Any]] = []
        for sec in routes[0].get("sections") or []:
            if sec.get("sectionType") == "TRAFFIC":
                start_idx = sec.get("startPointIndex", 0)
                end_idx = min(len(points), (sec.get("endPointIndex", start_idx) + 1))
                seg_pts = points[start_idx:end_idx]
                if len(seg_pts) > 1:
                    cat = str(sec.get("simpleCategory") or "").upper()
                    delay = float(sec.get("delayInSeconds") or 0)
                    severity = "jam" if (cat == "JAM" or delay >= 120) else "slow"
                    traffic_segments.append({
                        "points": [[p[0], p[1]] for p in seg_pts],
                        "severity": severity,
                        "delay_seconds": round(delay),
                        "speed_kmh": sec.get("effectiveSpeedInKmh"),
                    })

        return RouteEstimate(
            distance_km=_checked(summary.get("lengthInMeters"), "lengthInMeters") / 1000,
            duration_minutes=without_traffic,
            traffic_duration_minutes=with_traffic,
            geometry=encode_polyline(points) if points else fallback_geom,
            provider=self.name,
            departure_time=departure,
            traffic_source="live",
            traffic_segments=traffic_segments,
        )

    async def route(self, origin: LatLng, destination: LatLng, departure: datetime) -> RouteEstimate:
        return await self._fetch_tomtom([origin, destination], departure)

    async def route_multi(self, waypoints: list[LatLng], departure: datetime) -> RouteEstimate:
        return await self._fetch_tomtom(waypoints, departure)


class FallbackRouteProvider:
    def __init__(self, primary: RouteProvider, fallback: HeuristicRouteProvider) -> None:
        self.primary = primary
        self.fallback = fallback
        self.name = primary.name

    async def route(self, origin: LatLng, destination: LatLng, departure: datetime) -> RouteEstimate:
        try:
            return await self.primary.route(origin, destination, departure)
        except Exception as exc:  # noqa: BLE001 - any provider problem degrades, never breaks dispatch
            logger.warning(
                "routing provider %s failed (%s); using heuristic estimate", self.primary.name, exc
            )
            return self.fallback.estimate(origin, destination, departure)

    async def route_multi(self, waypoints: list[LatLng], departure: datetime) -> RouteEstimate:
        try:
            return await self.primary.route_multi(waypoints, departure)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "routing provider %s multi-leg failed (%s); using heuristic estimate", self.primary.name, exc
            )
            return self.fallback.estimate_multi(waypoints, departure)


class ChainedRouteProvider:
    """Tries primary (TomTom live traffic) -> secondary (OSRM road model) -> fallback (heuristic)."""

    def __init__(
        self, primary: RouteProvider, secondary: RouteProvider, fallback: HeuristicRouteProvider
    ) -> None:
        self.primary = primary
        self.secondary = secondary
        self.fallback = fallback
        self.name = primary.name

    async def route(self, origin: LatLng, destination: LatLng, departure: datetime) -> RouteEstimate:
        try:
            return await self.primary.route(origin, destination, departure)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "primary routing provider %s failed (%s); falling back to %s",
                self.primary.name,
                exc,
                self.secondary.name,
            )
            try:
                return await self.secondary.route(origin, destination, departure)
            except Exception as exc2:  # noqa: BLE001
                logger.warning(
                    "secondary routing provider %s failed (%s); using heuristic estimate",
                    self.secondary.name,
                    exc2,
                )
                return self.fallback.estimate(origin, destination, departure)

    async def route_multi(self, waypoints: list[LatLng], departure: datetime) -> RouteEstimate:
        try:
            return await self.primary.route_multi(waypoints, departure)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "primary routing provider %s multi-leg failed (%s); falling back to %s",
                self.primary.name,
                exc,
                self.secondary.name,
            )
            try:
                return await self.secondary.route_multi(waypoints, departure)
            except Exception as exc2:  # noqa: BLE001
                logger.warning(
                    "secondary routing provider %s multi-leg failed (%s); using heuristic estimate",
                    self.secondary.name,
                    exc2,
                )
                return self.fallback.estimate_multi(waypoints, departure)



class RouteCache:
    """Tiny TTL cache so dashboard refreshes don't re-hit a network provider.

    Keyed on ~11 m rounding of both endpoints and a 5-minute departure bucket
    (congestion doesn't change meaningfully inside five minutes).
    """

    def __init__(self, ttl_seconds: float = 120.0, max_entries: int = 512, clock=time.monotonic) -> None:
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._clock = clock
        self._entries: dict[tuple, tuple[float, RouteEstimate]] = {}

    @staticmethod
    def key(provider: str, origin: LatLng, destination: LatLng, departure: datetime) -> tuple:
        aware = departure if departure.tzinfo else departure.replace(tzinfo=timezone.utc)
        return (
            provider,
            round(origin[0], 4),
            round(origin[1], 4),
            round(destination[0], 4),
            round(destination[1], 4),
            int(aware.timestamp() // 300),
        )

    def get(self, key: tuple) -> RouteEstimate | None:
        if self.ttl_seconds <= 0:
            return None
        hit = self._entries.get(key)
        if hit is None:
            return None
        stored_at, estimate = hit
        if self._clock() - stored_at > self.ttl_seconds:
            self._entries.pop(key, None)
            return None
        return estimate

    def set(self, key: tuple, estimate: RouteEstimate) -> None:
        if self.ttl_seconds <= 0:
            return
        if len(self._entries) >= self.max_entries:
            self._entries.pop(next(iter(self._entries)))  # evict oldest insertion
        self._entries[key] = (self._clock(), estimate)

    def clear(self) -> None:
        self._entries.clear()
