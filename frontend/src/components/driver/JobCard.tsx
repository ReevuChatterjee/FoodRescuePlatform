import { useEffect, useState } from 'react';
import type { DriverJob, RouteEstimate } from '../../hooks/useDriver';
import type { TrafficRouteSource } from '../../hooks/useTrafficRoute';

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

function useMinutesUntil(iso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return (new Date(iso).getTime() - now) / 60_000;
}

const TIMELINE_STATES = [
  { id: 'DRIVER_ASSIGNED', label: 'Assigned' },
  { id: 'PICKUP_STARTED', label: 'Pickup' },
  { id: 'PICKED_UP', label: 'Collected' },
  { id: 'IN_TRANSIT', label: 'In transit' },
  { id: 'DELIVERED', label: 'Delivered' }
];

// Colour dot for ETA traffic source indicator
const SOURCE_DOT: Record<TrafficRouteSource, { color: string; title: string }> = {
  live:       { color: '#22c55e', title: 'Live traffic (TomTom)' },
  road_model: { color: '#6366f1', title: 'Road route with modelled traffic' },
  heuristic:  { color: '#f97316', title: 'Straight-line estimate' },
  static:     { color: '#f97316', title: 'Estimated at job creation' },
  none:       { color: '#94a3b8', title: 'Loading…' },
};

interface JobCardProps {
  job: DriverJob;
  /** Live route info from useTrafficRoute — updates ETA as driver moves. */
  liveRoute?: RouteEstimate | null;
  /** Traffic source label for the ETA dot. */
  liveRouteSource?: TrafficRouteSource;
}

export function JobCard({ job, liveRoute, liveRouteSource = 'none' }: JobCardProps) {
  const shelfLife = useMinutesUntil(job.timeline.expiry_time);
  const safety = job.food_safety_info;
  
  // Find current index
  const currentIndex = TIMELINE_STATES.findIndex(s => s.id === job.status);

  // Use live route info when available, fall back to job's static estimate.
  const etaMinutes = liveRoute?.duration_minutes ?? job.route_to_next_stop?.duration_minutes;
  const distKm = liveRoute?.distance_km ?? job.route_to_next_stop?.distance_km;
  const dot = liveRoute ? SOURCE_DOT[liveRouteSource] : SOURCE_DOT.static;

  return (
    <div className="space-y-8">
      
      {/* Route Anchors (Massive Vertical Flow) */}
      <div>
         <div className="mb-2">
           <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Pickup</p>
           <p className="text-[1.5rem] font-semibold text-on-surface leading-tight mb-1">{job.pickup.organisation_name ?? 'Donor pickup'}</p>
           {job.pickup.address && <p className="text-[1rem] text-on-surface-variant leading-relaxed">{job.pickup.address}</p>}
         </div>
         
         <div className="py-2 pl-2">
            <span className="text-xl font-bold text-outline-variant">↓</span>
         </div>

         <div className="mt-2">
           <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Destination</p>
           <p className="text-[1.5rem] font-semibold text-on-surface leading-tight mb-1">{job.dropoff.organisation_name ?? 'NGO drop-off'}</p>
           {job.dropoff.address && <p className="text-[1rem] text-on-surface-variant leading-relaxed">{job.dropoff.address}</p>}
         </div>
      </div>

      {/* Delivery Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-6 border-y border-outline-variant/30">
         <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Food</p>
            <p className="text-[0.875rem] text-on-surface font-medium">{job.food_name}</p>
            <p className="text-[0.75rem] text-on-surface-variant">{job.food_category.replace(/_/g, ' ').toLowerCase()}</p>
         </div>
         <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Load</p>
            <p className="text-[0.875rem] font-mono-data text-on-surface font-semibold">{job.quantity_kg.toFixed(1)} kg</p>
         </div>
         <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Pickup Window</p>
            <p className="text-[0.875rem] font-mono-data text-on-surface font-semibold">
              {job.timeline.estimated_pickup_time ? new Date(job.timeline.estimated_pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ASAP'}
            </p>
         </div>
         <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1 flex items-center gap-1.5">
              ETA
              <span
                className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
                style={{ background: dot.color }}
                title={dot.title}
              />
            </p>
            <p className="text-[0.875rem] font-mono-data text-on-surface font-semibold">
              {formatMinutes(etaMinutes)}
              {distKm != null && (
                <span className="text-[0.75rem] font-normal text-on-surface-variant ml-1.5">
                  · {distKm.toFixed(1)} km
                </span>
              )}
            </p>
            <p className={`text-[0.75rem] ${shelfLife < 60 ? 'text-warning font-semibold' : 'text-on-surface-variant'}`}>
              Expires in {formatMinutes(shelfLife)}
            </p>
         </div>
      </div>

      {/* Handling & Safety (Only if present) */}
      {(job.special_handling || safety) && (
        <div className="bg-surface-container-lowest p-5 border-l-4 border-l-primary border-y border-y-outline-variant/50 border-r border-r-outline-variant/50 rounded-r space-y-4">
          <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface mb-2">Special Handling</p>
          
          {job.special_handling && (
             <p className="text-[0.875rem] font-medium text-on-surface">{job.special_handling}</p>
          )}
          {safety && (
             <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[0.875rem] text-on-surface-variant">
               {safety.storage_temp_required && <li>• {safety.storage_temp_required.replace(/_/g, ' ')}</li>}
               {safety.packaging_type && <li>• {safety.packaging_type.replace(/_/g, ' ')}</li>}
               {safety.allergen_tags?.map((tag) => <li key={tag} className="text-warning font-medium">• Allergen: {tag}</li>)}
             </ul>
          )}
        </div>
      )}

      {/* Operational Timeline */}
      <div className="pt-2">
         <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Delivery Status</p>
         <div className="flex items-center flex-wrap gap-y-2 text-[0.75rem] font-semibold uppercase tracking-wider">
            {TIMELINE_STATES.map((state, i) => {
              const isCurrent = i === currentIndex;
              const isPast = i < currentIndex;
              return (
                <div key={state.id} className="flex items-center">
                  <span className={`${isCurrent ? 'text-primary' : isPast ? 'text-primary/60' : 'text-on-surface-variant/40'}`}>
                    {state.label}
                  </span>
                  {i < TIMELINE_STATES.length - 1 && (
                    <span className="mx-2 text-outline-variant/50">→</span>
                  )}
                </div>
              )
            })}
         </div>
      </div>
    </div>
  );
}

