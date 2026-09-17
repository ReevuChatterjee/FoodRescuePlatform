"""Geographic helpers shared by routing, dispatch and (on request) analytics.

Person 6 asked for a haversine utility for `route_distance_saved_km`; it lives
here so there is exactly one implementation in the codebase.
"""
from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Any

LatLng = tuple[float, float]  # (latitude, longitude), WGS-84 degrees

EARTH_RADIUS_KM = 6371.0088  # IUGG mean Earth radius


def is_valid_latlng(latitude: float, longitude: float) -> bool:
    return (
        math.isfinite(latitude)
        and math.isfinite(longitude)
        and -90.0 <= latitude <= 90.0
        and -180.0 <= longitude <= 180.0
    )


def haversine_km(a: LatLng, b: LatLng) -> float:
    """Great-circle distance in km between two (lat, lng) points."""
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(h)))


def parse_latlng(value: Any) -> LatLng | None:
    """Normalise every location shape currently stored in this codebase.

    - "lat,lng" strings: NGO.location, Donor.location, Vehicle.current_location
    - {"latitude": .., "longitude": ..} dicts: Donation.pickup_location
    - (lat, lng) tuples/lists

    Returns None for empty, malformed or out-of-range input rather than raising,
    because a missing location should make a candidate ineligible, not crash a
    dispatch run.
    """
    lat: Any
    lng: Any
    if value is None:
        return None
    if isinstance(value, str):
        parts = value.split(",")
        if len(parts) != 2:
            return None
        lat, lng = parts[0].strip(), parts[1].strip()
    elif isinstance(value, dict):
        lat, lng = value.get("latitude"), value.get("longitude")
    elif isinstance(value, (tuple, list)) and len(value) == 2:
        lat, lng = value
    else:
        return None
    try:
        lat_f, lng_f = float(lat), float(lng)
    except (TypeError, ValueError):
        return None
    return (lat_f, lng_f) if is_valid_latlng(lat_f, lng_f) else None


def format_latlng(point: LatLng) -> str:
    """Inverse of parse_latlng for the "lat,lng" string columns."""
    return f"{point[0]:.6f},{point[1]:.6f}"


def interpolate_line(a: LatLng, b: LatLng, segments: int) -> list[LatLng]:
    """Evenly spaced points from a to b (inclusive), `segments` intervals."""
    segments = max(1, segments)
    return [
        (a[0] + (b[0] - a[0]) * i / segments, a[1] + (b[1] - a[1]) * i / segments)
        for i in range(segments + 1)
    ]


def _round_half_up(x: float) -> int:
    # Matches JavaScript Math.round, which the reference polyline encoder uses.
    return math.floor(x + 0.5)


def encode_polyline(points: Sequence[LatLng], precision: int = 5) -> str:
    """Google encoded polyline algorithm (precision 5 = OSRM/Leaflet default)."""
    factor = 10**precision
    out: list[str] = []
    prev_lat = prev_lng = 0
    for lat, lng in points:
        ilat, ilng = _round_half_up(lat * factor), _round_half_up(lng * factor)
        for delta in (ilat - prev_lat, ilng - prev_lng):
            value = ~(delta << 1) if delta < 0 else delta << 1
            while value >= 0x20:
                out.append(chr((0x20 | (value & 0x1F)) + 63))
                value >>= 5
            out.append(chr(value + 63))
        prev_lat, prev_lng = ilat, ilng
    return "".join(out)


def decode_polyline(encoded: str, precision: int = 5) -> list[LatLng]:
    factor = 10**precision
    points: list[LatLng] = []
    index = lat = lng = 0
    length = len(encoded)
    while index < length:
        deltas = []
        for _ in range(2):
            shift = result = 0
            while True:
                if index >= length:
                    raise ValueError("truncated polyline")
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            deltas.append(~(result >> 1) if result & 1 else result >> 1)
        lat += deltas[0]
        lng += deltas[1]
        points.append((lat / factor, lng / factor))
    return points
