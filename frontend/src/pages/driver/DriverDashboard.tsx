/**
 * DriverDashboard (Person 5) — the driver's whole working screen.
 *
 * GET   /api/v1/drivers/me/current-job      job + route to the next stop
 * PATCH /api/v1/drivers/me/availability     online / offline toggle
 * POST  /api/v1/drivers/location            streamed every ≤5 s (useDriverLocation)
 * POST  /api/v1/deliveries/{id}/start|pickup|deliver|report-issue  (Idempotency-Key)
 * WS    /ws/deliveries, /ws/drivers         refresh the job when it changes
 *
 * Mobile-first: one column, large controls, and nothing to operate while driving;
 * location and job updates happen on their own.
 */

import { AlertTriangle, Loader2, MapPinOff, Power, Radio, Truck } from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { DriverRouteMap } from '../../components/driver/DriverRouteMap';
import { JobActions } from '../../components/driver/JobActions';
import { JobCard } from '../../components/driver/JobCard';
import { apiErrorMessage, useCurrentJob, useSetAvailability } from '../../hooks/useDriver';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { useDriverWebSocket } from '../../hooks/useDriverWebSocket';
import { useAuthStore } from '../../hooks/useAuthStore';

export function DriverDashboard() {
  const { user } = useAuthStore();
  const { data, isLoading, isError, error, refetch } = useCurrentJob();
  const driver = data?.driver;
  const job = data?.job ?? null;

  const streaming = !!job || driver?.availability_status === 'AVAILABLE';
  const location = useDriverLocation(streaming);
  useDriverWebSocket(job?.delivery_id);

  return (
    <AppLayout>
      <div className="page-header flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{job ? 'Active delivery' : 'Driver'}</h1>
          <p className="page-subtitle">{user?.name}</p>
        </div>
        {driver && <AvailabilityToggle status={driver.availability_status} hasJob={!!job} position={location.position} />}
      </div>

      <div className="max-w-2xl space-y-4">
        {location.permission === 'denied' && (
          <Banner tone="error" icon={<MapPinOff size={18} />} title="Location is off">
            You can't be dispatched without location. Allow location access for this site in your browser settings.
          </Banner>
        )}
        {location.permission === 'unsupported' && (
          <Banner tone="error" icon={<MapPinOff size={18} />} title="No location on this device">
            This browser can't share your location, so dispatch can't find you.
          </Banner>
        )}

        {isLoading && (
          <div className="panel p-8 flex items-center justify-center text-[var(--text-secondary)]">
            <Loader2 className="animate-spin mr-2" size={18} /> Loading your job…
          </div>
        )}

        {isError && (
          <Banner tone="error" icon={<AlertTriangle size={18} />} title="Couldn't load your job">
            {apiErrorMessage(error)}{' '}
            <button type="button" className="underline" onClick={() => void refetch()}>Retry</button>
          </Banner>
        )}

        {driver && job && (
          <>
            <JobCard job={job} />
            <DriverRouteMap job={job} driverPosition={location.position ?? driver.current_location} />
            <JobActions job={job} vehicleCapacityKg={driver.capacity_kg} />
          </>
        )}

        {driver && !job && <IdleState status={driver.availability_status} capacityKg={driver.capacity_kg} />}

        {driver && streaming && (
          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5" aria-live="polite">
            <Radio size={12} className={location.lastSentAt ? 'text-[var(--brand)]' : ''} />
            {location.lastError
              ?? (location.lastSentAt
                ? `Location shared at ${new Date(location.lastSentAt).toLocaleTimeString()}`
                : 'Waiting for your first location fix…')}
          </p>
        )}
      </div>
    </AppLayout>
  );
}

function AvailabilityToggle({ status, hasJob, position }: {
  status: string; hasJob: boolean; position: { latitude: number; longitude: number } | null;
}) {
  const setAvailability = useSetAvailability();
  const online = status !== 'OFFLINE';
  const label = hasJob ? 'On a job' : online ? 'Online' : 'Offline';

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={online}
        disabled={hasJob || setAvailability.isPending}
        title={hasJob ? 'Finish or report an issue with your delivery first' : undefined}
        onClick={() => setAvailability.mutate({
          availability_status: online ? 'OFFLINE' : 'AVAILABLE',
          location: online ? null : position,
        })}
        className={`min-h-[48px] px-5 rounded-sm border text-sm font-bold uppercase tracking-widest flex items-center gap-2 ${online
          ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]'
          : 'border-[var(--border-strong)] text-[var(--text-secondary)]'}`}
      >
        {setAvailability.isPending ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />} {label}
      </button>
      {setAvailability.isError && <p role="alert" className="form-error">{apiErrorMessage(setAvailability.error)}</p>}
    </div>
  );
}

function IdleState({ status, capacityKg }: { status: string; capacityKg: number }) {
  const online = status === 'AVAILABLE';
  return (
    <div className="panel p-8 text-center space-y-3 bg-[var(--bg-page)] border-[var(--border-strong)]">
      <Truck size={40} className={`mx-auto ${online ? 'text-[var(--brand)]' : 'text-[var(--text-muted)]'}`} />
      <p className="text-lg font-semibold text-[var(--text-primary)]">
        {online ? 'Waiting for a job' : 'You are offline'}
      </p>
      <p className="text-sm text-[var(--text-secondary)]">
        {online
          ? `When an NGO accepts a donation near you that fits your ${capacityKg.toFixed(1)} kg vehicle, it appears here automatically.`
          : 'Go online to receive delivery jobs.'}
      </p>
    </div>
  );
}

function Banner({ tone, icon, title, children }: {
  tone: 'error' | 'warning'; icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  const color = tone === 'error' ? 'var(--error)' : 'var(--warning)';
  return (
    <div role="alert" className="p-4 rounded-sm border flex items-start gap-3"
      style={{ borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
      <span style={{ color }} className="mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-bold" style={{ color }}>{title}</p>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">{children}</p>
      </div>
    </div>
  );
}
