/**
 * StatusBadge — replaces filled colored badges with StatusPill.
 * 5px colored dot + small-caps label + 1px hairline outline.
 * Dot and border colors are muted — not traffic-light bright.
 */

import type { DonationStatus, DeliveryStatus } from '../../types/api';

interface StatusConfig {
  pillClass: string;
  dotClass: string;
  label: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  AVAILABLE:            { pillClass: 'border-success/30 bg-success/5 text-success', dotClass: 'bg-success',    label: 'Available' },
  MATCHING:             { pillClass: 'border-warning/30 bg-warning/5 text-warning',   dotClass: 'bg-warning',   label: 'Matching' },
  MATCHED:              { pillClass: 'border-warning/30 bg-warning/5 text-warning',   dotClass: 'bg-warning',   label: 'Matched' },
  ACCEPTED:             { pillClass: 'border-warning/30 bg-warning/5 text-warning',   dotClass: 'bg-warning',   label: 'Accepted' },
  DRIVER_ASSIGNED:      { pillClass: 'border-secondary/30 bg-secondary/5 text-secondary', dotClass: 'bg-secondary', label: 'Driver Assigned' },
  PICKUP_STARTED:       { pillClass: 'border-secondary/30 bg-secondary/5 text-secondary', dotClass: 'bg-secondary', label: 'Pickup Started' },
  PICKED_UP:            { pillClass: 'border-secondary/30 bg-secondary/5 text-secondary', dotClass: 'bg-secondary', label: 'Picked Up' },
  IN_TRANSIT:           { pillClass: 'border-secondary/30 bg-secondary/5 text-secondary', dotClass: 'bg-secondary', label: 'In Transit' },
  DELIVERED:            { pillClass: 'border-success/30 bg-success/5 text-success', dotClass: 'bg-success', label: 'Delivered' },
  PARTIALLY_DELIVERED:  { pillClass: 'border-warning/30 bg-warning/5 text-warning', dotClass: 'bg-warning',   label: 'Partial' },
  NO_MATCH_FOUND:       { pillClass: 'border-error/30 bg-error/5 text-error',   dotClass: 'bg-error',   label: 'No Match' },
  REJECTED:             { pillClass: 'border-error/30 bg-error/5 text-error',   dotClass: 'bg-error',   label: 'Rejected' },
  EXPIRED:              { pillClass: 'border-outline-variant/50 bg-surface-container-high text-on-surface-variant',   dotClass: 'bg-outline',   label: 'Expired' },
  CANCELLED:            { pillClass: 'border-outline-variant/50 bg-surface-container-high text-on-surface-variant',   dotClass: 'bg-outline',   label: 'Cancelled' },
  DRIVER_ISSUE:         { pillClass: 'border-error/30 bg-error/5 text-error',   dotClass: 'bg-error',   label: 'Driver Issue' },
};

interface Props {
  status: DonationStatus | DeliveryStatus | string;
}

export function StatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status] ?? {
    pillClass: 'border-outline-variant/50 bg-surface-container-high text-on-surface-variant',
    dotClass: 'bg-outline',
    label: status,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-sm font-ui text-[0.625rem] font-bold tracking-wider uppercase ${cfg.pillClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}
