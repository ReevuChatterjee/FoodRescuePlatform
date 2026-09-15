import { DonationStatus } from '../../types/api';

export function StatusBadge({ status }: { status: DonationStatus }) {
  const colors: Record<DonationStatus, string> = {
    AVAILABLE: 'bg-green-100 text-green-800 border-green-200',
    MATCHING: 'bg-blue-100 text-blue-800 border-blue-200',
    MATCHED: 'bg-purple-100 text-purple-800 border-purple-200',
    ACCEPTED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    DRIVER_ASSIGNED: 'bg-teal-100 text-teal-800 border-teal-200',
    PICKUP_STARTED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    PICKED_UP: 'bg-orange-100 text-orange-800 border-orange-200',
    IN_TRANSIT: 'bg-blue-200 text-blue-900 border-blue-300',
    DELIVERED: 'bg-green-200 text-green-900 border-green-300',
    PARTIALLY_DELIVERED: 'bg-green-100 text-green-700 border-green-200',
    NO_MATCH_FOUND: 'bg-red-100 text-red-800 border-red-200',
    REJECTED: 'bg-red-200 text-red-900 border-red-300',
    EXPIRED: 'bg-gray-200 text-gray-800 border-gray-300',
    CANCELLED: 'bg-gray-300 text-gray-900 border-gray-400',
    DRIVER_ISSUE: 'bg-red-300 text-red-900 border-red-400',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
