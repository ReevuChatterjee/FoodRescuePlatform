/**
 * Driver route map (Person 5): driver, pickup and NGO markers plus the route to
 * the next stop. A heuristic route is a straight-line estimate, not a road, so
 * it is drawn dashed and labelled; OSRM/TomTom routes are drawn solid.
 */

import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
// @ts-ignore — image imports resolved by Vite
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import type { DriverJob, GeoPoint } from '../../hooks/useDriver';
import { safeDecodePolyline, type LatLngTuple } from './polyline';

// Same default-icon fix as components/donor/DonationMap.tsx.
L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const toTuple = (p: { latitude: number | null; longitude: number | null } | null | undefined): LatLngTuple | null =>
  p && p.latitude != null && p.longitude != null ? [p.latitude, p.longitude] : null;

export function isStraightLineEstimate(provider: string | undefined): boolean {
  return provider === 'heuristic';
}

function FitBounds({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join(';');
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 15);
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [32, 32] });
    // Refit only when the set of points changes (key), not on every render.
  }, [key, map]);
  return null;
}

interface Props {
  job: DriverJob;
  driverPosition: GeoPoint | null;
}

export function DriverRouteMap({ job, driverPosition }: Props) {
  const pickup = toTuple(job.pickup);
  const dropoff = toTuple(job.dropoff);
  const driver = toTuple(driverPosition);
  const route = job.route_to_next_stop;
  const line = useMemo(() => safeDecodePolyline(route?.geometry), [route?.geometry]);
  const dashed = isStraightLineEstimate(route?.provider);

  const fitPoints = [driver, job.next_stop === 'PICKUP' ? pickup : dropoff].filter(Boolean) as LatLngTuple[];
  const center = fitPoints[0] ?? pickup ?? dropoff ?? ([12.9716, 77.5946] as LatLngTuple); // Bengaluru

  return (
    <div className="relative h-72 sm:h-96 w-full rounded-sm overflow-hidden border border-[var(--border-strong)]">
      <MapContainer center={center} zoom={14} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <FitBounds points={fitPoints} />
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
            pathOptions={{ color: '#10b981', weight: 5, opacity: 0.85, dashArray: dashed ? '8 10' : undefined }}
          />
        )}
      </MapContainer>
      {route && dashed && (
        <div className="absolute bottom-2 left-2 z-[1000] px-2 py-1 rounded-sm text-[11px] bg-[var(--bg-page)]/90 border border-[var(--border-subtle)] text-[var(--text-secondary)]">
          Straight-line estimate, not a road route
        </div>
      )}
    </div>
  );
}
