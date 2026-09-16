/**
 * DriverDashboard — basic driver portal.
 * Shows driver availability status and allows updating current location.
 * POST /api/v1/drivers/location
 * Note: Full dispatch/routing is Person 5's work and not implemented here.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Truck, MapPin, Navigation, Loader2, CheckCircle, Info, Radio, Activity, Target } from 'lucide-react';
import { apiClient } from '../../api/client';
import { AppLayout } from '../../components/layout/AppLayout';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useDonationWebSocket } from '../../hooks/useDonationWebSocket';

export function DriverDashboard() {
  const { user } = useAuthStore();
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
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
    onSuccess: () => showToast('Telemetry updated successfully!', 'success'),
    onError: (e: any) => showToast(e.response?.data?.error?.message || 'Failed to update telemetry.', 'error'),
  });

  const useGPS = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported by your hardware.', 'error');
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
        showToast('Could not get GPS fix. Enter manually.', 'error');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      showToast('Please enter valid coordinates.', 'error');
      return;
    }
    locationMutation.mutate({ latitude, longitude });
  };

  return (
    <AppLayout>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-md text-sm font-semibold tracking-wide shadow-lg border ${
          toast.type === 'success' ? 'bg-[var(--success)]/10 border-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--error)]/10 border-[var(--error)]/20 text-[var(--error)]'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title">Fleet Telemetry Module</h1>
          <p className="page-subtitle">Manage unit availability and positional data</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[var(--brand)]/10 border border-[var(--brand)]/30 animate-pulse">
          <Activity size={12} className="text-[var(--brand)]" />
          <span className="text-[10px] font-bold text-[var(--brand)] uppercase tracking-widest">Unit Active</span>
        </div>
      </div>

      <div className="max-w-xl space-y-6">
        {/* Driver info */}
        <div className="panel p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 border-[var(--border-strong)] bg-[var(--bg-page)] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
            <Truck size={120} />
          </div>
          <div className="w-14 h-14 rounded-sm bg-[var(--bg-panel)] flex items-center justify-center border border-[var(--border-subtle)] relative z-10 text-[var(--brand)] shadow-inner">
            <Truck size={28} />
          </div>
          <div className="relative z-10 flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xl font-bold tracking-tight text-[var(--text-primary)]">{user?.name}</p>
              <span className="text-[10px] font-mono-data text-[var(--text-muted)] bg-[var(--bg-panel)] px-2 py-0.5 rounded-sm border border-[var(--border-subtle)]">
                 CALLSIGN: {user?.id?.substring(0, 8).toUpperCase() || 'UNKNOWN'}
              </span>
            </div>
            <p className="text-sm font-mono-data text-[var(--text-secondary)] mb-3">{user?.email}</p>
            <span className="inline-block px-2 py-0.5 rounded-sm bg-[var(--warning)] text-black text-[10px] font-bold uppercase tracking-widest shadow-sm">
              Logistics Unit
            </span>
          </div>
        </div>

        {/* Location update */}
        <div className="panel p-6 border-[var(--border-strong)] bg-[var(--bg-page)]">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-6 flex items-center gap-2">
            <Target size={14} className="text-[var(--brand)]" /> Positional Fix
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
            Broadcast your current coordinates to the dispatch algorithm. Continuous updates ensure accurate routing for surplus pickups.
          </p>

          <button
            type="button"
            className="w-full mb-6 py-3 rounded-sm text-sm font-semibold tracking-wide flex items-center justify-center gap-2 bg-[var(--bg-panel)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--brand)] transition-colors"
            onClick={useGPS}
            disabled={gpsLoading}
          >
            {gpsLoading
              ? <><Loader2 size={16} className="animate-spin text-[var(--brand)]" /> ACQUIRING HARDWARE FIX…</>
              : <><Navigation size={16} className="text-[var(--brand)]" /> INITIATE AUTO-TRACKING</>
            }
          </button>

          <form onSubmit={handleSubmit} className="space-y-6 p-4 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 block">Latitude</label>
                <div className="relative">
                  <input
                    className="input-base font-mono-data pl-8 bg-[var(--bg-page)]"
                    type="number"
                    step="0.000001"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="e.g. 28.704060"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[10px] font-mono-data">N</div>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 block">Longitude</label>
                <div className="relative">
                   <input
                     className="input-base font-mono-data pl-8 bg-[var(--bg-page)]"
                     type="number"
                     step="0.000001"
                     value={lng}
                     onChange={(e) => setLng(e.target.value)}
                     placeholder="e.g. 77.102493"
                   />
                   <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[10px] font-mono-data">E</div>
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 bg-[var(--brand)] text-black"
              disabled={locationMutation.isPending || !lat || !lng}
            >
              {locationMutation.isPending
                ? <><Loader2 size={16} className="animate-spin" /> TRANSMITTING…</>
                : <><Radio size={16} /> BROADCAST TELEMETRY</>
              }
            </button>
          </form>
        </div>

        {/* Info card — no delivery dispatch */}
        <div className="p-4 rounded-sm border border-[var(--info)]/30 bg-[var(--info)]/5 flex items-start gap-3">
          <Info size={18} className="text-[var(--info)] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--info)] mb-1">Dispatch Control</p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Active delivery assignments and routing are managed by central dispatch.
              When algorithmic routing assigns a payload, a transmission will be received here via active WebSocket connection.
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="panel p-6 border-[var(--border-strong)] bg-[var(--bg-page)]">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-6 flex items-center gap-2">
            <CheckCircle size={14} className="text-[var(--brand)]" /> Standard Operating Procedures
          </h3>
          <ul className="space-y-4">
            {[
              'Transmit coordinates frequently while on duty to ensure optimal routing.',
              'Monitor terminal for high-priority dispatch notifications.',
              'Verify payload condition at extraction point. Log visual evidence if compromised.',
              'Maintain comms with dispatch control if anomalies occur during transit.',
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                <span className="w-5 h-5 rounded-sm bg-[var(--bg-panel)] text-[var(--brand)] flex items-center justify-center flex-shrink-0 text-[10px] font-mono-data border border-[var(--border-subtle)]">
                  0{i + 1}
                </span>
                <span className="mt-0.5 leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}
