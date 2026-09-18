/**
 * DonorDashboard — personal ledger of donations.
 * AI-tells removed:
 *   - 4-col stat card grid → MetricDisplay horizontal strip (no card boxes)
 *   - Generic subtitle → context-aware count
 *   - Package icon-in-box decoration on each row → left-border color accent
 *   - Uniform panel sections → editorial single-column with airy spacing
 * Uses DonorLayout.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, ArrowUpRight } from 'lucide-react';
import { apiClient } from '../../api/client';
import type { Donation, SuccessEnvelope } from '../../types/api';
import { StatusBadge } from '../../components/donor/StatusBadge';
import { useDonationWebSocket } from '../../hooks/useDonationWebSocket';
import { DonorLayout } from '../../components/layout/DonorLayout';
import { MetricDisplay } from '../../components/common/MetricDisplay';
import { format } from 'date-fns';

const CATEGORY_LABELS: Record<string, string> = {
  RAW_PRODUCE: 'Raw Produce',
  COOKED:      'Cooked',
  PACKAGED:    'Packaged',
  BAKED_GOODS: 'Baked Goods',
  DAIRY:       'Dairy',
  MIXED:       'Mixed',
};

// Status → left-border accent color
const STATUS_ACCENT: Record<string, string> = {
  AVAILABLE:       'border-success',
  MATCHING:        'border-warning',
  MATCHED:         'border-warning',
  ACCEPTED:        'border-warning',
  DRIVER_ASSIGNED: 'border-secondary',
  PICKUP_STARTED:  'border-secondary',
  PICKED_UP:       'border-secondary',
  IN_TRANSIT:      'border-secondary',
  DELIVERED:       'border-success',
  EXPIRED:         'border-outline-variant',
  CANCELLED:       'border-outline-variant',
};

export function DonorDashboard() {
  useDonationWebSocket();

  const { data, isLoading, error } = useQuery({
    queryKey: ['donations'],
    queryFn: async () => {
      const response = await apiClient.get<SuccessEnvelope<Donation[]>>('/api/v1/donations');
      return response.data.data;
    },
  });

  const donations = data || [];
  const totalKg   = donations.reduce((s, d) => s + d.quantity_kg, 0);
  const active    = donations.filter((d) =>
    ['AVAILABLE','MATCHING','MATCHED','ACCEPTED','DRIVER_ASSIGNED','PICKUP_STARTED','IN_TRANSIT'].includes(d.status)
  ).length;
  const delivered = donations.filter((d) => d.status === 'DELIVERED').length;

  if (error) {
    return (
      <DonorLayout>
        <div className="bg-surface-container rounded-lg p-12 text-center border border-outline-variant">
          <p className="text-sm font-semibold text-error">
            Failed to load donations. Please try refreshing.
          </p>
        </div>
      </DonorLayout>
    );
  }

  // Context-aware subtitle
  const subtitle = isLoading
    ? 'Loading…'
    : donations.length === 0
    ? 'No donations yet — start below.'
    : `${active} active · ${delivered} delivered`;

  return (
    <DonorLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 pb-6 border-b border-outline-variant">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-on-surface mb-2">My Donations</h1>
          <p className="text-sm font-medium text-on-surface-variant tracking-normal">{subtitle}</p>
        </div>
        <Link to="/donor/donate" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-md font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm">
          <Plus size={16} /> New Donation
        </Link>
      </div>

      {/* ── Metric strip: no card boxes ── */}
      {!isLoading && donations.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-8 mb-12 pb-8 border-b border-outline-variant">
          <MetricDisplay value={donations.length} label="Total Donations" size="lg" />
          <MetricDisplay value={active}           label="Active"          size="md" />
          <MetricDisplay value={delivered}        label="Delivered"       size="md" />
          <MetricDisplay value={`${totalKg.toFixed(0)}`} label="Kg Donated" unit="kg" size="sm" />
        </div>
      )}

      {/* Loading skeletons — content-aware shapes */}
      {isLoading && (
        <div className="mb-12">
          {/* Metric strip skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-8 mb-12">
            {[72, 44, 44, 28].map((h, i) => (
              <div key={i}>
                <div className="bg-surface-container-high rounded animate-pulse" style={{ height: `${h}px`, width: '80px', marginBottom: '8px' }} />
                <div className="bg-surface-container rounded animate-pulse w-full h-px mb-2" />
                <div className="bg-surface-container-highest rounded animate-pulse h-3 w-16" />
              </div>
            ))}
          </div>
          {/* List skeletons */}
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-surface-container-lowest border border-outline-variant/50 rounded-sm mb-1 animate-pulse h-16"
            />
          ))}
        </div>
      )}

      {/* Empty state — editorial prompt, not centered generic */}
      {!isLoading && donations.length === 0 && (
        <div className="pt-8">
          <p className="font-display text-2xl font-light text-on-surface-variant mb-5 tracking-tight">
            Your first donation starts here.
          </p>
          <p className="text-sm text-on-surface-variant max-w-xl mb-8 leading-relaxed">
            Log surplus food to make it visible to NGOs and drivers in your area.
            Every listing creates a traceable handoff record.
          </p>
          <Link to="/donor/donate" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-md font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm">
            <Plus size={16} /> Create Donation
          </Link>
        </div>
      )}

      {/* Donations list — ledger style, left-border accent per status */}
      {!isLoading && donations.length > 0 && (
        <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-[0_2px_4px_rgba(24,29,26,0.04)]">
          {donations.map((donation, i) => {
            const isExpiringSoon = new Date(donation.expiry_time) < new Date(Date.now() + 2 * 3600 * 1000);
            const accentClass = STATUS_ACCENT[donation.status] ?? 'border-outline-variant';
            return (
              <Link
                key={donation.id}
                to={`/donor/donation/${donation.id}`}
                className={`flex items-center gap-4 px-5 py-3.5 border-l-4 ${accentClass} hover:bg-surface-container transition-colors group ${
                  i < donations.length - 1 ? 'border-b border-b-outline-variant' : ''
                }`}
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <p className="font-semibold text-sm text-on-surface truncate">
                      {donation.food_name}
                    </p>
                    <StatusBadge status={donation.status} />
                    {isExpiringSoon && ['AVAILABLE', 'MATCHING'].includes(donation.status) && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-error/30 bg-error/5 text-error rounded-sm font-ui text-[0.625rem] font-bold tracking-wider uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-error" />
                        Expiring
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-on-surface-variant font-mono-data">
                    <span>{CATEGORY_LABELS[donation.food_category] ?? donation.food_category}</span>
                    <span className="text-outline-variant">·</span>
                    <span>{donation.quantity_kg} kg</span>
                    <span className="text-outline-variant">·</span>
                    <span>Expires {format(new Date(donation.expiry_time), 'MMM d, HH:mm')}</span>
                    {donation.matched_ngo_id && (
                      <>
                        <span className="text-outline-variant">·</span>
                        <span className="text-primary font-bold tracking-tight">NGO Matched</span>
                      </>
                    )}
                    {donation.eta_minutes !== null && (
                      <>
                        <span className="text-outline-variant">·</span>
                        <span className="text-warning font-bold tracking-tight">ETA {donation.eta_minutes}m</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-on-surface-variant font-mono-data font-medium">
                    {format(new Date(donation.created_at), 'MMM d')}
                  </p>
                  <p className="text-[0.6875rem] text-on-surface-variant font-mono-data">
                    {format(new Date(donation.created_at), 'HH:mm')}
                  </p>
                </div>

                <ArrowUpRight
                  size={16}
                  className="text-on-surface-variant flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                />
              </Link>
            );
          })}
        </div>
      )}
    </DonorLayout>
  );
}
