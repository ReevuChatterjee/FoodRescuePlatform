/**
 * DriverDashboard (Person 5) — the driver's whole working screen.
 *
 * GET   /api/v1/drivers/me/current-job      job + route to the next stop
 * PATCH /api/v1/drivers/me/availability     online / offline toggle
 * POST  /api/v1/drivers/location            streamed every ≤5 s (useDriverLocation)
 * POST  /api/v1/deliveries/{id}/start|pickup|deliver|report-issue  (Idempotency-Key)
 * WS    /ws/deliveries, /ws/drivers         refresh the job when it changes
 *
 * DriverDashboard — full-bleed, map-dominant single-focus layout.
 * Uses DriverLayout with GPS broadcast button in the fixed bottom action bar.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Loader2, MapPinOff, Power, Radio, Truck, Navigation, ChevronDown, ChevronUp, Info, CheckCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { DriverLayout } from '../../components/layout/DriverLayout';
import { DriverRouteMap } from '../../components/driver/DriverRouteMap';
import { JobActions } from '../../components/driver/JobActions';
import { JobCard } from '../../components/driver/JobCard';
import { apiErrorMessage, useCurrentJob, useSetAvailability } from '../../hooks/useDriver';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { useDriverWebSocket } from '../../hooks/useDriverWebSocket';
import { useAuthStore } from '../../hooks/useAuthStore';
import { LocationAutocomplete } from '../../components/common/LocationAutocomplete';

const SOPS = [
  'Transmit coordinates regularly while on duty to ensure optimal routing.',
  'Monitor terminal for high-priority dispatch notifications via WebSocket.',
  'Verify payload condition at extraction point. Log evidence if compromised.',
  'Maintain comms with dispatch if anomalies occur during transit.',
];

export function DriverDashboard() {
  const { user } = useAuthStore();
  const { data, isLoading, isError, error, refetch } = useCurrentJob();
  const driver = data?.driver;
  const job = data?.job ?? null;

  const streaming = !!job || driver?.availability_status === 'AVAILABLE';
  const location = useDriverLocation(streaming);
  useDriverWebSocket(job?.delivery_id);

  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [address, setAddress] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const [sopOpen, setSopOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const locationMutation = useMutation({
    mutationFn: async ({ latitude, longitude }: { latitude: number; longitude: number }) => {
      const res = await apiClient.post('/api/v1/drivers/location', { latitude, longitude });
      return res.data;
    },
    onSuccess: () => {
      showToast('Location transmitted.', 'success');
      setBroadcastSuccess(true);
      setTimeout(() => setBroadcastSuccess(false), 4000);
    },
    onError: (e: any) =>
      showToast(e.response?.data?.error?.message || 'Transmission failed.', 'error'),
  });

  const useGPS = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported.', 'error');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setAddress('Current GPS Location');
        setGpsLoading(false);
        showToast('GPS lock acquired', 'success');
      },
      () => {
        showToast('Could not acquire GPS fix. Enter manually.', 'error');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const latitude  = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      showToast('Enter valid coordinates.', 'error');
      return;
    }
    locationMutation.mutate({ latitude, longitude });
  };

  // Bottom action bar content
  const actionBar = (
    <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, padding: '0 20px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
        <LocationAutocomplete
          value={address}
          onChange={setAddress}
          onSelect={(addr, latVal, lngVal) => {
            setAddress(addr);
            setLat(latVal.toFixed(6));
            setLng(lngVal.toFixed(6));
            // Auto-submit when selected from autocomplete
            locationMutation.mutate({ latitude: latVal, longitude: lngVal });
          }}
          placeholder="Search location or enter coordinates"
          className="input-base"
        />
      </div>
      <button
        type="button"
        className="btn-secondary"
        onClick={useGPS}
        disabled={gpsLoading}
        style={{ flexShrink: 0, padding: '8px 14px' }}
      >
        {gpsLoading
          ? <Loader2 size={14} className="animate-spin" />
          : <Navigation size={14} />
        }
      </button>
      <button
        type="submit"
        className="btn-primary"
        disabled={locationMutation.isPending || !lat || !lng}
        style={{ flexShrink: 0, padding: '8px 20px' }}
      >
        {locationMutation.isPending
          ? <><Loader2 size={13} className="animate-spin" /> Transmitting</>
          : broadcastSuccess
          ? <><CheckCircle size={13} /> Transmitted</>
          : <><Radio size={13} /> Broadcast</>
        }
      </button>
    </form>
  );

  return (
    <DriverLayout actionBar={actionBar}>
      {/* Toast */}
      {toast && (
        <div className={toast.type === 'success' ? 'toast-success' : 'toast-error'}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: '680px', padding: '1.25rem' }}>
        {/* Driver identity block — no card, no watermark */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-hair)' }}>
          <p className="section-label" style={{ marginBottom: '8px' }}>Unit Identity</p>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2rem',
                  fontWeight: 300,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.025em',
                  marginBottom: '6px',
                  fontVariationSettings: "'opsz' 32",
                }}
              >
                {user?.name}
              </h1>
              <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
                <span className="font-mono-data" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {user?.email}
                </span>
                <span
                  className="font-mono-data section-label"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border-hair)', padding: '2px 8px' }}
                >
                  {user?.id?.substring(0, 8).toUpperCase()}
                </span>
              </div>
            </div>
            {driver && <AvailabilityToggle status={driver.availability_status} hasJob={!!job} position={location.position} />}
          </div>
        </div>

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
          <div className="space-y-4 mb-8">
            <JobCard job={job} />
            <DriverRouteMap job={job} driverPosition={location.position ?? driver.current_location} />
            <JobActions job={job} vehicleCapacityKg={driver.capacity_kg} />
          </div>
        )}

        {driver && !job && (
          <div className="mb-8">
            <IdleState status={driver.availability_status} capacityKg={driver.capacity_kg} />
          </div>
        )}

        {driver && streaming && (
          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mb-8" aria-live="polite">
            <Radio size={12} className={location.lastSentAt ? 'text-[var(--moss)]' : ''} />
            {location.lastError
              ?? (location.lastSentAt
                ? `Location shared at ${new Date(location.lastSentAt).toLocaleTimeString()}`
                : 'Waiting for your first location fix…')}
          </p>
        )}

        {/* Coordinate entry info */}
        <div style={{ marginBottom: '1.25rem' }}>
          <p className="section-label" style={{ marginBottom: '10px' }}>Positional Telemetry</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '60ch' }}>
            Broadcast your current coordinates to the dispatch algorithm.
            Continuous updates ensure accurate routing for surplus pickups.
            Coordinates are entered in the action bar below.
          </p>
        </div>

        {/* Current coordinates display (if set) */}
        {lat && lng && (
          <div
            className="surface-dense"
            style={{ padding: '14px 16px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '24px' }}
          >
            <div>
              <p className="section-label" style={{ marginBottom: '4px' }}>Latitude</p>
              <p className="font-mono-data" style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{lat}</p>
            </div>
            <div>
              <p className="section-label" style={{ marginBottom: '4px' }}>Longitude</p>
              <p className="font-mono-data" style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{lng}</p>
            </div>
            {broadcastSuccess && (
              <div
                className="flex items-center gap-1.5"
                style={{ marginLeft: 'auto', color: 'var(--moss-light)' }}
              >
                <CheckCircle size={13} />
                <span className="section-label" style={{ color: 'var(--moss-light)' }}>Transmitted</span>
              </div>
            )}
          </div>
        )}

        {/* Dispatch notice */}
        <div
          style={{
            padding: '12px 16px',
            borderLeft: '3px solid var(--border-med)',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <Info size={14} style={{ color: 'var(--text-muted)', marginTop: '1px', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              Dispatch Control
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Active delivery assignments are managed by central dispatch.
              When routing assigns a payload, a notification arrives via WebSocket.
            </p>
          </div>
        </div>

        {/* SOPs — collapsible, not always-visible */}
        <div>
          <button
            onClick={() => setSopOpen((v) => !v)}
            className="flex items-center gap-2"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <span className="section-label" style={{ color: 'var(--text-muted)' }}>Standard Operating Procedures</span>
            {sopOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {sopOpen && (
            <ul style={{ marginTop: '12px', listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {SOPS.map((tip, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3"
                  style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}
                >
                  <span
                    className="font-mono-data"
                    style={{
                      fontSize: '0.625rem',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-hair)',
                      padding: '1px 5px',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DriverLayout>
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
          ? 'border-[var(--moss)] bg-[var(--moss)]/10 text-[var(--moss)]'
          : 'border-[var(--border-hair)] text-[var(--text-secondary)]'}`}
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
    <div className="panel p-8 text-center space-y-3 bg-[var(--bg-base)] border-[var(--border-hair)]">
      <Truck size={40} className={`mx-auto ${online ? 'text-[var(--moss)]' : 'text-[var(--text-muted)]'}`} />
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
    <div role="alert" className="p-4 rounded-sm border flex items-start gap-3 mb-4"
      style={{ borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
      <span style={{ color }} className="mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-bold" style={{ color }}>{title}</p>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">{children}</p>
      </div>
    </div>
  );
}
