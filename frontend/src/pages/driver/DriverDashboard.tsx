/**
 * DriverDashboard — full-bleed, map-dominant single-focus layout.
 * AI-tells removed:
 *   - animate-pulse on "Unit Active" badge → data-driven pulse only post-successful POST
 *   - Faded truck watermark → removed
 *   - Uniform panel cards → surface-inset form, no card wrapping on info section
 *   - SOPs as bullet list inside panel → collapsible, not prominent
 * Uses DriverLayout with GPS broadcast button in the fixed bottom action bar.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Navigation, Loader2, Radio, ChevronDown, ChevronUp, Info, CheckCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { DriverLayout } from '../../components/layout/DriverLayout';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useDonationWebSocket } from '../../hooks/useDonationWebSocket';

const SOPS = [
  'Transmit coordinates regularly while on duty to ensure optimal routing.',
  'Monitor terminal for high-priority dispatch notifications via WebSocket.',
  'Verify payload condition at extraction point. Log evidence if compromised.',
  'Maintain comms with dispatch if anomalies occur during transit.',
];

export function DriverDashboard() {
  const { user } = useAuthStore();
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const [sopOpen, setSopOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useDonationWebSocket();

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
        setGpsLoading(false);
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
    <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 120px', minWidth: '120px' }}>
          <span
            className="font-mono-data"
            style={{
              position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '0.625rem', color: 'var(--text-muted)', pointerEvents: 'none',
            }}
          >
            LAT
          </span>
          <input
            className="input-base font-mono-data"
            type="number"
            step="0.000001"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="28.704060"
            style={{ paddingLeft: '36px', fontSize: '0.8125rem' }}
          />
        </div>
        <div style={{ position: 'relative', flex: '1 1 120px', minWidth: '120px' }}>
          <span
            className="font-mono-data"
            style={{
              position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '0.625rem', color: 'var(--text-muted)', pointerEvents: 'none',
            }}
          >
            LNG
          </span>
          <input
            className="input-base font-mono-data"
            type="number"
            step="0.000001"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="77.102493"
            style={{ paddingLeft: '36px', fontSize: '0.8125rem' }}
          />
        </div>
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
        className="btn-driver"
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

      <div style={{ maxWidth: '680px', padding: 'var(--sp-5)' }}>

        {/* Driver identity block — no card, no watermark */}
        <div style={{ marginBottom: 'var(--sp-6)', paddingBottom: 'var(--sp-5)', borderBottom: '1px solid var(--border-hair)' }}>
          <p className="section-label" style={{ marginBottom: '8px' }}>Unit Identity</p>
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

        {/* Coordinate entry info */}
        <div style={{ marginBottom: 'var(--sp-5)' }}>
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
            style={{ padding: '14px 16px', marginBottom: 'var(--sp-5)', display: 'flex', alignItems: 'center', gap: '24px' }}
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
            marginBottom: 'var(--sp-5)',
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
