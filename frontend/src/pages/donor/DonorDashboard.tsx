import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Donation, SuccessEnvelope } from '../../types/api';
import { StatusBadge } from '../../components/donor/StatusBadge';
import { useDonationWebSocket } from '../../hooks/useDonationWebSocket';
import { format } from 'date-fns';

export function DonorDashboard() {
  useDonationWebSocket();

  const { data, isLoading, error } = useQuery({
    queryKey: ['donations'],
    queryFn: async () => {
      const response = await apiClient.get<SuccessEnvelope<Donation[]>>('/api/v1/donations');
      return response.data.data;
    },
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading donations...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Failed to load donations.</div>;

  const donations = data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Your Donations</h2>
        <Link
          to="/donor/donate"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-medium"
        >
          + New Donation
        </Link>
      </div>

      {donations.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500 border border-gray-200">
          No donations found. Start by creating a new donation.
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
          <ul className="divide-y divide-gray-200">
            {donations.map((donation) => (
              <li key={donation.id}>
                <Link to={`/donor/donation/${donation.id}`} className="block hover:bg-gray-50 transition">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-blue-600 truncate">{donation.food_name}</p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <StatusBadge status={donation.status} />
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          {donation.quantity_kg} kg • {donation.food_category.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        <p>
                          Created on <time dateTime={donation.created_at}>{format(new Date(donation.created_at), 'MMM d, yyyy HH:mm')}</time>
                        </p>
                      </div>
                    </div>
                    {(donation.matched_ngo_id || donation.eta_minutes !== null) && (
                      <div className="mt-2 text-sm text-gray-500 flex space-x-4">
                        {donation.matched_ngo_id && <span>Matched NGO: {donation.matched_ngo_id}</span>}
                        {donation.eta_minutes !== null && <span>ETA: {donation.eta_minutes} mins</span>}
                      </div>
                    )}
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
