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
  AVAILABLE:       'var(--moss-light)',
  MATCHING:        'var(--amber-dim)',
  MATCHED:         'var(--amber-dim)',
  ACCEPTED:        'var(--amber-dim)',
  DRIVER_ASSIGNED: 'var(--amber-dim)',
  PICKUP_STARTED:  'var(--amber-dim)',
  PICKED_UP:       'var(--amber-dim)',
  IN_TRANSIT:      'var(--amber-dim)',
  DELIVERED:       'var(--moss-light)',
  EXPIRED:         'var(--border-hair)',
  CANCELLED:       'var(--border-hair)',
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
        <div
          className="surface"
          style={{ padding: '48px', textAlign: 'center' }}
        >
          <p style={{ color: 'var(--terracotta)', fontSize: '0.875rem', fontWeight: 500 }}>
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
      <div className="page-header">
        <div>
          <h1 className="page-title">My Donations</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <Link to="/donor/donate" className="btn-primary">
          <Plus size={14} /> New Donation
        </Link>
      </div>

      {/* ── Metric strip: no card boxes ── */}
      {!isLoading && donations.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr',
            gap: '32px',
            marginBottom: 'var(--sp-6)',
            paddingBottom: 'var(--sp-5)',
            borderBottom: '1px solid var(--border-hair)',
          }}
          className="grid-cols-2 lg:!grid-cols-[2fr_1fr_1fr_1fr]"
        >
          <MetricDisplay value={donations.length} label="Total Donations" size="lg" />
          <MetricDisplay value={active}           label="Active"          size="md" />
          <MetricDisplay value={delivered}        label="Delivered"       size="md" />
          <MetricDisplay value={`${totalKg.toFixed(0)}`} label="Kg Donated" unit="kg" size="sm" />
        </div>
      )}

      {/* Loading skeletons — content-aware shapes */}
      {isLoading && (
        <div style={{ marginBottom: 'var(--sp-6)' }}>
          {/* Metric strip skeleton */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '32px', marginBottom: 'var(--sp-6)' }}
          >
            {[72, 44, 44, 28].map((h, i) => (
              <div key={i}>
                <div className="skeleton" style={{ height: `${h}px`, width: '80px', marginBottom: '8px' }} />
                <div className="skeleton" style={{ height: '1px', width: '100%', marginBottom: '8px' }} />
                <div className="skeleton" style={{ height: '10px', width: '60px' }} />
              </div>
            ))}
          </div>
          {/* List skeletons */}
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: '64px', marginBottom: '2px' }}
            />
          ))}
        </div>
      )}

      {/* Empty state — editorial prompt, not centered generic */}
      {!isLoading && donations.length === 0 && (
        <div style={{ paddingTop: 'var(--sp-5)' }}>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              fontWeight: 300,
              color: 'var(--text-secondary)',
              marginBottom: '20px',
              letterSpacing: '-0.02em',
              fontVariationSettings: "'opsz' 24",
            }}
          >
            Your first donation starts here.
          </p>
          <p className="prose-body" style={{ marginBottom: '28px', fontSize: '0.875rem' }}>
            Log surplus food to make it visible to NGOs and drivers in your area.
            Every listing creates a traceable handoff record.
          </p>
          <Link to="/donor/donate" className="btn-primary">
            <Plus size={14} /> Create Donation
          </Link>
        </div>
      )}

      {/* Donations list — ledger style, left-border accent per status */}
      {!isLoading && donations.length > 0 && (
        <div className="surface-dense" style={{ overflow: 'hidden' }}>
          {donations.map((donation, i) => {
            const isExpiringSoon = new Date(donation.expiry_time) < new Date(Date.now() + 2 * 3600 * 1000);
            const accentColor = STATUS_ACCENT[donation.status] ?? 'var(--border-hair)';
            return (
              <Link
                key={donation.id}
                to={`/donor/donation/${donation.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px 20px',
                  borderBottom: i < donations.length - 1 ? '1px solid var(--border-hair)' : 'none',
                  textDecoration: 'none',
                  transition: 'background 0.1s',
                  borderLeft: `3px solid ${accentColor}`,
                }}
                className="group hover:bg-hover"
              >
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-3" style={{ marginBottom: '5px' }}>
                    <p
                      style={{
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {donation.food_name}
                    </p>
                    <StatusBadge status={donation.status} />
                    {isExpiringSoon && ['AVAILABLE', 'MATCHING'].includes(donation.status) && (
                      <span className="status-pill-error">
                        <span className="status-pill-dot dot-error" />
                        Expiring
                      </span>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-3"
                    style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    <span>{CATEGORY_LABELS[donation.food_category] ?? donation.food_category}</span>
                    <span style={{ color: 'var(--border-med)' }}>·</span>
                    <span>{donation.quantity_kg} kg</span>
                    <span style={{ color: 'var(--border-med)' }}>·</span>
                    <span>Expires {format(new Date(donation.expiry_time), 'MMM d, HH:mm')}</span>
                    {donation.matched_ngo_id && (
                      <>
                        <span style={{ color: 'var(--border-med)' }}>·</span>
                        <span style={{ color: 'var(--moss-light)', fontWeight: 500 }}>NGO Matched</span>
                      </>
                    )}
                    {donation.eta_minutes !== null && (
                      <>
                        <span style={{ color: 'var(--border-med)' }}>·</span>
                        <span style={{ color: 'var(--amber-dim)', fontWeight: 500 }}>ETA {donation.eta_minutes}m</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {format(new Date(donation.created_at), 'MMM d')}
                  </p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {format(new Date(donation.created_at), 'HH:mm')}
                  </p>
                </div>

                <ArrowUpRight
                  size={13}
                  style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0 }}
                  className="group-hover:opacity-100 transition-opacity"
                />
              </Link>
            );
          })}
        </div>
      )}
    </DonorLayout>
  );
}
