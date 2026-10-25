/**
 * Driver route map (Person 5): driver, pickup and NGO markers plus the route to
 * the next stop.
 *
 * Route quality tiers:
 *   live       — TomTom with real-time traffic (solid green)
 *   road_model — OSRM road geometry + time-of-day congestion model (solid blue)
 *   heuristic  — straight-line estimate, no real roads (dashed orange)
 *   static     — fallback to job.route_to_next_stop geometry (dashed orange)
 */

import { useEffect, useMemo } from 'react';
import { ExternalLink, Loader2, AlertTriangle, Zap } from 'lucide-react';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
// @ts-ignore — image imports resolved by Vite
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import type { DriverJob, GeoPoint } from '../../hooks/useDriver';
import { useTrafficRoute, getClientTomTomKey, type TrafficRouteSource } from '../../hooks/useTrafficRoute';
import type { LatLngTuple } from './polyline';

// Same default-icon fix as components/donor/DonationMap.tsx.
L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const toTuple = (p: { latitude: number | null; longitude: number | null } | null | undefined): LatLngTuple | null =>
  p && p.latitude != null && p.longitude != null ? [p.latitude, p.longitude] : null;

/** @deprecated Use trafficSource from useTrafficRoute instead. Kept for backwards-compat with tests. */
export function isStraightLineEstimate(provider: string | undefined): boolean {
  return provider === 'heuristic';
}

// ─── Traffic badge config ─────────────────────────────────────────────────────

interface BadgeConfig {
  dot: string;
  label: string;
  title: string;
}

const BADGE: Record<TrafficRouteSource, BadgeConfig> = {
  live: {
    dot: '#22c55e',
    label: 'Live traffic route',
    title: 'This route is optimised using real-time TomTom traffic data.',
  },
  road_model: {
    dot: '#3b82f6',
    label: 'Road route (est. traffic)',
    title: 'Real road geometry with time-of-day congestion model applied.',
  },
  heuristic: {
    dot: '#f97316',
    label: 'Straight-line estimate',
    title: 'No road data available. Showing a straight-line estimate.',
  },
  static: {
    dot: '#f97316',
    label: 'Straight-line estimate',
    title: 'Route from job creation (no live update available).',
  },
  none: {
    dot: '#94a3b8',
    label: 'Loading route…',
    title: 'Fetching route…',
  },
};

// Polyline colour per source
const LINE_COLOR: Record<TrafficRouteSource, string> = {
  live: '#22c55e',
  road_model: '#6366f1',
  heuristic: '#f97316',
  static: '#f97316',
  none: '#94a3b8',
};

// ─── FitBounds ────────────────────────────────────────────────────────────────

function FitBounds({ points, driver }: { points: LatLngTuple[]; driver: LatLngTuple | null }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join(';');
  useEffect(() => {
    map.invalidateSize();
    try {
      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16, animate: true });
      } else if (points.length === 1) {
        map.setView(points[0], 15, { animate: true });
      } else if (driver) {
        map.setView(driver, 15, { animate: true });
      }
    } catch (e) {
      console.warn('Map fit bounds failed:', e);
    }
  }, [key, driver?.[0], driver?.[1], map]);
  return null;
}

// ─── ETA chip ─────────────────────────────────────────────────────────────────

function formatMin(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  job: DriverJob;
  driverPosition: GeoPoint | null;
}

export function DriverRouteMap({ job, driverPosition }: Props) {
  const tomtomKey = useMemo(() => getClientTomTomKey(), []);
  const pickup = toTuple(job.pickup);
  const dropoff = toTuple(job.dropoff);

  // Sanity check: if driver's reported position is across the country (>2.5 deg, ~280 km from pickup),
  // it is an uninitialized default or ISP Wi-Fi geolocation artifact.
  // Snap driver locally ~1.2 km south-west of pickup so the map stays focused in the delivery city.
  const rawDriver = toTuple(driverPosition);
  const driver = useMemo(() => {
    if (!rawDriver) return pickup ? ([pickup[0] - 0.012, pickup[1] - 0.012] as LatLngTuple) : null;
    if (pickup) {
      const dLat = Math.abs(rawDriver[0] - pickup[0]);
      const dLng = Math.abs(rawDriver[1] - pickup[1]);
      if (dLat > 2.5 || dLng > 2.5) {
        return [pickup[0] - 0.012, pickup[1] - 0.012] as LatLngTuple;
      }
    }
    return rawDriver;
  }, [rawDriver?.[0], rawDriver?.[1], pickup?.[0], pickup?.[1]]);

  // ── Traffic-aware route ──────────────────────────────────────────────────────
  const effectiveDriver: GeoPoint | null = driver
    ? { latitude: driver[0], longitude: driver[1] }
    : null;
  const { polyline, routeInfo, isLoading, trafficSource, isStaticFallback } =
    useTrafficRoute(job, effectiveDriver);

  const line = polyline.length > 1 ? polyline : (
    // Last-resort: connect driver → pickup → dropoff directly
    [driver, job.next_stop === 'PICKUP' ? pickup : null, dropoff]
      .filter(Boolean) as LatLngTuple[]
  );

  // Only dash if it is genuinely a low-point straight-line estimate (<=8 points), never a real road route.
  const dashed = (trafficSource === 'heuristic' || trafficSource === 'static') && line.length <= 8;
  const lineColor = dashed ? LINE_COLOR.heuristic : (LINE_COLOR[trafficSource] || LINE_COLOR.road_model);
  const badge = BADGE[trafficSource];

  const fitPoints = [driver, pickup, dropoff].filter(Boolean) as LatLngTuple[];
  const center = fitPoints[0] ?? pickup ?? dropoff ?? ([12.9716, 77.5946] as LatLngTuple); // Bengaluru

  const googleMapsUrl = useMemo(() => {
    if (!driver || !dropoff) return '';
    let url = `https://www.google.com/maps/dir/?api=1&origin=${driver[0]},${driver[1]}&destination=${dropoff[0]},${dropoff[1]}&travelmode=driving`;
    if (job.next_stop === 'PICKUP' && pickup) {
      url += `&waypoints=${pickup[0]},${pickup[1]}`;
    }
    return url;
  }, [driver?.[0], driver?.[1], pickup?.[0], pickup?.[1], dropoff?.[0], dropoff?.[1], job.next_stop]);

  return (
    <div className="relative h-72 sm:h-96 w-full rounded-sm overflow-hidden border border-[var(--border-strong)]">
      <MapContainer center={center} zoom={14} scrollWheelZoom={false} className="h-full w-full">
        {tomtomKey ? (
          <>
            <TileLayer
              url={`https://{s}.api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${tomtomKey}`}
              subdomains={['a', 'b', 'c', 'd']}
              attribution='&copy; <a href="https://www.tomtom.com" target="_blank" rel="noreferrer">TomTom</a>'
              maxZoom={22}
            />
            {/* Live Traffic Flow Layer: draws real-time green/yellow/red traffic flow directly on streets */}
            <TileLayer
              url={`https://{s}.api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${tomtomKey}`}
              subdomains={['a', 'b', 'c', 'd']}
              opacity={0.8}
              maxZoom={22}
            />
          </>
        ) : (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
        )}
        <FitBounds points={fitPoints} driver={driver} />
        {pickup && (
          <Marker position={pickup}>
            <Popup>
              <b>Pickup</b>
              {job.pickup.organisation_name && <><br />{job.pickup.organisation_name}</>}
              {job.pickup.address && <><br />{job.pickup.address}</>}
            </Popup>
          </Marker>
        )}
        {dropoff && (
          <Marker position={dropoff}>
            <Popup>
              <b>Drop-off</b>
              {job.dropoff.organisation_name && <><br />{job.dropoff.organisation_name}</>}
              {job.dropoff.address && <><br />{job.dropoff.address}</>}
            </Popup>
          </Marker>
        )}
        {driver && (
          <CircleMarker center={driver} radius={9} pathOptions={{ color: '#09090b', weight: 3, fillColor: '#10b981', fillOpacity: 1 }}>
            <Popup>You</Popup>
          </CircleMarker>
        )}
        {line.length > 1 && (
          <Polyline
            positions={line}
            pathOptions={{ color: lineColor, weight: 5, opacity: 0.85, dashArray: dashed ? '8 10' : undefined }}
          />
        )}
      </MapContainer>

      {/* ── Traffic status badge (top-left) ───────────────────────────── */}
      <div
        className="absolute top-2 left-2 z-[1000] flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-md text-[11px] font-semibold backdrop-blur-sm"
        style={{ background: 'rgba(9,9,11,0.82)', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.10)' }}
        title={badge.title}
      >
        {isLoading ? (
          <Loader2 size={10} className="animate-spin text-slate-400" />
        ) : isStaticFallback && !isLoading ? (
          <AlertTriangle size={10} style={{ color: '#f97316' }} />
        ) : trafficSource === 'live' ? (
          <Zap size={10} style={{ color: badge.dot }} />
        ) : (
          <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: badge.dot }} />
        )}
        <span>{isLoading ? 'Calculating route…' : badge.label}</span>
      </div>

      {/* ── Live ETA chip (top-right) ──────────────────────────────────── */}
      {routeInfo && !isLoading && (
        <div
          className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-md text-[11px] font-semibold backdrop-blur-sm"
          style={{ background: 'rgba(9,9,11,0.82)', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.10)' }}
          title={`Free-flow: ${Math.round(routeInfo.free_flow_duration_minutes)} min | Provider: ${routeInfo.provider}`}
        >
          <span style={{ color: lineColor }}>⏱</span>
          <span>~{formatMin(routeInfo.duration_minutes)}</span>
          <span style={{ color: '#94a3b8' }}>·</span>
          <span>{routeInfo.distance_km.toFixed(1)} km</span>
        </div>
      )}

      {/* ── Google Maps deep-link ──────────────────────────────────────── */}
      {googleMapsUrl && (
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2.5 rounded-full shadow-lg text-sm font-semibold flex items-center gap-2 bg-[#4285F4] text-white hover:bg-[#3367D6] transition-colors border border-white/20"
        >
          <ExternalLink size={16} />
          Navigate in Google Maps
        </a>
      )}
    </div>
  );
}

