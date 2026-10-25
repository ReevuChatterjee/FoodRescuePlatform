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
import { ExternalLink, Loader2, AlertTriangle, Zap } from 'lucide-react';
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

/** Swiggy/Zomato style animated delivery scooter marker icon with radar pulse & heading arrow */
function createDriverMarkerIcon(headingDeg: number) {
  return L.divIcon({
    className: 'driver-live-marker',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <!-- Pulsing Radar / Sonar Wave Ring (Swiggy/Zomato style) -->
        <div style="
          position: absolute;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.35);
          animation: driver-radar-pulse 2s infinite ease-out;
          pointer-events: none;
        "></div>
        
        <!-- Rotating Vehicle Container -->
        <div style="
          position: relative;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #0f172a;
          border: 2px solid #10b981;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5), 0 0 0 2px rgba(16, 185, 129, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(${Math.round(headingDeg)}deg);
          transition: transform 0.4s ease-out;
        ">
          <!-- Direction Heading Needle -->
          <div style="
            position: absolute;
            top: -6px;
            width: 0;
            height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-bottom: 6px solid #10b981;
          "></div>

          <!-- Scooter / Delivery Bike SVG -->
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f8fafc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="6" cy="17" r="3" fill="#10b981" stroke="#ffffff" stroke-width="1.5"/>
            <circle cx="18" cy="17" r="3" fill="#10b981" stroke="#ffffff" stroke-width="1.5"/>
            <path d="M6 17h4l3-6h-3" stroke="#f8fafc" stroke-width="2"/>
            <path d="M14 11l4 6" stroke="#f8fafc" stroke-width="2"/>
            <path d="M12 6h3" stroke="#f8fafc" stroke-width="2"/>
            <rect x="4" y="6" width="6" height="5" rx="1" fill="#f59e0b" stroke="#ffffff" stroke-width="1"/>
          </svg>
        </div>

        <!-- Live Status Pill -->
        <div style="
          position: absolute;
          bottom: -15px;
          background: rgba(15, 23, 42, 0.92);
          color: #ffffff;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.02em;
          padding: 1px 5px;
          border-radius: 9999px;
          white-space: nowrap;
          border: 1px solid rgba(16, 185, 129, 0.5);
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          pointer-events: none;
        ">
          Live GPS
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
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

// ─── Floating View Controller (My GPS / Delivery toggle) ──────────────────────

function MapViewController({ driver, pickup }: { driver: LatLngTuple | null; pickup: LatLngTuple | null }) {
  const map = useMap();
  if (!driver && !pickup) return null;

  return (
    <div className="leaflet-top leaflet-left" style={{ marginTop: '72px', marginLeft: '12px', zIndex: 1000, pointerEvents: 'auto' }}>
      <div className="flex flex-col gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded border border-white/15 shadow-xl">
        {driver && (
          <button
            type="button"
            title="Focus map on my GPS location"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              map.flyTo(driver, 16, { duration: 1.2 });
            }}
            className="px-2 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 rounded flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>📍</span> My GPS
          </button>
        )}
        {pickup && (
          <button
            type="button"
            title="Focus map on delivery stop"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              map.flyTo(pickup, 15, { duration: 1.2 });
            }}
            className="px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10 rounded flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>📦</span> Delivery
          </button>
        )}
      </div>
    </div>
  );
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
          setHeading(calculateBearing(line[idx], line[next]));
        }
        return next;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [isSimulating, line]);

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
      <MapContainer center={center} zoom={14} scrollWheelZoom={false} className="h-full w-full">
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
        <MapViewController driver={activeDriverPos} pickup={pickup} />
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
                <b className="text-emerald-600 block mb-0.5">🛵 Delivery Partner (Live)</b>
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

      {/* ── Live ETA chip + Simulation toggle (top-right) ─────────────── */}
      <div className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setIsSimulating((s: boolean) => !s);
            if (!isSimulating) setSimIndex(0);
          }}
          className={`px-2 py-1 rounded-full text-[10px] font-semibold border backdrop-blur-sm transition-all flex items-center gap-1 shadow-sm ${
            isSimulating
              ? 'bg-emerald-600 text-white border-emerald-400'
              : 'bg-slate-900/80 text-slate-300 border-white/10 hover:text-white'
          }`}
          title="Toggle movement simulation along the route"
        >
          <span>🛵</span>
          <span>{isSimulating ? 'Moving…' : 'Simulate'}</span>
        </button>

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

