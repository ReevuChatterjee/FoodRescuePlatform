"""Person 5 routing unit tests: geo helpers, congestion model, providers (mocked
HTTP), cache, service wiring and the POST /api/v1/routes/calculate shape.

No database or network needed.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pytest
from httpx import AsyncClient

from app.auth.dependencies import get_current_user
from app.main import app
from app.models import User, UserRole
from app.routing import service as routing_service
from app.routing.geo import (
    decode_polyline,
    encode_polyline,
    format_latlng,
    haversine_km,
    interpolate_line,
    parse_latlng,
)
from app.routing.providers import (
    FallbackRouteProvider,
    HeuristicRouteProvider,
    OSRMRouteProvider,
    RouteCache,
    RouteEstimate,
    RoutingProviderError,
    TomTomRouteProvider,
)
from app.routing.traffic import (
    AVERAGE_CONGESTION_RATIO,
    CITY_AVERAGE_MIN_PER_KM,
    FREE_FLOW_MIN_PER_KM,
    IST,
    congestion_multiplier,
)

UTC = timezone.utc
KORAMANGALA = (12.9352, 77.6245)
NGO_017 = (12.9345, 77.6104)
A, B = (12.9, 77.6), (12.95, 77.62)
MORNING = datetime(2026, 9, 17, 4, 0, tzinfo=UTC)  # 09:30 IST

HTTP_KEYS = {
    "distance_km", "duration_minutes", "geometry", "traffic_aware",
    "traffic_source", "free_flow_duration_minutes", "provider", "departure_time",
}


def estimate(provider: str = "heuristic", **overrides) -> RouteEstimate:
    fields = {
        "distance_km": 5.44, "duration_minutes": 11.26, "traffic_duration_minutes": 19.64,
        "geometry": "abc", "provider": provider, "departure_time": MORNING,
    }
    fields.update(overrides)
    return RouteEstimate(**fields)


# ─── geo ────────────────────────────────────────────────────────────────────

def test_haversine_one_degree_of_latitude():
    assert haversine_km((0.0, 0.0), (1.0, 0.0)) == pytest.approx(111.195, abs=0.01)


def test_haversine_is_symmetric_and_zero_for_same_point():
    assert haversine_km(KORAMANGALA, NGO_017) == pytest.approx(haversine_km(NGO_017, KORAMANGALA))
    assert haversine_km(KORAMANGALA, KORAMANGALA) == 0.0
    assert haversine_km(KORAMANGALA, NGO_017) == pytest.approx(1.53, abs=0.01)


@pytest.mark.parametrize(
    "value, expected",
    [
        ("12.9,77.6", (12.9, 77.6)),
        (" 12.9 , 77.6 ", (12.9, 77.6)),
        ({"latitude": 12.9, "longitude": 77.6, "address": "x"}, (12.9, 77.6)),
        ({"latitude": "12.9", "longitude": "77.6"}, (12.9, 77.6)),
        ((12.9, 77.6), (12.9, 77.6)),
        ([12.9, 77.6], (12.9, 77.6)),
        (None, None),
        ("", None),
        ("x", None),
        ("1,2,3", None),
        ("abc,77.6", None),
        ({"latitude": 91, "longitude": 0}, None),
        ({"latitude": 0, "longitude": -181}, None),
        ({"latitude": None, "longitude": 1}, None),
        ("nan,77.6", None),
        (12.9, None),
    ],
)
def test_parse_latlng_accepts_stored_shapes_and_rejects_bad_input(value, expected):
    assert parse_latlng(value) == expected


def test_format_latlng_round_trips_through_parse():
    assert parse_latlng(format_latlng(KORAMANGALA)) == KORAMANGALA


def test_polyline_matches_google_reference_vector():
    points = [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]
    assert encode_polyline(points) == "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
    assert decode_polyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@") == points


def test_polyline_round_trip_and_truncation():
    line = interpolate_line(KORAMANGALA, NGO_017, 8)
    assert len(line) == 9 and line[0] == KORAMANGALA and line[-1] == NGO_017
    decoded = decode_polyline(encode_polyline(line))
    assert len(decoded) == len(line)
    # Half-up rounding (JS Math.round) at precision 5, so within 1e-5 of the input.
    assert all(
        abs(d[0] - p[0]) <= 1e-5 and abs(d[1] - p[1]) <= 1e-5 for d, p in zip(decoded, line)
    )
    with pytest.raises(ValueError):
        decode_polyline("_p~iF~ps|")


# ─── traffic model ──────────────────────────────────────────────────────────

def test_sourced_constants():
    assert FREE_FLOW_MIN_PER_KM == pytest.approx(124 / 60)
    assert CITY_AVERAGE_MIN_PER_KM == pytest.approx(217 / 60)


def test_daily_mean_multiplier_equals_sourced_city_average():
    start = datetime(2026, 9, 17, tzinfo=UTC)
    minutes = [congestion_multiplier(start + timedelta(minutes=m)) for m in range(1440)]
    assert sum(minutes) / len(minutes) == pytest.approx(AVERAGE_CONGESTION_RATIO, abs=1e-3)
    assert min(minutes) >= 1.0


def test_peak_is_busier_than_night_in_local_time():
    peak = datetime(2026, 9, 17, 9, 0, tzinfo=IST)
    night = datetime(2026, 9, 17, 3, 0, tzinfo=IST)
    assert congestion_multiplier(peak) > AVERAGE_CONGESTION_RATIO > congestion_multiplier(night)


def test_naive_datetimes_are_treated_as_utc():
    aware = datetime(2026, 9, 17, 3, 30, tzinfo=UTC)
    assert congestion_multiplier(aware.replace(tzinfo=None)) == congestion_multiplier(aware)


def test_flat_traffic_models():
    assert congestion_multiplier(MORNING, "free_flow") == 1.0
    assert congestion_multiplier(MORNING, "city_average") == AVERAGE_CONGESTION_RATIO


# ─── heuristic provider ─────────────────────────────────────────────────────

def test_heuristic_estimate_numbers():
    est = HeuristicRouteProvider(circuity_factor=1.3).estimate(KORAMANGALA, NGO_017, MORNING)
    road_km = haversine_km(KORAMANGALA, NGO_017) * 1.3
    assert est.distance_km == pytest.approx(road_km)
    assert est.duration_minutes == pytest.approx(road_km * FREE_FLOW_MIN_PER_KM)
    assert est.traffic_duration_minutes == pytest.approx(
        est.duration_minutes * congestion_multiplier(MORNING)
    )
    assert est.eta_minutes == est.traffic_duration_minutes
    assert est.provider == "heuristic"
    decoded = decode_polyline(est.geometry)
    assert decoded[0] == KORAMANGALA and decoded[-1] == NGO_017


async def test_heuristic_route_equals_estimate():
    provider = HeuristicRouteProvider()
    assert await provider.route(A, B, MORNING) == provider.estimate(A, B, MORNING)


# ─── OSRM ───────────────────────────────────────────────────────────────────

async def test_osrm_parses_response_and_uses_lng_lat_order():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return httpx.Response(200, json={
            "code": "Ok", "routes": [{"distance": 5400.0, "duration": 660.0, "geometry": "abc"}],
        })

    osrm = OSRMRouteProvider("http://osrm.test/", transport=httpx.MockTransport(handler))
    est = await osrm.route(A, B, MORNING)
    assert "/route/v1/driving/77.600000,12.900000;77.620000,12.950000" in seen["url"]
    assert est.distance_km == pytest.approx(5.4)
    assert est.duration_minutes == pytest.approx(11.0)
    assert est.traffic_duration_minutes == pytest.approx(11.0 * congestion_multiplier(MORNING))
    assert est.geometry == "abc" and est.provider == "osrm"


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(503),
        httpx.Response(200, json={"code": "NoRoute", "routes": []}),
        httpx.Response(200, json={"code": "Ok", "routes": [{"distance": -1, "duration": 60}]}),
        httpx.Response(200, json={"code": "Ok", "routes": [{"distance": 10, "duration": "nan"}]}),
    ],
)
async def test_osrm_bad_responses_raise_provider_error(response):
    osrm = OSRMRouteProvider("http://osrm.test", transport=httpx.MockTransport(lambda r: response))
    with pytest.raises(RoutingProviderError):
        await osrm.route(A, B, MORNING)


async def test_osrm_network_error_raises_provider_error():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom", request=request)

    osrm = OSRMRouteProvider("http://osrm.test", transport=httpx.MockTransport(handler))
    with pytest.raises(RoutingProviderError):
        await osrm.route(A, B, MORNING)


# ─── TomTom ─────────────────────────────────────────────────────────────────

TOMTOM_BODY = {"routes": [{
    "summary": {"lengthInMeters": 6100, "travelTimeInSeconds": 1500, "noTrafficTravelTimeInSeconds": 900},
    "legs": [{"points": [{"latitude": 12.9, "longitude": 77.6}, {"latitude": 12.95, "longitude": 77.62}]}],
}]}


async def test_tomtom_parses_live_traffic_response():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = request.url
        return httpx.Response(200, json=TOMTOM_BODY)

    tomtom = TomTomRouteProvider("KEY123", transport=httpx.MockTransport(handler))
    est = await tomtom.route(A, B, datetime.now(UTC))
    assert est.distance_km == pytest.approx(6.1)
    assert est.traffic_duration_minutes == 25 and est.duration_minutes == 15
    assert decode_polyline(est.geometry) == [A, B]
    assert est.provider == "tomtom" and est.traffic_aware
    assert seen["url"].params["traffic"] == "true"
    assert "departAt" not in seen["url"].params  # "now" departures use live traffic
    assert "/calculateRoute/12.900000,77.600000:12.950000,77.620000/json" in seen["url"].path


async def test_tomtom_future_departure_and_delay_fallback():
    seen: dict = {}
    body = {"routes": [{"summary": {"lengthInMeters": 1000, "travelTimeInSeconds": 600,
                                    "trafficDelayInSeconds": 240}}]}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = request.url
        return httpx.Response(200, json=body)

    tomtom = TomTomRouteProvider("KEY123", transport=httpx.MockTransport(handler))
    est = await tomtom.route(A, B, datetime.now(UTC) + timedelta(hours=2))
    assert "departAt" in seen["url"].params
    assert est.traffic_duration_minutes == 10 and est.duration_minutes == 6
    assert decode_polyline(est.geometry) == [A, B]  # no points: straight fallback geometry


@pytest.mark.parametrize("status", [403, 500])
async def test_tomtom_errors_never_leak_the_api_key(status):
    tomtom = TomTomRouteProvider("SECRET_KEY", transport=httpx.MockTransport(lambda r: httpx.Response(status)))
    with pytest.raises(RoutingProviderError) as error:
        await tomtom.route(A, B, MORNING)
    assert "SECRET_KEY" not in str(error.value)


async def test_tomtom_network_error_never_leaks_the_api_key():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"failed {request.url}", request=request)

    tomtom = TomTomRouteProvider("SECRET_KEY", transport=httpx.MockTransport(handler))
    with pytest.raises(RoutingProviderError) as error:
        await tomtom.route(A, B, MORNING)
    assert "SECRET_KEY" not in str(error.value)


def test_tomtom_requires_key():
    with pytest.raises(ValueError):
        TomTomRouteProvider("")


# ─── fallback ───────────────────────────────────────────────────────────────

async def test_fallback_degrades_to_heuristic_on_failure():
    failing = OSRMRouteProvider("http://osrm.test", transport=httpx.MockTransport(lambda r: httpx.Response(503)))
    heuristic = HeuristicRouteProvider()
    fallback = FallbackRouteProvider(failing, heuristic)
    assert fallback.name == "osrm"
    est = await fallback.route(A, B, MORNING)
    assert est == heuristic.estimate(A, B, MORNING)
    assert est.provider == "heuristic" and not est.traffic_aware


async def test_fallback_passes_through_primary_success():
    body = {"code": "Ok", "routes": [{"distance": 1000.0, "duration": 120.0, "geometry": "g"}]}
    osrm = OSRMRouteProvider("http://osrm.test", transport=httpx.MockTransport(lambda r: httpx.Response(200, json=body)))
    est = await FallbackRouteProvider(osrm, HeuristicRouteProvider()).route(A, B, MORNING)
    assert est.provider == "osrm"


# ─── HTTP serialization ─────────────────────────────────────────────────────

def test_to_dict_keeps_contract_fields_and_meaning():
    data = estimate().to_dict()
    assert set(data) == HTTP_KEYS
    assert data["distance_km"] == 5.4
    assert data["duration_minutes"] == 19.6  # contract: ETA including congestion
    assert data["free_flow_duration_minutes"] == 11.3
    assert data["traffic_aware"] is False
    assert data["traffic_source"] == "time_of_day_model"
    assert data["geometry"] == "abc"
    assert data["departure_time"] == "2026-09-17T04:00:00Z"


@pytest.mark.parametrize(
    "provider, aware, source",
    [("heuristic", False, "time_of_day_model"), ("osrm", False, "time_of_day_model"), ("tomtom", True, "live")],
)
def test_traffic_aware_only_for_live_traffic(provider, aware, source):
    data = estimate(provider).to_dict()
    assert data["traffic_aware"] is aware and data["traffic_source"] == source


def test_to_dict_converts_offset_departure_to_utc_z():
    data = estimate(departure_time=datetime(2026, 9, 17, 9, 30, tzinfo=IST)).to_dict()
    assert data["departure_time"] == "2026-09-17T04:00:00Z"


# ─── cache ──────────────────────────────────────────────────────────────────

def test_cache_expires_after_ttl():
    clock = [0.0]
    cache = RouteCache(ttl_seconds=10, clock=lambda: clock[0])
    key = RouteCache.key("heuristic", A, B, MORNING)
    cache.set(key, estimate())
    clock[0] = 10
    assert cache.get(key) == estimate()
    clock[0] = 10.1
    assert cache.get(key) is None


def test_cache_disabled_with_zero_ttl():
    cache = RouteCache(ttl_seconds=0)
    key = RouteCache.key("heuristic", A, B, MORNING)
    cache.set(key, estimate())
    assert cache.get(key) is None


def test_cache_evicts_oldest_when_full():
    cache = RouteCache(ttl_seconds=60, max_entries=2)
    keys = [RouteCache.key("heuristic", A, (12.0 + i, 77.0), MORNING) for i in range(3)]
    for key in keys:
        cache.set(key, estimate())
    assert cache.get(keys[0]) is None
    assert cache.get(keys[1]) is not None and cache.get(keys[2]) is not None


def test_cache_key_buckets_nearby_points_and_five_minutes():
    base = RouteCache.key("osrm", A, B, MORNING)
    assert RouteCache.key("osrm", (12.90001, 77.60001), B, MORNING + timedelta(minutes=4)) == base
    assert RouteCache.key("osrm", A, B, MORNING + timedelta(minutes=5)) != base
    assert RouteCache.key("tomtom", A, B, MORNING) != base
    assert RouteCache.key("osrm", A, B, MORNING.replace(tzinfo=None)) == base


# ─── service ────────────────────────────────────────────────────────────────

class CountingProvider:
    name = "counting"

    def __init__(self) -> None:
        self.calls = 0

    async def route(self, origin, destination, departure):
        self.calls += 1
        return estimate(self.name, departure_time=departure)


@pytest.fixture
def counting_provider():
    provider = CountingProvider()
    routing_service.configure(provider)
    yield provider
    routing_service.configure(None)


async def test_calculate_route_uses_configured_provider_and_caches(counting_provider):
    first = await routing_service.calculate_route(A, B, MORNING)
    second = await routing_service.calculate_route(A, B, MORNING)
    assert first.provider == "counting" and first == second
    assert counting_provider.calls == 1
    await routing_service.calculate_route(B, A, MORNING)
    assert counting_provider.calls == 2


def test_default_provider_is_heuristic():
    routing_service.configure(None)
    assert routing_service.get_provider().name == "heuristic"


def test_estimate_routes_from_matches_single_estimates():
    routes = routing_service.estimate_routes_from(KORAMANGALA, {"ngo_017": NGO_017, "b": B}, MORNING)
    assert set(routes) == {"ngo_017", "b"}
    assert routes["ngo_017"] == routing_service.estimate_route(KORAMANGALA, NGO_017, MORNING)


def test_offer_route_summary_for_incoming_offers():
    expected = routing_service.estimate_route(KORAMANGALA, NGO_017, MORNING)
    summary = routing_service.offer_route_summary(
        {"latitude": KORAMANGALA[0], "longitude": KORAMANGALA[1], "address": "x"}, "12.9345,77.6104", MORNING
    )
    assert summary == {"eta_minutes": math.ceil(expected.eta_minutes), "distance_km": round(expected.distance_km, 1)}
    assert isinstance(summary["eta_minutes"], int)
    assert routing_service.offer_route_summary("bad", "12.9345,77.6104") == {"eta_minutes": None, "distance_km": None}
    assert routing_service.offer_route_summary(KORAMANGALA, None) == {"eta_minutes": None, "distance_km": None}


def test_build_provider_tomtom_without_key_falls_back_to_heuristic():
    from app.routing.settings import RoutingSettings

    heuristic = HeuristicRouteProvider()
    settings = RoutingSettings(provider="tomtom", tomtom_api_key=None)
    assert routing_service.build_provider(settings, heuristic) is heuristic
    osrm = routing_service.build_provider(RoutingSettings(provider="osrm"), heuristic)
    assert isinstance(osrm, FallbackRouteProvider) and osrm.name == "osrm"


# ─── fixture ────────────────────────────────────────────────────────────────

def test_sample_coordinates_fixture_is_consistent():
    path = Path(routing_service.__file__).parent / "fixtures" / "sample_coordinates.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    places = data["places"]
    assert all(parse_latlng(p) is not None for p in places.values())
    assert data["pairs"] and all(
        p["origin"] in places and p["destination"] in places for p in data["pairs"]
    )
    assert all(d["place"] in places and d["vehicle_capacity_kg"] > 0 for d in data["driver_starts"])
    assert places["koramangala"]["latitude"] == KORAMANGALA[0]


# ─── POST /api/v1/routes/calculate ──────────────────────────────────────────

@pytest.fixture
async def routes_client():
    user = User(id="usr_route", name="R", email="r@example.test", phone="0",
                password_hash="x", role=UserRole.DRIVER)
    app.dependency_overrides[get_current_user] = lambda: user
    routing_service.configure(None)
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


async def test_routes_calculate_response_shape(routes_client):
    body = {
        "origin": {"latitude": KORAMANGALA[0], "longitude": KORAMANGALA[1]},
        "destination": {"latitude": NGO_017[0], "longitude": NGO_017[1]},
        "departure_time": "2026-09-17T04:00:00Z",
    }
    response = await routes_client.post("/api/v1/routes/calculate", json=body)
    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"data", "meta"} and payload["meta"]["request_id"]
    data = payload["data"]
    assert set(data) == HTTP_KEYS
    expected = routing_service.estimate_route(KORAMANGALA, NGO_017, MORNING)
    assert data["distance_km"] == round(expected.distance_km, 1)
    assert data["duration_minutes"] == round(expected.traffic_duration_minutes, 1)
    assert data["free_flow_duration_minutes"] == round(expected.duration_minutes, 1)
    assert data["traffic_aware"] is False and data["traffic_source"] == "time_of_day_model"
    assert data["provider"] == "heuristic"
    assert data["departure_time"] == "2026-09-17T04:00:00Z"
    assert decode_polyline(data["geometry"])[0] == KORAMANGALA


async def test_routes_calculate_naive_departure_is_utc(routes_client):
    body = {
        "origin": {"latitude": A[0], "longitude": A[1]},
        "destination": {"latitude": B[0], "longitude": B[1]},
        "departure_time": "2026-09-17T04:00:00",
    }
    response = await routes_client.post("/api/v1/routes/calculate", json=body)
    assert response.json()["data"]["departure_time"] == "2026-09-17T04:00:00Z"


async def test_routes_calculate_defaults_departure_to_now(routes_client):
    body = {"origin": {"latitude": A[0], "longitude": A[1]}, "destination": {"latitude": B[0], "longitude": B[1]}}
    response = await routes_client.post("/api/v1/routes/calculate", json=body)
    assert response.status_code == 200
    departed = datetime.fromisoformat(response.json()["data"]["departure_time"].replace("Z", "+00:00"))
    assert abs((departed - datetime.now(UTC)).total_seconds()) < 60


async def test_routes_calculate_rejects_out_of_range_coordinates(routes_client):
    body = {"origin": {"latitude": 91, "longitude": 0}, "destination": {"latitude": 0, "longitude": 0}}
    response = await routes_client.post("/api/v1/routes/calculate", json=body)
    assert response.status_code in (400, 422)


async def test_routes_calculate_requires_auth():
    app.dependency_overrides.clear()
    async with AsyncClient(app=app, base_url="http://test") as client:
        body = {"origin": {"latitude": A[0], "longitude": A[1]}, "destination": {"latitude": B[0], "longitude": B[1]}}
        response = await client.post("/api/v1/routes/calculate", json=body)
    assert response.status_code in (401, 403)
