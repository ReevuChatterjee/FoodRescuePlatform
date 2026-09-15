import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Donation, SuccessEnvelope } from '../../types/api';
import { StatusBadge } from '../../components/donor/StatusBadge';
import { DonationMap } from '../../components/donor/DonationMap';
import { useDonationWebSocket } from '../../hooks/useDonationWebSocket';
import { format } from 'date-fns';
import { useState } from 'react';

export function DonationDetails() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [cancelReason, setCancelReason] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);

  useDonationWebSocket();

  const { data, isLoading, error } = useQuery({
    queryKey: ['donation', id],
    queryFn: async () => {
      const response = await apiClient.get<SuccessEnvelope<Donation>>(`/api/v1/donations/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.patch(`/api/v1/donations/${id}/cancel`, { reason: cancelReason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation', id] });
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      setCancelReason('');
    },
  });

  const photoMutation = useMutation({
    mutationFn: async () => {
      if (!photo) return;
      const formData = new FormData();
      formData.append('file', photo);
      const response = await apiClient.post(`/api/v1/donations/${id}/photos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      alert('Photo uploaded successfully (stored in audit log for demo).');
      setPhoto(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-sm text-zinc-500 font-mono tracking-wider uppercase">Retrieving record...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 p-4 border border-red-200 rounded-md text-red-700 text-sm">
        Failed to load donation details.
      </div>
    );
  }

  const donation = data;
  const isCancellable = ['AVAILABLE', 'MATCHING', 'MATCHED', 'ACCEPTED', 'DRIVER_ASSIGNED', 'PICKUP_STARTED'].includes(donation.status);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-md border border-zinc-200 shadow-sm">
        <div className="px-6 py-5 border-b border-zinc-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 tracking-tight">Record Detail</h3>
            <p className="mt-1 text-xs text-zinc-500 font-mono">ID: {donation.id}</p>
          </div>
          <StatusBadge status={donation.status} />
        </div>
        
        <div className="px-6 py-5">
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6">
            <div className="sm:col-span-1">
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Food Item</dt>
              <dd className="text-sm text-zinc-900 font-semibold">
                {donation.food_name}
                <div className="text-xs text-zinc-500 font-normal mt-0.5">{donation.quantity_kg} kg • {donation.food_category}</div>
              </dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Expiry</dt>
              <dd className="text-sm text-red-600 font-mono font-semibold">
                {format(new Date(donation.expiry_time), 'MMM d, yyyy HH:mm')}
              </dd>
            </div>
            {(donation.matched_ngo_id) && (
              <div className="sm:col-span-1">
                <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Matched NGO</dt>
                <dd className="text-sm font-mono text-zinc-900">{donation.matched_ngo_id.split('_').pop()}</dd>
              </div>
            )}
          </dl>
          
          {(donation.driver_id || donation.eta_minutes !== null) && (
            <div className="mt-6 pt-4 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center gap-4">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-emerald-600 mb-1">Active Dispatch</dt>
                <dd className="text-sm text-zinc-900 flex items-center gap-4">
                  {donation.driver_id && <span className="font-mono bg-zinc-100 px-2 py-1 rounded border border-zinc-200">DRV: {donation.driver_id.split('_').pop()}</span>}
                  {donation.eta_minutes !== null && <span className="font-semibold text-amber-600">ETA: {donation.eta_minutes}m</span>}
                </dd>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map Section */}
      <div className="bg-white rounded-md border border-zinc-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50">
          <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Logistics Routing</h3>
        </div>
        <div className="p-0">
          {/* @ts-ignore */}
          <DonationMap pickupLocation={donation.pickup_location} ngoId={donation.matched_ngo_id} driverId={donation.driver_id} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Photo Upload Section */}
        <div className="bg-white rounded-md border border-zinc-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-4">Verification Artifacts</h3>
          <div className="space-y-4">
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-xs file:font-semibold file:uppercase file:tracking-wider file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-colors"
            />
            <button
              onClick={() => photoMutation.mutate()}
              disabled={!photo || photoMutation.isPending}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-md disabled:opacity-50 text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              {photoMutation.isPending ? 'Transmitting...' : 'Upload Photo'}
            </button>
          </div>
        </div>

        {/* Cancel Section */}
        <div className="bg-white rounded-md border border-red-200 shadow-sm p-6 bg-red-50/30">
          <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-4">Abort Logistics</h3>
          {isCancellable ? (
            <div className="space-y-3">
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for aborting..."
                className="block w-full rounded-md border-red-200 shadow-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 border p-2 text-sm outline-none transition-shadow"
              />
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={!cancelReason || cancelMutation.isPending}
                className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md disabled:opacity-50 text-sm font-medium hover:bg-red-700 transition-colors"
              >
                {cancelMutation.isPending ? 'Processing...' : 'Abort Donation'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-red-600 font-medium">
              Action restricted: Logistics lock applied at state {donation.status}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
