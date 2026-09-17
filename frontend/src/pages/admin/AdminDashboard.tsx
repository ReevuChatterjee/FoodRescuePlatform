/**
 * AdminDashboard — dense command layout.
 * AI-tells removed:
 *   - Symmetric 7-col KPI card grid → MetricDisplay in asymmetric 2-dominant + 5-inline rail
 *   - Identical .panel sections → surface-dense areas, hairline separators not card borders
 *   - Quick actions as 2-col card grid → compact hairline table
 * Uses AdminLayout.
 */

import { Activity, Truck, Users, Package, CheckCircle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useAnalyticsOverview,
  useFoodMetrics,
  useLogisticsMetrics,
  useSocialMetrics,
} from '../../hooks/useAnalytics';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { MetricDisplay } from '../../components/common/MetricDisplay';

function MetricSkeleton({ size = 'lg' }: { size?: 'lg' | 'md' | 'sm' }) {
  const h = size === 'lg' ? '72px' : size === 'md' ? '44px' : '28px';
  return (
    <div>
      <div className="skeleton" style={{ height: h, width: '80px', marginBottom: '8px' }} />
      <div className="skeleton" style={{ height: '1px', width: '100%', marginBottom: '8px' }} />
      <div className="skeleton" style={{ height: '10px', width: '60px' }} />
    </div>
  );
}

export function AdminDashboard() {
  const { data: overview, isLoading: ovLoading } = useAnalyticsOverview();
  const { isLoading: foodLoading }               = useFoodMetrics();
  const { data: logistics, isLoading: logLoading } = useLogisticsMetrics();
  const { data: social, isLoading: socLoading }   = useSocialMetrics();

  const isLoading = ovLoading || foodLoading || logLoading || socLoading;

  return (
    <AdminLayout>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Network Observatory</h1>
          <p className="page-subtitle">Platform-wide metrics — auto-refreshes every 30s</p>
        </div>
        
      </div>

      {/* ── KPI Metric Rail ── */}
      {/* Asymmetric: 2 dominant (lg) + 5 smaller (sm) side by side */}
      <section style={{ marginBottom: 'var(--sp-6)' }}>
        <p className="section-label" style={{ marginBottom: '20px' }}>System Overview</p>

        {/* Two dominant metrics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '40px',
            marginBottom: '32px',
            paddingBottom: '32px',
            borderBottom: '1px solid var(--border-hair)',
          }}
        >
          {isLoading ? (
            <><MetricSkeleton size="lg" /><MetricSkeleton size="lg" /></>
          ) : (
            <>
              <MetricDisplay
                value={overview?.active_deliveries ?? 0}
                label="Active Deliveries"
                size="lg"
                accentFill={Math.min(((overview?.active_deliveries ?? 0) / Math.max(overview?.registered_drivers ?? 1, 1)) * 100, 100)}
              />
              <MetricDisplay
                value={overview?.active_donations ?? 0}
                label="Active Donations"
                size="lg"
              />
            </>
          )}
        </div>

        {/* Five secondary metrics in a horizontal rail */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '28px',
          }}
          className="grid-cols-2 sm:grid-cols-3 lg:!grid-cols-5"
        >
          {isLoading
            ? Array(5).fill(0).map((_, i) => <MetricSkeleton key={i} size="sm" />)
            : [
                { value: overview?.available_drivers  ?? 0, label: 'Avail. Drivers',  icon: <Truck size={11} /> },
                { value: overview?.registered_ngos    ?? 0, label: 'Registered NGOs', icon: <CheckCircle size={11} /> },
                { value: overview?.registered_donors  ?? 0, label: 'Donors',          icon: <Users size={11} /> },
                { value: overview?.registered_drivers ?? 0, label: 'Total Drivers',   icon: <Truck size={11} /> },
                { value: overview?.total_donations    ?? 0, label: 'Total Donations', icon: <Package size={11} /> },
              ].map((m) => (
                <MetricDisplay key={m.label} value={m.value} label={m.label} size="sm" />
              ))
          }
        </div>
      </section>

      {/* ── Logistics + Social: asymmetric 7/5 ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '7fr 5fr',
          gap: '32px',
          marginBottom: 'var(--sp-6)',
        }}
        className="grid-cols-1 lg:!grid-cols-[7fr_5fr]"
      >
        {/* Logistics */}
        <div>
          <p className="section-label" style={{ marginBottom: '20px' }}>
            <Truck size={10} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Logistics Efficiency
          </p>
          <div
            className="surface-dense"
            style={{ padding: 0, overflow: 'hidden' }}
          >
            {[
              {
                label: 'Delivery Success Rate',
                value: `${((logistics?.delivery_success_rate ?? 0) * 100).toFixed(1)}%`,
                bar: (logistics?.delivery_success_rate ?? 0) * 100,
              },
              {
                label: 'Avg Matching Time',
                value: `${logistics?.avg_matching_time_sec?.toFixed(1) ?? '—'} s`,
                bar: null,
              },
              {
                label: 'Avg Delivery Time',
                value: `${logistics?.avg_delivery_time_min?.toFixed(1) ?? '—'} min`,
                bar: null,
              },
              {
                label: 'Distance Saved',
                value: `${logistics?.route_distance_saved_km?.toFixed(1) ?? '—'} km`,
                bar: null,
              },
            ].map((m, i, arr) => (
              <div
                key={m.label}
                style={{
                  padding: '14px 20px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border-hair)' : 'none',
                }}
              >
                <div className="flex justify-between items-baseline" style={{ marginBottom: m.bar !== null ? '8px' : 0 }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{m.label}</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.125rem',
                      fontWeight: 300,
                      color: 'var(--text-primary)',
                      fontVariantNumeric: 'tabular-nums',
                      fontVariationSettings: "'opsz' 18",
                    }}
                  >
                    {isLoading ? '—' : m.value}
                  </span>
                </div>
                {m.bar !== null && (
                  <div className="capacity-bar">
                    <div className="capacity-fill" style={{ width: isLoading ? '0%' : `${Math.min(m.bar, 100)}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Social Impact */}
        <div>
          <p className="section-label" style={{ marginBottom: '20px' }}>
            <Activity size={10} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Social Impact
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {isLoading ? (
              <><MetricSkeleton size="md" /><MetricSkeleton size="md" /><MetricSkeleton size="sm" /></>
            ) : (
              <>
                <MetricDisplay value={social?.organisations_served ?? 0} label="Organisations Served" size="md" />
                <MetricDisplay value={social?.beneficiaries_reached ?? 0} label="Beneficiaries Reached" size="md" />
                <MetricDisplay
                  value={overview?.total_food_rescued_kg?.toFixed(1) ?? '0.0'}
                  label="Total Food Rescued"
                  size="sm"
                  unit="kg"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Actions — compact hairline list, not card grid ── */}
      <section>
        <p className="section-label" style={{ marginBottom: '16px' }}>Quick Actions</p>
        <div className="surface-dense" style={{ overflow: 'hidden' }}>
          {[
            {
              label: 'Review NGO Verifications',
              href: '/admin/ngos/verify',
              meta: 'Pending approvals',
              accent: 'var(--amber-dim)',
            },
            {
              label: 'Browse All NGOs',
              href: '/admin/ngos',
              meta: `${overview?.registered_ngos ?? 0} registered`,
              accent: 'var(--moss-light)',
            },
          ].map((q, i, arr) => (
            <Link
              key={q.href}
              to={q.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border-hair)' : 'none',
                textDecoration: 'none',
                transition: 'background 0.12s',
              }}
              className="hover:bg-hover"
            >
              <div className="flex items-center gap-3">
                <div style={{ width: '3px', height: '16px', background: q.accent, borderRadius: '1px', flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{q.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="section-label" style={{ color: 'var(--text-muted)' }}>{q.meta}</span>
                <ArrowUpRight size={13} style={{ color: 'var(--text-muted)' }} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </AdminLayout>
  );
}
