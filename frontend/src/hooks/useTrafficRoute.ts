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
  const pts: LatLngTuple[] = [];
  if (driverPos) pts.push(driverPos);
  const pu = pickupPoint(job);
  const do_ = dropoffPoint(job);
  if (job.next_stop === 'PICKUP' && pu) pts.push(pu);
  if (do_) pts.push(do_);
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

    const driverLatLng = toLatLng(currentDriver);
    const pickup = pickupPoint(currentJob);
    const dropoff = dropoffPoint(currentJob);

    if (!dropoff) {
      setIsStaticFallback(true);
      setPolyline(buildFallback(currentJob, driverLatLng));
      return;
    }

    // Debounce: skip if driver hasn't moved enough and interval hasn't elapsed.
    if (!force && driverLatLng && lastFetchedPos.current) {
      const moved = distanceMetres(driverLatLng, lastFetchedPos.current);
      const elapsed = Date.now() - lastFetchedAt.current;
      if (moved < MIN_MOVE_METRES && elapsed < MIN_INTERVAL_MS) return;
    }

    // Build waypoints: driver → (pickup if PICKUP stop) → dropoff
    const waypoints: Array<{ latitude: number; longitude: number }> = [];
    if (driverLatLng) {
      waypoints.push({ latitude: driverLatLng[0], longitude: driverLatLng[1] });
    }
    if (currentJob.next_stop === 'PICKUP' && pickup) {
      waypoints.push({ latitude: pickup[0], longitude: pickup[1] });
    }
    waypoints.push({ latitude: dropoff[0], longitude: dropoff[1] });

    if (waypoints.length < 2) {
      setIsStaticFallback(true);
      setPolyline(buildFallback(currentJob, driverLatLng));
      return;
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
      setPolyline(decoded.length > 1 ? decoded : buildFallback(currentJob, driverLatLng));
      setIsStaticFallback(false);
      lastFetchedPos.current = driverLatLng;
      lastFetchedAt.current = Date.now();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        ?? 'Route fetch failed';
      setError(msg);
      setIsStaticFallback(true);
      setPolyline(buildFallback(currentJob, driverLatLng));
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
