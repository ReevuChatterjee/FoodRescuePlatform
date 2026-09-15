import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Donation, SuccessEnvelope } from '../../types/api';
import { StatusBadge } from '../../components/donor/StatusBadge';
import { useDonationWebSocket } from '../../hooks/useDonationWebSocket';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

export function DonorDashboard() {
  useDonationWebSocket();

  const { data, isLoading, error } = useQuery({
    queryKey: ['donations'],
    queryFn: async () => {
      const response = await apiClient.get<SuccessEnvelope<Donation[]>>('/api/v1/donations');
      return response.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-sm text-zinc-500 font-mono tracking-wider uppercase">Loading donations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 border border-red-200 rounded-md text-red-700 text-sm">
        Failed to load donations. Please try again.
      </div>
    );
  }

  const donations = data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-zinc-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Donation History</h2>
          <p className="text-sm text-zinc-500 mt-1">Track and manage your active and past food contributions.</p>
        </div>
        <Link
          to="/donor/donate"
          className="bg-amber-500 text-white px-4 py-2 rounded-md hover:bg-amber-600 transition-colors font-medium text-sm flex items-center gap-2 shadow-sm"
        >
          <Plus size={16} />
          New Donation
        </Link>
      </div>

      {donations.length === 0 ? (
        <div className="bg-white p-12 rounded-md text-center text-zinc-500 text-sm border border-zinc-200">
          No donations found. Start by creating a new donation.
        </div>
      ) : (
        <div className="bg-white rounded-md border border-zinc-200 overflow-hidden">
          <ul className="divide-y divide-zinc-200">
            {donations.map((donation) => (
              <li key={donation.id}>
                <Link to={`/donor/donation/${donation.id}`} className="block hover:bg-zinc-50 transition-colors">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{donation.food_name}</p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <StatusBadge status={donation.status} />
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between items-center">
                      <div className="sm:flex flex-col gap-1">
                        <p className="flex items-center text-xs text-zinc-600 font-medium">
                          {donation.quantity_kg} kg <span className="mx-2 text-zinc-300">•</span> {donation.food_category.replace(/_/g, ' ')}
                        </p>
                        {(donation.matched_ngo_id || donation.eta_minutes !== null) && (
                          <div className="text-xs font-mono text-zinc-500 flex items-center gap-3">
                            {donation.matched_ngo_id && <span>NGO: {donation.matched_ngo_id.split('_').pop()}</span>}
                            {donation.eta_minutes !== null && <span className="text-amber-600 font-semibold">ETA: {donation.eta_minutes}m</span>}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center text-xs text-zinc-500 sm:mt-0 font-mono">
                        <time dateTime={donation.created_at}>{format(new Date(donation.created_at), 'MMM d, yyyy HH:mm')}</time>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
