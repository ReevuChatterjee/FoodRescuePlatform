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

import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Loader2, AlertTriangle, Zap, FastForward, Navigation, Package } from 'lucide-react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
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

/** Calculate compass bearing between two points in degrees (0 = North, 90 = East, 180 = South, 270 = West). */
function calculateBearing(start: LatLngTuple, end: LatLngTuple): number {
  const startLat = (start[0] * Math.PI) / 180;
  const startLng = (start[1] * Math.PI) / 180;
  const endLat = (end[0] * Math.PI) / 180;
  const endLng = (end[1] * Math.PI) / 180;

  const dLng = endLng - startLng;
  const y = Math.sin(dLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/** Realistic vector delivery scooter icon for UI buttons, badges and popups */
export function DeliveryScooterIcon({ className = '', size = 18 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Delivery Scooter"
    >
      {/* Insulated Delivery Cargo Box (Rear Mount) */}
      <rect x="3" y="10" width="10" height="9" rx="2" fill="#f59e0b" stroke="#b45309" strokeWidth="1.2" />
      {/* Box Security Straps & Logo Emblem */}
      <line x1="3" y1="14" x2="13" y2="14" stroke="#92400e" strokeWidth="1" />
      <line x1="8" y1="10" x2="8" y2="19" stroke="#92400e" strokeWidth="1" />
      <circle cx="8" cy="14" r="1.5" fill="#ffffff" />

      {/* Rear Wheel */}
      <circle cx="7" cy="24" r="4.5" fill="#1e293b" stroke="#0f172a" strokeWidth="1.2" />
      <circle cx="7" cy="24" r="2.2" fill="#94a3b8" />
      <circle cx="7" cy="24" r="1" fill="#0f172a" />

      {/* Front Wheel */}
      <circle cx="25" cy="24" r="4.5" fill="#1e293b" stroke="#0f172a" strokeWidth="1.2" />
      <circle cx="25" cy="24" r="2.2" fill="#94a3b8" />
      <circle cx="25" cy="24" r="1" fill="#0f172a" />

      {/* Scooter Chassis & Footboard Deck */}
      <path
        d="M7 24h5l4-7h5"
        stroke="#10b981"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 24l3.5-4h4.5"
        stroke="#047857"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Seat Cushion */}
      <path
        d="M11 16c0-1.5 2-2 5-2s4 .5 4 2z"
        fill="#0f172a"
      />

      {/* Front Steering Column & Mudguard */}
      <path
        d="M25 24l-3-11.5l-2-4.5"
        stroke="#0f172a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M22 21c1-1.5 3.5-1.5 5 0"
        stroke="#10b981"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Handlebar & Chrome Mirror */}
      <line x1="18" y1="8" x2="22" y2="8" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="18" cy="6" r="1.2" fill="#94a3b8" />

      {/* Front Headlight (Bright illumination) */}
      <circle cx="23.5" cy="11" r="1.8" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.8" />
      <polygon points="25.5,11 29,8.5 29,13.5" fill="#fef08a" fillOpacity="0.4" />
    </svg>
  );
}

/** Swiggy/Zomato style animated delivery scooter marker icon with radar pulse & heading arrow */
function createDriverMarkerIcon(headingDeg: number) {
  const roundedHeading = Math.round(headingDeg);
  return L.divIcon({
    className: 'driver-live-marker',
    html: `
      <div style="position: relative; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center;">
        <!-- Pulsing Radar / Sonar Wave Ring (Swiggy/Zomato style) -->
        <div style="
          position: absolute;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(16, 185, 129, 0.45) 0%, rgba(16, 185, 129, 0.15) 55%, transparent 75%);
          animation: driver-radar-pulse 2s infinite ease-out;
          pointer-events: none;
        "></div>

        <!-- Rotating Scooter Group (Faces heading direction) -->
        <div style="
          position: relative;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(${roundedHeading}deg);
          transition: transform 0.25s linear;
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
        ">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="scooter-beam-${roundedHeading}" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stop-color="#fef08a" stop-opacity="0.6" />
                <stop offset="60%" stop-color="#fef08a" stop-opacity="0.2" />
                <stop offset="100%" stop-color="#fef08a" stop-opacity="0" />
              </linearGradient>
            </defs>

            <!-- Headlight Beam (Illuminating road ahead) -->
            <polygon points="22,12 11,0 33,0" fill="url(#scooter-beam-${roundedHeading})" />

            <!-- Direction Indicator Trajectory Arrow -->
            <path d="M19 4 L22 1 L25 4" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

            <!-- Front Tire -->
            <rect x="20.5" y="5.5" width="3" height="6.5" rx="1.5" fill="#1e293b" />

            <!-- Front Mudguard / Fairing (Emerald Green) -->
            <path d="M18 11.5 C18 9 26 9 26 11.5 L24.5 14.5 L19.5 14.5 Z" fill="#10b981" />

            <!-- Headlight LED -->
            <circle cx="22" cy="11.5" r="1.8" fill="#ffffff" stroke="#fef08a" stroke-width="0.8" />

            <!-- Handlebars & Chrome Mirrors -->
            <line x1="12" y1="13.5" x2="32" y2="13.5" stroke="#334155" stroke-width="2.2" stroke-linecap="round" />
            <circle cx="12" cy="11.5" r="1.4" fill="#94a3b8" />
            <circle cx="32" cy="11.5" r="1.4" fill="#94a3b8" />
            <rect x="11.5" y="12.5" width="2.5" height="2" rx="0.5" fill="#0f172a" />
            <rect x="30" y="12.5" width="2.5" height="2" rx="0.5" fill="#0f172a" />

            <!-- Driver Silhouette: Shoulders & Helmet -->
            <ellipse cx="22" cy="20" rx="7" ry="3.5" fill="#047857" />
            <path d="M17 19.5 L22 22 L27 19.5" stroke="#34d399" stroke-width="1" stroke-linecap="round" />
            <circle cx="22" cy="18" r="4" fill="#0f172a" stroke="#10b981" stroke-width="1.2" />
            <path d="M19.5 16.5 Q22 15 24.5 16.5" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round" fill="none" />

            <!-- Central Footboard Deck -->
            <rect x="19.5" y="21.5" width="5" height="4.5" rx="1" fill="#334155" />

            <!-- Rear Insulated Food Cargo Box (Swiggy/Zomato/RePlate thermal box) -->
            <rect x="15" y="24.5" width="14" height="12" rx="2.5" fill="#f59e0b" stroke="#d97706" stroke-width="1.2" />
            <line x1="15" y1="28" x2="29" y2="28" stroke="#b45309" stroke-width="1" />
            <line x1="22" y1="24.5" x2="22" y2="36.5" stroke="#b45309" stroke-width="1" />
            <circle cx="22" cy="32" r="2" fill="#ffffff" />
            <circle cx="22" cy="32" r="1.2" fill="#f59e0b" />

            <!-- Taillight (Red LED) -->
            <rect x="19.5" y="36.5" width="5" height="1.8" rx="0.8" fill="#ef4444" />

            <!-- Rear Tire -->
            <rect x="20.5" y="37.5" width="3" height="4.5" rx="1.5" fill="#1e293b" />
          </svg>
        </div>

        <!-- Live Status Badge Pill -->
        <div style="
          position: absolute;
          bottom: -12px;
          background: rgba(15, 23, 42, 0.94);
          color: #ffffff;
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 0.03em;
          padding: 1px 5px;
          border-radius: 9999px;
          white-space: nowrap;
          border: 1px solid rgba(16, 185, 129, 0.6);
          box-shadow: 0 2px 4px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          gap: 3px;
          pointer-events: none;
        ">
          <span style="width: 4px; height: 4px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
          GPS
        </div>
      </div>
    `,
    iconSize: [50, 50],
    iconAnchor: [25, 25],
  });
}


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

// ─── FitBounds ────────────────────────────────────────────────────────────────

function FitBounds({ points, driver, pickup }: { points: LatLngTuple[]; driver: LatLngTuple | null; pickup: LatLngTuple | null }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join(';');
  useEffect(() => {
    map.invalidateSize();
    try {
      if (points.length > 1) {
        // If driver and delivery stops are in different cities (> 2.0 degrees apart)
        const latSpan = Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]));
        const lngSpan = Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1]));
        if (latSpan > 2.0 || lngSpan > 2.0) {
          // Center on driver's real GPS position so they can see their location marker immediately!
          if (driver) {
            map.setView(driver, 15, { animate: true });
          } else if (pickup) {
            map.setView(pickup, 15, { animate: true });
          }
        } else {
          map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16, animate: true });
        }
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

// ─── Map Binder ───────────────────────────────────────────────────────────────

function MapBinder({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    return () => {
      mapRef.current = null;
    };
  }, [map, mapRef]);
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
  onRefreshGps?: () => void;
}

export function DriverRouteMap({ job, driverPosition, onRefreshGps }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const tomtomKey = useMemo(() => getClientTomTomKey(), []);
  const pickup = toTuple(job.pickup);
  const dropoff = toTuple(job.dropoff);

  const rawDriver = toTuple(driverPosition);
  const driver = useMemo(() => {
    if (!rawDriver) return pickup ? ([pickup[0] - 0.012, pickup[1] - 0.012] as LatLngTuple) : null;
    return rawDriver;
  }, [rawDriver?.[0], rawDriver?.[1], pickup?.[0], pickup?.[1]]);

  // Track heading & previous position to calculate rotation angle
  const prevPosRef = useRef<LatLngTuple | null>(null);
  const [heading, setHeading] = useState<number>(0);

  // Simulation drive mode (for testing movement smoothly along the route)
  const [isSimulating, setIsSimulating] = useState(false);
  const [simIndex, setSimIndex] = useState(0);
  const [simSpeed, setSimSpeed] = useState<1 | 2 | 4>(2); // 1x = 240ms, 2x = 120ms, 4x = 60ms

  const simIntervalMs = simSpeed === 4 ? 60 : simSpeed === 2 ? 120 : 240;

  useEffect(() => {
    if (driver) {
      if (prevPosRef.current) {
        const dLat = Math.abs(driver[0] - prevPosRef.current[0]);
        const dLng = Math.abs(driver[1] - prevPosRef.current[1]);
        if (dLat > 0.00003 || dLng > 0.00003) {
          const deg = calculateBearing(prevPosRef.current, driver);
          setHeading(deg);
        }
      }
      prevPosRef.current = driver;
    }
  }, [driver?.[0], driver?.[1]]);

  // ── Traffic-aware route ──────────────────────────────────────────────────────
  const effectiveDriver: GeoPoint | null = driver
    ? { latitude: driver[0], longitude: driver[1] }
    : null;
  const { polyline, trafficSegments, routeInfo, isLoading, trafficSource, isStaticFallback } =
    useTrafficRoute(job, effectiveDriver);

  const line = polyline.length > 1 ? polyline : (
    // Last-resort: connect driver → pickup → dropoff directly
    [driver, job.next_stop === 'PICKUP' ? pickup : null, dropoff]
      .filter(Boolean) as LatLngTuple[]
  );

  // Simulation step effect along line
  useEffect(() => {
    if (!isSimulating || line.length < 2) return;
    const interval = setInterval(() => {
      setSimIndex((idx: number) => {
        const next = (idx + 1) % line.length;
        if (line[idx] && line[next]) {
          const b = calculateBearing(line[idx], line[next]);
          if (!isNaN(b)) {
            setHeading(b);
          }
        }
        return next;
      });
    }, simIntervalMs);
    return () => clearInterval(interval);
  }, [isSimulating, line, simIntervalMs]);

  const activeDriverPos: LatLngTuple | null = isSimulating && line.length > 0
    ? line[simIndex] ?? driver
    : driver;

  const driverMarkerIcon = useMemo(() => createDriverMarkerIcon(heading), [heading]);

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
      <MapContainer center={center} zoom={14} scrollWheelZoom={false} zoomControl={false} className="h-full w-full">
        <MapBinder mapRef={mapRef} />
        {tomtomKey ? (
          <TileLayer
            url={`https://{s}.api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${tomtomKey}`}
            subdomains={['a', 'b', 'c', 'd']}
            attribution='&copy; <a href="https://www.tomtom.com" target="_blank" rel="noreferrer">TomTom</a>'
            maxZoom={22}
          />
        ) : (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
        )}
        <FitBounds points={fitPoints} driver={driver} pickup={pickup} />
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
        {activeDriverPos && (
          <Marker position={activeDriverPos} icon={driverMarkerIcon} zIndexOffset={1000}>
            <Popup>
              <div className="text-xs font-medium">
                <div className="flex items-center gap-1.5 text-emerald-600 font-bold mb-0.5">
                  <DeliveryScooterIcon size={16} />
                  <span>Delivery Partner (Live)</span>
                </div>
                <div>Status: Moving with live traffic</div>
                {heading > 0 && <div className="text-slate-500">Direction: {Math.round(heading)}°</div>}
              </div>
            </Popup>
          </Marker>
        )}
        {/* High-contrast dark casing underlay for the route */}
        {line.length > 1 && (
          <Polyline
            positions={line}
            pathOptions={{
              color: '#0f172a',
              weight: 8,
              opacity: 0.55,
              lineJoin: 'round',
              lineCap: 'round',
            }}
          />
        )}
        {line.length > 1 && (
          <Polyline
            positions={line}
            pathOptions={{
              color: dashed ? LINE_COLOR.heuristic : (trafficSource === 'live' ? '#22c55e' : (LINE_COLOR[trafficSource] || LINE_COLOR.road_model)),
              weight: 5,
              opacity: 0.95,
              dashArray: dashed ? '8 10' : undefined,
              lineJoin: 'round',
              lineCap: 'round',
            }}
          />
        )}

        {/* Live traffic congestion segments ON ROUTE ONLY: Amber for slow, Red for heavy jams */}
        {trafficSegments && trafficSegments.length > 0 && trafficSegments
          .filter((seg) => seg.points && seg.points.length > 1)
          .map((seg, idx) => (
            <Polyline
              key={`traffic-seg-${idx}`}
              positions={seg.points}
              pathOptions={{
                color: seg.severity === 'jam' ? '#ef4444' : '#f59e0b',
                weight: 6,
                opacity: 1,
                lineJoin: 'round',
                lineCap: 'round',
              }}
            >
              <Popup>
                <div className="text-xs">
                  <b style={{ color: seg.severity === 'jam' ? '#ef4444' : '#f59e0b' }}>
                    {seg.severity === 'jam' ? '🔴 Heavy Traffic Jam' : '🟡 Moderate Traffic Slowdown'}
                  </b>
                  {seg.delay_seconds != null && seg.delay_seconds > 0 && (
                    <div className="mt-0.5">Route Delay: +{Math.round(seg.delay_seconds / 60)} min</div>
                  )}
                  {seg.speed_kmh != null && (
                    <div>Avg Speed: {Math.round(seg.speed_kmh)} km/h</div>
                  )}
                </div>
              </Popup>
            </Polyline>
          ))}
      </MapContainer>

      {/* ── Route Traffic Flow Legend (bottom-left) ─────────────────────────── */}
      <div
        className="absolute bottom-2 left-2 z-[1000] flex items-center gap-2.5 px-2.5 py-1 rounded shadow text-[10px] font-medium backdrop-blur-md"
        style={{ background: 'rgba(9,9,11,0.88)', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-0.5">Route</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full inline-block bg-[#22c55e]" /> Clear
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full inline-block bg-[#f59e0b]" /> Slow
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full inline-block bg-[#ef4444]" /> Heavy
        </span>
      </div>

      {/* ── Top-Left: Traffic Status Badge + Quick Focus Navigation (Single unified container) ── */}
      <div className="absolute top-2 left-2 z-[1000] flex flex-col gap-1.5 pointer-events-auto">
        {/* Traffic status badge */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-md text-[11px] font-semibold backdrop-blur-md"
          style={{ background: 'rgba(9,9,11,0.88)', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.12)' }}
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

        {/* Quick focus navigation: My GPS & Delivery */}
        {(activeDriverPos || pickup) && (
          <div
            className="flex items-center gap-1 p-0.5 rounded-full shadow-lg backdrop-blur-md self-start"
            style={{ background: 'rgba(9,9,11,0.92)', border: '1px solid rgba(255,255,255,0.14)' }}
          >
            <button
              type="button"
              title="Focus map on my GPS location"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (activeDriverPos && mapRef.current) {
                  mapRef.current.flyTo(activeDriverPos, 16, { duration: 0.8 });
                }
                if (onRefreshGps) onRefreshGps();
              }}
              className="px-2.5 py-1 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20 rounded-full flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Navigation size={11} className="fill-emerald-400 text-emerald-400" />
              <span>My GPS</span>
            </button>

            {pickup && (
              <button
                type="button"
                title="Focus map on delivery stop"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (pickup && mapRef.current) {
                    mapRef.current.flyTo(pickup, 15, { duration: 0.8 });
                  }
                }}
                className="px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:bg-white/10 rounded-full flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Package size={11} className="text-amber-400" />
                <span>Delivery</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Live ETA chip + Simulation toggle (top-right) ─────────────── */}
      <div className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setIsSimulating((s: boolean) => !s);
            if (!isSimulating) setSimIndex(0);
          }}
          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border backdrop-blur-sm transition-all flex items-center gap-1.5 shadow-sm ${
            isSimulating
              ? 'bg-emerald-600 text-white border-emerald-400'
              : 'bg-slate-900/80 text-slate-300 border-white/10 hover:text-white'
          }`}
          title="Toggle realistic delivery scooter movement simulation along the route"
        >
          <DeliveryScooterIcon size={15} />
          <span>{isSimulating ? 'Moving…' : 'Simulate'}</span>
        </button>

        {isSimulating && (
          <button
            type="button"
            onClick={() => setSimSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1))}
            className="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-900/90 text-emerald-400 border border-emerald-500/40 hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1 backdrop-blur-sm"
            title={`Simulation speed: ${simSpeed}x (Click to cycle 1x / 2x / 4x)`}
          >
            <FastForward size={11} />
            <span>{simSpeed}x</span>
          </button>
        )}

        {routeInfo && !isLoading && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-md text-[11px] font-semibold backdrop-blur-sm"
            style={{ background: 'rgba(9,9,11,0.82)', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.10)' }}
            title={`Free-flow: ${Math.round(routeInfo.free_flow_duration_minutes)} min | Provider: ${routeInfo.provider}`}
          >
            <span style={{ color: lineColor }}>⏱</span>
            <span>~{formatMin(routeInfo.duration_minutes)}</span>
            <span style={{ color: '#94a3b8' }}>·</span>
            <span>{routeInfo.distance_km.toFixed(1)} km</span>
          </div>
        )}
      </div>

      {/* ── Bottom-Right: Clean Custom Zoom Controls ── */}
      <div className="absolute bottom-2 right-2 z-[1000] flex flex-col gap-1 pointer-events-auto">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          className="w-7 h-7 rounded bg-slate-900/90 text-white hover:bg-slate-800 border border-white/20 shadow-lg flex items-center justify-center font-bold text-sm backdrop-blur-sm cursor-pointer transition-colors"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          className="w-7 h-7 rounded bg-slate-900/90 text-white hover:bg-slate-800 border border-white/20 shadow-lg flex items-center justify-center font-bold text-sm backdrop-blur-sm cursor-pointer transition-colors"
          title="Zoom out"
        >
          −
        </button>
      </div>

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

