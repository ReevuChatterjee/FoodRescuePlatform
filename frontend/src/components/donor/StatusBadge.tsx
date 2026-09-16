/**
 * Enhanced StatusBadge — maps donation/delivery status to premium colored badges.
 */

import type { DonationStatus, DeliveryStatus } from '../../types/api';

const STATUS_CONFIG: Record<string, { cls: string; dotClass: string; label: string }> = {
  AVAILABLE:         { cls: 'badge-green',  dotClass: 'bg-emerald-500', label: 'Available' },
  MATCHING:          { cls: 'badge-blue',   dotClass: 'bg-blue-500',    label: 'Matching…' },
  MATCHED:           { cls: 'badge-blue',   dotClass: 'bg-blue-400',    label: 'Matched' },
  ACCEPTED:          { cls: 'badge-blue',   dotClass: 'bg-blue-400',    label: 'Accepted' },
  DRIVER_ASSIGNED:   { cls: 'badge-orange', dotClass: 'bg-amber-500',   label: 'Driver Assigned' },
  PICKUP_STARTED:    { cls: 'badge-orange', dotClass: 'bg-amber-500',   label: 'Pickup Started' },
  PICKED_UP:         { cls: 'badge-orange', dotClass: 'bg-orange-500',  label: 'Picked Up' },
  IN_TRANSIT:        { cls: 'badge-orange', dotClass: 'bg-amber-500',   label: 'In Transit' },
  DELIVERED:         { cls: 'badge-green',  dotClass: 'bg-emerald-500', label: 'Delivered' },
  PARTIALLY_DELIVERED:{ cls: 'badge-yellow', dotClass: 'bg-amber-400',  label: 'Partial Delivery' },
  NO_MATCH_FOUND:    { cls: 'badge-red',    dotClass: 'bg-red-500',     label: 'No Match Found' },
  REJECTED:          { cls: 'badge-red',    dotClass: 'bg-red-400',     label: 'Rejected' },
  EXPIRED:           { cls: 'badge-gray',   dotClass: 'bg-zinc-500',    label: 'Expired' },
  CANCELLED:         { cls: 'badge-gray',   dotClass: 'bg-zinc-500',    label: 'Cancelled' },
  DRIVER_ISSUE:      { cls: 'badge-red',    dotClass: 'bg-red-500',     label: 'Driver Issue' },
};

interface Props {
  status: DonationStatus | DeliveryStatus | string;
}

export function StatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status] ?? { cls: 'badge-gray', dotClass: 'bg-zinc-500', label: status };
  return (
    <span className={cfg.cls}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}
