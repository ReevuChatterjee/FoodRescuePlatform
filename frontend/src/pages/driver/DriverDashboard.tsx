/**
 * DriverDashboard — basic driver portal.
 * Shows driver availability status and allows updating current location.
 * POST /api/v1/drivers/location
 * Note: Full dispatch/routing is Person 5's work and not implemented here.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Truck, MapPin, Navigation, Loader2, CheckCircle, Info } from 'lucide-react';
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
    onSuccess: () => showToast('Location updated successfully!', 'success'),
    onError: (e: any) => showToast(e.response?.data?.error?.message || 'Failed to update location.', 'error'),
  });

  const useGPS = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported by your browser.', 'error');
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
        showToast('Could not get GPS location. Enter manually.', 'error');
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
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-sm text-sm font-medium shadow-lg border ${toast.type === 'success' ? 'bg-emerald-950 border-emerald-900 text-emerald-400' : 'bg-red-950 border-red-900 text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Driver Dashboard</h1>
          <p className="page-subtitle">Manage your availability and location</p>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 rounded-sm bg-emerald-950 border border-emerald-900">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Online</span>
        </div>
      </div>

      <div className="max-w-xl space-y-6">
        {/* Driver info */}
        <div className="panel p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-sm bg-zinc-800 flex items-center justify-center text-zinc-400">
            <Truck size={24} />
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-100">{user?.name}</p>
            <p className="text-sm text-zinc-400">{user?.email}</p>
            <span className="badge-yellow mt-1">Driver</span>
          </div>
        </div>

        {/* Location update */}
        <div className="panel p-6">
          <h2 className="section-title"><MapPin size={16} className="text-zinc-400" /> Update Current Location</h2>
          <p className="text-sm text-zinc-400 mb-6">
            Share your current location so the platform can assign you nearby pickups.
          </p>

          <button
            type="button"
            className="btn-secondary w-full mb-6"
            onClick={useGPS}
            disabled={gpsLoading}
          >
            {gpsLoading
              ? <><Loader2 size={16} className="animate-spin" /> Getting GPS…</>
              : <><Navigation size={16} /> Auto-detect via GPS</>
            }
          </button>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Latitude</label>
                <input
                  className="input-base font-mono text-sm"
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="e.g. 28.704060"
                />
              </div>
              <div>
                <label className="form-label">Longitude</label>
                <input
                  className="input-base font-mono text-sm"
                  type="number"
                  step="0.000001"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="e.g. 77.102493"
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={locationMutation.isPending || !lat || !lng}
            >
              {locationMutation.isPending
                ? <><Loader2 size={16} className="animate-spin" /> Updating…</>
                : <><CheckCircle size={16} /> Broadcast Location</>
              }
            </button>
          </form>
        </div>

        {/* Info card — no delivery dispatch */}
        <div className="p-4 rounded-sm border border-blue-900 bg-blue-950 flex items-start gap-3">
          <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-400 mb-1">Active Deliveries</p>
            <p className="text-xs text-blue-300/80 leading-relaxed">
              Active delivery assignments and routing are managed by the dispatch system.
              When you are assigned a delivery, you will receive a notification here via WebSocket.
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="panel">
          <h3 className="section-title"><CheckCircle size={16} className="text-zinc-400" /> Driver Procedures</h3>
          <ul className="space-y-3">
            {[
              'Update your location frequently while on duty to get nearby assignments.',
              'Check your phone for delivery notifications when matched.',
              'Always confirm food condition at pickup and ask for a photo if needed.',
              'Contact the platform admin if you face issues during a delivery.',
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                <span className="w-5 h-5 rounded-sm bg-zinc-800 text-zinc-500 flex items-center justify-center flex-shrink-0 text-xs font-mono">
                  {i + 1}
                </span>
                <span className="mt-0.5">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}
