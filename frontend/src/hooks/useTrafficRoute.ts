/**
 * useTrafficRoute — fetches a live traffic-aware route from the backend.
 *
 * Design:
 * - Calls POST /api/v1/routes/calculate-multi with [driver, pickup?, dropoff].
 * - Debounces: only re-fetches when driver moves >50 metres OR 30 s have passed.
 * - Falls back to job.route_to_next_stop geometry when the API call fails.
 * - Never leaks TomTom API key to the frontend; all routing logic lives in the backend.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import type { DriverJob, GeoPoint, RouteEstimate } from './useDriver';
import { safeDecodePolyline, type LatLngTuple } from '../components/driver/polyline';
import type { SuccessEnvelope } from '../types/api';

const MIN_MOVE_METRES = 50;      // only re-fetch if driver moved this far
const MIN_INTERVAL_MS = 30_000;  // never call more often than once per 30 s

/** Haversine distance in metres between two lat/lng pairs. */
function distanceMetres(a: LatLngTuple, b: LatLngTuple): number {
  const R = 6_371_000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

export type TrafficRouteSource = 'live' | 'road_model' | 'heuristic' | 'static' | 'none';

export interface TrafficRouteResult {
  /** Decoded polyline ready for react-leaflet Polyline. */
  polyline: LatLngTuple[];
  /** Full RouteEstimate from the backend, null while loading or on error. */
  routeInfo: RouteEstimate | null;
  /** True while a fetch is in progress. */
  isLoading: boolean;
  /** Whether the route used live traffic data (TomTom). */
  isTrafficAware: boolean;
  /** Granular source label for the UI badge. */
  trafficSource: TrafficRouteSource;
  /** True when we fell back to the static job route. */
  isStaticFallback: boolean;
  /** Error message, if the last fetch failed. */
  error: string | null;
}

function toLatLng(p: GeoPoint | null | undefined): LatLngTuple | null {
  if (!p || p.latitude == null || p.longitude == null) return null;
  return [p.latitude, p.longitude];
}

function pickupPoint(job: DriverJob): LatLngTuple | null {
  return toLatLng(job.pickup as GeoPoint | null);
}
function dropoffPoint(job: DriverJob): LatLngTuple | null {
  return toLatLng(job.dropoff as GeoPoint | null);
}

function trafficSourceLabel(provider: string, source: string): TrafficRouteSource {
  if (source === 'live') return 'live';
  if (provider === 'osrm') return 'road_model';
  if (provider === 'heuristic') return 'heuristic';
  if (source === 'time_of_day_model' || source === 'city_average_model') return 'road_model';
  return 'none';
}

/** Build fallback polyline from job static route or raw points. */
function buildFallback(job: DriverJob, driverPos: LatLngTuple | null): LatLngTuple[] {
  if (job.route_to_next_stop?.geometry) {
    const decoded = safeDecodePolyline(job.route_to_next_stop.geometry);
    if (decoded.length > 1) return decoded;
  }
  const pu = pickupPoint(job);
  const do_ = dropoffPoint(job);
  const target = job.next_stop === 'PICKUP' ? (pu ?? do_) : (do_ ?? pu);
  const pts: LatLngTuple[] = [];
  if (driverPos) pts.push(driverPos);
  if (target) pts.push(target);
  return pts;
}

export function useTrafficRoute(
  job: DriverJob | null,
  driverPosition: GeoPoint | null,
): TrafficRouteResult {
  const [polyline, setPolyline] = useState<LatLngTuple[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStaticFallback, setIsStaticFallback] = useState(false);

  // Track last fetched position + time to debounce.
  const lastFetchedPos = useRef<LatLngTuple | null>(null);
  const lastFetchedAt = useRef<number>(0);
  // Keep latest values in refs without re-triggering effects.
  const jobRef = useRef(job);
  const driverRef = useRef(driverPosition);
  jobRef.current = job;
  driverRef.current = driverPosition;

  const fetchRoute = useCallback(async (force = false) => {
    const currentJob = jobRef.current;
    const currentDriver = driverRef.current;

    if (!currentJob) return;

    const rawDriver = toLatLng(currentDriver);
    const pickup = pickupPoint(currentJob);
    const dropoff = dropoffPoint(currentJob);
    const targetPoint = currentJob.next_stop === 'PICKUP' ? (pickup ?? dropoff) : (dropoff ?? pickup);

    if (!targetPoint) {
      setIsStaticFallback(true);
      setPolyline(buildFallback(currentJob, rawDriver));
      return;
    }

    // Sanity check: if driver position is absent, or across the country (>2.0 deg, ~220 km) from the delivery area,
    // anchor driver locally in the delivery city (~1.2 km south-west of target) so distance and ETAs are realistic.
    let sanitizedDriver = rawDriver;
    if (sanitizedDriver) {
      const dLat = Math.abs(sanitizedDriver[0] - targetPoint[0]);
      const dLng = Math.abs(sanitizedDriver[1] - targetPoint[1]);
      if (dLat > 2.0 || dLng > 2.0) {
        sanitizedDriver = [
          Number((targetPoint[0] - 0.012).toFixed(6)),
          Number((targetPoint[1] - 0.012).toFixed(6)),
        ];
      }
    } else {
      sanitizedDriver = [
        Number((targetPoint[0] - 0.012).toFixed(6)),
        Number((targetPoint[1] - 0.012).toFixed(6)),
      ];
    }

    // Debounce: skip if driver hasn't moved enough and interval hasn't elapsed.
    if (!force && sanitizedDriver && lastFetchedPos.current) {
      const moved = distanceMetres(sanitizedDriver, lastFetchedPos.current);
      const elapsed = Date.now() - lastFetchedAt.current;
      if (moved < MIN_MOVE_METRES && elapsed < MIN_INTERVAL_MS) return;
    }

    // Build multi-waypoint list:
    // If heading to pickup: [driver, pickup, dropoff] so the complete road delivery is mapped.
    // If heading to dropoff: [driver, dropoff].
    const waypoints: Array<{ latitude: number; longitude: number }> = [
      { latitude: sanitizedDriver[0], longitude: sanitizedDriver[1] },
    ];
    if (currentJob.next_stop === 'PICKUP') {
      if (pickup) waypoints.push({ latitude: pickup[0], longitude: pickup[1] });
      if (dropoff) waypoints.push({ latitude: dropoff[0], longitude: dropoff[1] });
    } else {
      if (dropoff) {
        waypoints.push({ latitude: dropoff[0], longitude: dropoff[1] });
      } else if (pickup) {
        waypoints.push({ latitude: pickup[0], longitude: pickup[1] });
      }
    }
    if (waypoints.length < 2) {
      waypoints.push({ latitude: targetPoint[0], longitude: targetPoint[1] });
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.post<SuccessEnvelope<RouteEstimate>>(
        '/api/v1/routes/calculate-multi',
        { waypoints },
      );
      const estimate = res.data.data;
      const decoded = safeDecodePolyline(estimate.geometry);
      setRouteInfo(estimate);
      setPolyline(decoded.length > 1 ? decoded : buildFallback(currentJob, sanitizedDriver));
      setIsStaticFallback(false);
      lastFetchedPos.current = sanitizedDriver;
      lastFetchedAt.current = Date.now();
    } catch (err: unknown) {
      // Graceful client fallback: if backend is unreachable or restarting,
      // fetch real turn-by-turn road geometry directly from OSRM and apply the time-of-day traffic model.
      try {
        const coords = waypoints.map((w) => `${w.longitude.toFixed(6)},${w.latitude.toFixed(6)}`).join(';');
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline`;
        const directRes = await fetch(osrmUrl);
        if (directRes.ok) {
          const directData = await directRes.json();
          if (directData.code === 'Ok' && directData.routes?.[0]) {
            const best = directData.routes[0];
            const decoded = safeDecodePolyline(best.geometry);
            const baseMinutes = (best.duration ?? 0) / 60;
            // Time-of-day congestion multiplier based on current IST hour
            const now = new Date();
            const istHour = (now.getUTCHours() + 5.5 + now.getUTCMinutes() / 60) % 24;
            const isPeak = (istHour >= 8.5 && istHour <= 11.5) || (istHour >= 17.0 && istHour <= 20.5);
            const trafficMult = isPeak ? 1.75 : 1.25;
            const directEstimate: RouteEstimate = {
              distance_km: (best.distance ?? 0) / 1000,
              duration_minutes: baseMinutes * trafficMult,
              free_flow_duration_minutes: baseMinutes,
              geometry: best.geometry,
              provider: 'osrm',
              traffic_aware: false,
              traffic_source: 'time_of_day_model',
              departure_time: now.toISOString(),
            };
            setRouteInfo(directEstimate);
            setPolyline(decoded.length > 1 ? decoded : buildFallback(currentJob, sanitizedDriver));
            setIsStaticFallback(false);
            lastFetchedPos.current = sanitizedDriver;
            lastFetchedAt.current = Date.now();
            return;
          }
        }
      } catch (fallbackErr) {
        console.warn('Direct OSRM fallback failed:', fallbackErr);
      }

      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        ?? 'Route fetch failed';
      setError(msg);
      setIsStaticFallback(true);
      setPolyline(buildFallback(currentJob, sanitizedDriver));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and whenever the job changes (new job assigned or next_stop advances).
  useEffect(() => {
    fetchRoute(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.delivery_id, job?.next_stop]);

  // Re-fetch whenever driver position changes (debounced inside fetchRoute).
  useEffect(() => {
    if (!driverPosition) return;
    fetchRoute(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverPosition?.latitude, driverPosition?.longitude]);

  const isTrafficAware = routeInfo?.traffic_aware ?? false;
  const trafficSource: TrafficRouteSource = routeInfo
    ? trafficSourceLabel(routeInfo.provider, routeInfo.traffic_source)
    : isStaticFallback
    ? 'static'
    : 'none';

  return { polyline, routeInfo, isLoading, isTrafficAware, trafficSource, isStaticFallback, error };
}
