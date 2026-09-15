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

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading donation details...</div>;
  if (error || !data) return <div className="p-8 text-center text-red-500">Failed to load donation details.</div>;

  const donation = data;
  const isCancellable = ['AVAILABLE', 'MATCHING', 'MATCHED', 'ACCEPTED', 'DRIVER_ASSIGNED', 'PICKUP_STARTED'].includes(donation.status);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">Donation Details</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">ID: {donation.id}</p>
          </div>
          <StatusBadge status={donation.status} />
        </div>
        
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Food Item</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {donation.food_name} ({donation.quantity_kg} kg, {donation.food_category})
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Expiry Time</dt>
              <dd className="mt-1 text-sm text-red-600 font-semibold sm:mt-0 sm:col-span-2">
                {format(new Date(donation.expiry_time), 'MMM d, yyyy HH:mm')}
              </dd>
            </div>
            {(donation.matched_ngo_id) && (
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Matched NGO</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{donation.matched_ngo_id}</dd>
              </div>
            )}
            {(donation.driver_id || donation.eta_minutes !== null) && (
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-blue-50">
                <dt className="text-sm font-medium text-blue-800">Driver & ETA</dt>
                <dd className="mt-1 text-sm text-blue-900 sm:mt-0 sm:col-span-2 font-medium">
                  {donation.driver_id && <span>Driver: {donation.driver_id} </span>}
                  {donation.eta_minutes !== null && <span>(ETA: {donation.eta_minutes} mins)</span>}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Map Section */}
      <div className="bg-white shadow sm:rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Location & Tracking</h3>
        {/* @ts-ignore */}
        <DonationMap pickupLocation={donation.pickup_location} ngoId={donation.matched_ngo_id} driverId={donation.driver_id} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Photo Upload Section */}
        <div className="bg-white shadow sm:rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Donation Photos</h3>
          <div className="space-y-4">
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              onClick={() => photoMutation.mutate()}
              disabled={!photo || photoMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50 text-sm font-medium"
            >
              {photoMutation.isPending ? 'Uploading...' : 'Upload Photo'}
            </button>
          </div>
        </div>

        {/* Cancel Section */}
        <div className="bg-white shadow sm:rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg leading-6 font-medium text-red-600 mb-4">Danger Zone</h3>
          {isCancellable ? (
            <div className="space-y-4">
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm"
              />
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={!cancelReason || cancelMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md disabled:opacity-50 text-sm font-medium"
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Donation'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              This donation cannot be cancelled because it is in status {donation.status}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
