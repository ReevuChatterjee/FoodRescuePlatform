/**
 * Current job summary for the driver (Person 5): next stop, priority, remaining
 * shelf life, slack, food details, special handling and safety info.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, MapPin, Package, Snowflake, Timer } from 'lucide-react';
import type { DriverJob, Priority } from '../../hooks/useDriver';

const PRIORITY_BADGE: Record<Priority, string> = {
  CRITICAL: 'badge-red',
  HIGH: 'badge-orange',
  MEDIUM: 'badge-yellow',
  LOW: 'badge-green',
  EXPIRED: 'badge-gray',
};

const STATUS_LABEL: Record<string, string> = {
  DRIVER_ASSIGNED: 'Assigned',
  PICKUP_STARTED: 'Heading to pickup',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'In transit',
};

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/** Minutes until `iso`, re-evaluated every 30 s so the countdown stays live. */
function useMinutesUntil(iso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return (new Date(iso).getTime() - now) / 60_000;
}

export function JobCard({ job }: { job: DriverJob }) {
  const toPickup = job.next_stop === 'PICKUP';
  const stop = toPickup ? job.pickup : job.dropoff;
  const shelfLife = useMinutesUntil(job.timeline.expiry_time);
  const slack = job.timeline.slack_minutes;
  const safety = job.food_safety_info;

  return (
    <section className="panel p-5 space-y-5 bg-[var(--bg-page)] border-[var(--border-strong)]" aria-label="Current job">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Next stop · {toPickup ? 'Pickup' : 'Drop-off'}
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            {stop.organisation_name ?? (toPickup ? 'Donor pickup' : 'NGO drop-off')}
          </h2>
          {stop.address && (
            <p className="text-sm text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
              <MapPin size={14} className="shrink-0" /> {stop.address}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`badge ${PRIORITY_BADGE[job.priority]}`} data-testid="priority-badge">{job.priority}</span>
          <span className="badge badge-gray">{STATUS_LABEL[job.status] ?? job.status}</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={<Clock size={14} />} label="ETA" value={formatMinutes(job.route_to_next_stop?.duration_minutes)}
          hint={job.route_to_next_stop ? `${job.route_to_next_stop.distance_km.toFixed(1)} km` : undefined} />
        <Stat icon={<Timer size={14} />} label="Shelf life left" value={formatMinutes(shelfLife)}
          tone={shelfLife < 60 ? 'error' : undefined} />
        <Stat icon={<AlertTriangle size={14} />} label="Slack" value={formatMinutes(slack)}
          hint={slack != null && slack < 15 ? 'Tight: go now' : undefined}
          tone={slack != null && slack < 15 ? 'warning' : undefined} />
        <Stat icon={<Package size={14} />} label="Load" value={`${job.quantity_kg.toFixed(1)} kg`} hint={job.food_category} />
      </dl>

      <div className="space-y-2">
        <p className="text-base font-semibold text-[var(--text-primary)]">{job.food_name}</p>
        {job.special_handling && (
          <p className="text-sm p-3 rounded-sm border border-[var(--warning)]/30 bg-[var(--warning)]/5 text-[var(--text-primary)] flex gap-2">
            <Snowflake size={16} className="text-[var(--warning)] shrink-0 mt-0.5" /> {job.special_handling}
          </p>
        )}
        {safety && (
          <ul className="flex flex-wrap gap-2 text-xs">
            {safety.storage_temp_required && <li className="badge badge-blue">{safety.storage_temp_required}</li>}
            {safety.packaging_type && <li className="badge badge-gray">{safety.packaging_type.replace(/_/g, ' ')}</li>}
            {safety.allergen_tags?.map((tag) => <li key={tag} className="badge badge-orange">Allergen: {tag}</li>)}
          </ul>
        )}
        {!toPickup && job.dropoff.operating_hours && (
          <p className="text-xs text-[var(--text-muted)]">
            NGO open {job.dropoff.operating_hours.start}–{job.dropoff.operating_hours.end}
          </p>
        )}
      </div>
    </section>
  );
}

function Stat({ icon, label, value, hint, tone }: {
  icon: React.ReactNode; label: string; value: string; hint?: string; tone?: 'error' | 'warning';
}) {
  const color = tone === 'error' ? 'text-[var(--error)]' : tone === 'warning' ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]';
  return (
    <div className="p-3 rounded-sm bg-[var(--bg-panel)] border border-[var(--border-subtle)]">
      <dt className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-1.5">{icon} {label}</dt>
      <dd className={`text-lg font-bold font-mono-data mt-1 ${color}`}>{value}</dd>
      {hint && <dd className="text-[11px] text-[var(--text-muted)]">{hint}</dd>}
    </div>
  );
}
