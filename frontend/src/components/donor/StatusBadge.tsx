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
  AVAILABLE:            { pillClass: 'status-pill-success', dotClass: 'dot-moss',    label: 'Available' },
  MATCHING:             { pillClass: 'status-pill-amber',   dotClass: 'dot-amber',   label: 'Matching' },
  MATCHED:              { pillClass: 'status-pill-amber',   dotClass: 'dot-amber',   label: 'Matched' },
  ACCEPTED:             { pillClass: 'status-pill-amber',   dotClass: 'dot-amber',   label: 'Accepted' },
  DRIVER_ASSIGNED:      { pillClass: 'status-pill-warning', dotClass: 'dot-warning', label: 'Driver Assigned' },
  PICKUP_STARTED:       { pillClass: 'status-pill-warning', dotClass: 'dot-warning', label: 'Pickup Started' },
  PICKED_UP:            { pillClass: 'status-pill-warning', dotClass: 'dot-warning', label: 'Picked Up' },
  IN_TRANSIT:           { pillClass: 'status-pill-warning', dotClass: 'dot-warning', label: 'In Transit' },
  DELIVERED:            { pillClass: 'status-pill-success', dotClass: 'dot-success', label: 'Delivered' },
  PARTIALLY_DELIVERED:  { pillClass: 'status-pill-warning', dotClass: 'dot-amber',   label: 'Partial' },
  NO_MATCH_FOUND:       { pillClass: 'status-pill-error',   dotClass: 'dot-error',   label: 'No Match' },
  REJECTED:             { pillClass: 'status-pill-error',   dotClass: 'dot-error',   label: 'Rejected' },
  EXPIRED:              { pillClass: 'status-pill-muted',   dotClass: 'dot-muted',   label: 'Expired' },
  CANCELLED:            { pillClass: 'status-pill-muted',   dotClass: 'dot-muted',   label: 'Cancelled' },
  DRIVER_ISSUE:         { pillClass: 'status-pill-error',   dotClass: 'dot-error',   label: 'Driver Issue' },
};

interface Props {
  status: DonationStatus | DeliveryStatus | string;
}

export function StatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status] ?? {
    pillClass: 'status-pill-muted',
    dotClass: 'dot-muted',
    label: status,
  };
  return (
    <span className={cfg.pillClass}>
      <span className={`status-pill-dot ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}
