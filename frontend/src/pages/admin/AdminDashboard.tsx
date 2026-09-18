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
      <div className="bg-surface-container-high rounded animate-pulse" style={{ height: h, width: '80px', marginBottom: '8px' }} />
      <div className="bg-surface-container rounded animate-pulse w-full h-px mb-2" />
      <div className="bg-surface-container-highest rounded animate-pulse h-3 w-16" />
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 pb-6 border-b border-outline-variant">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-on-surface mb-2">Network Observatory</h1>
          <p className="text-sm font-medium text-on-surface-variant tracking-normal">Platform-wide metrics — auto-refreshes every 30s</p>
        </div>
      </div>

      {/* ── KPI Metric Rail ── */}
      {/* Asymmetric: 2 dominant (lg) + 5 smaller (sm) side by side */}
      <section className="mb-12">
        <p className="font-ui text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface mb-6">System Overview</p>

        {/* Two dominant metrics */}
        <div className="grid grid-cols-2 gap-10 mb-8 pb-8 border-b border-outline-variant">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-7">
          {isLoading
            ? Array(5).fill(0).map((_, i) => <MetricSkeleton key={i} size="sm" />)
            : [
                { value: overview?.available_drivers  ?? 0, label: 'Avail. Drivers',  icon: <Truck size={12} /> },
                { value: overview?.registered_ngos    ?? 0, label: 'Registered NGOs', icon: <CheckCircle size={12} /> },
                { value: overview?.registered_donors  ?? 0, label: 'Donors',          icon: <Users size={12} /> },
                { value: overview?.registered_drivers ?? 0, label: 'Total Drivers',   icon: <Truck size={12} /> },
                { value: overview?.total_donations    ?? 0, label: 'Total Donations', icon: <Package size={12} /> },
              ].map((m) => (
                <MetricDisplay key={m.label} value={m.value} label={m.label} size="sm" />
              ))
          }
        </div>
      </section>

      {/* ── Logistics + Social: asymmetric 7/5 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-10 mb-12">
        {/* Logistics */}
        <div>
          <p className="font-ui text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface flex items-center mb-6">
            <Truck size={12} className="mr-2 inline" />
            Logistics Efficiency
          </p>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-md overflow-hidden shadow-sm">
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
                className={`p-4 ${i < arr.length - 1 ? 'border-b border-b-outline-variant' : ''}`}
              >
                <div className={`flex justify-between items-baseline ${m.bar !== null ? 'mb-2' : ''}`}>
                  <span className="text-[0.8125rem] text-on-surface-variant font-medium">{m.label}</span>
                  <span className="font-display text-lg font-light text-on-surface tracking-tight font-mono-data">
                    {isLoading ? '—' : m.value}
                  </span>
                </div>
                {m.bar !== null && (
                  <div className="h-1 bg-outline-variant rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-[width] duration-500 ease-out" style={{ width: isLoading ? '0%' : `${Math.min(m.bar, 100)}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Social Impact */}
        <div>
          <p className="font-ui text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface flex items-center mb-6">
            <Activity size={12} className="mr-2 inline" />
            Social Impact
          </p>
          <div className="flex flex-col gap-8">
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
        <p className="font-ui text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface mb-5">Quick Actions</p>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-md overflow-hidden shadow-sm">
          {[
            {
              label: 'Review NGO Verifications',
              href: '/admin/ngos/verify',
              meta: 'Pending approvals',
              accent: 'bg-warning',
            },
            {
              label: 'Browse All NGOs',
              href: '/admin/ngos',
              meta: `${overview?.registered_ngos ?? 0} registered`,
              accent: 'bg-primary',
            },
          ].map((q, i, arr) => (
            <Link
              key={q.href}
              to={q.href}
              className={`flex items-center justify-between p-4 hover:bg-surface-container transition-colors group ${
                i < arr.length - 1 ? 'border-b border-b-outline-variant' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-[3px] h-4 rounded-[1px] flex-shrink-0 ${q.accent}`} />
                <span className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">{q.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-ui text-[0.625rem] font-bold tracking-wider uppercase text-on-surface-variant">{q.meta}</span>
                <ArrowUpRight size={16} className="text-on-surface-variant flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </AdminLayout>
  );
}
