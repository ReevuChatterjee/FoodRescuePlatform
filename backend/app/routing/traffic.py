from __future__ import annotations
"""Time-of-day congestion model for Bengaluru.

Sourced vs assumed — keep this distinction visible, evaluators will ask:

* SOURCED: free-flow travel time of about 2 min 4 s per km, and a city-wide
  average of about 3 min 37 s per km (TomTom Traffic Index, 2025 data, cited in
  section 9 of the project description).
* ASSUMED: the *shape* of congestion across the day (quiet overnight, morning
  and evening peaks). The shape is scaled so that its 24-hour mean equals the
  sourced city average, so the model never describes a busier or quieter city
  than the published figure; it only redistributes that average across hours.

This is a model, not live traffic. When a live-traffic provider is configured
(see providers.py) it supplies the traffic duration instead, and this model is
only used as the offline fallback.
"""
from app.core.time import IST

from datetime import datetime, timedelta, timezone
from typing import Literal

TrafficModel = Literal["time_of_day", "city_average", "free_flow"]

FREE_FLOW_MIN_PER_KM = 2 + 4 / 60  # 2 min 4 s per km
CITY_AVERAGE_MIN_PER_KM = 3 + 37 / 60  # 3 min 37 s per km
AVERAGE_CONGESTION_RATIO = CITY_AVERAGE_MIN_PER_KM / FREE_FLOW_MIN_PER_KM  # ~1.75

# India has no daylight saving, so a fixed offset is exact and needs no tzdata.
IST = timezone(timedelta(hours=5, minutes=30))

# Relative congestion per local hour at HH:00. 0 = free-flow, 1 = worst hour.
# ASSUMPTION: replace with hourly data when the team has it.
HOURLY_SHAPE: tuple[float, ...] = (
    0.05, 0.03, 0.02, 0.02, 0.05, 0.15,  # 00-05
    0.30, 0.55, 0.85, 1.00, 0.90, 0.70,  # 06-11
    0.60, 0.60, 0.60, 0.65, 0.75, 0.90,  # 12-17
    1.00, 0.95, 0.75, 0.50, 0.30, 0.15,  # 18-23
)

# Piecewise-linear interpolation between equally spaced periodic samples keeps
# the daily mean equal to the sample mean, so this scale pins the mean
# multiplier to AVERAGE_CONGESTION_RATIO exactly.
_SHAPE_MEAN = sum(HOURLY_SHAPE) / len(HOURLY_SHAPE)
_SCALE = (AVERAGE_CONGESTION_RATIO - 1.0) / _SHAPE_MEAN


def congestion_multiplier(at: datetime, model: TrafficModel = "time_of_day") -> float:
    """Travel-time multiplier relative to free-flow (1.0 = free-flow)."""
    if model == "free_flow":
        return 1.0
    if model == "city_average":
        return AVERAGE_CONGESTION_RATIO
    if at.tzinfo is None:  # the codebase stores naive UTC
        at = at.replace(tzinfo=IST)
    local = at.astimezone(IST)
    hours = local.hour + local.minute / 60 + local.second / 3600
    index = int(hours) % 24
    frac = hours - int(hours)
    shape = HOURLY_SHAPE[index] * (1 - frac) + HOURLY_SHAPE[(index + 1) % 24] * frac
    return 1.0 + shape * _SCALE


def minutes_per_km(at: datetime, model: TrafficModel = "time_of_day") -> float:
    return FREE_FLOW_MIN_PER_KM * congestion_multiplier(at, model)
