import { DonationStatus } from '../../types/api';

export function StatusBadge({ status }: { status: DonationStatus }) {
  const colors: Record<DonationStatus, string> = {
    AVAILABLE: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    MATCHING: 'bg-blue-50 text-blue-700 border-blue-200',
    MATCHED: 'bg-blue-100 text-blue-800 border-blue-200',
    ACCEPTED: 'bg-blue-100 text-blue-800 border-blue-200',
    DRIVER_ASSIGNED: 'bg-blue-100 text-blue-800 border-blue-200',
    PICKUP_STARTED: 'bg-amber-100 text-amber-800 border-amber-200',
    PICKED_UP: 'bg-amber-100 text-amber-800 border-amber-200',
    IN_TRANSIT: 'bg-amber-100 text-amber-800 border-amber-200',
    DELIVERED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    PARTIALLY_DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    NO_MATCH_FOUND: 'bg-red-50 text-red-700 border-red-200',
    REJECTED: 'bg-red-50 text-red-700 border-red-200',
    EXPIRED: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    CANCELLED: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    DRIVER_ISSUE: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-mono font-medium tracking-tight border ${colors[status] || 'bg-zinc-100 text-zinc-700 border-zinc-200'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
