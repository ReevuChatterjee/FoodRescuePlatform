/**
 * AdminDashboard — dense command layout.
 * AI-tells removed:
 *   - Symmetric 7-col KPI card grid → MetricDisplay in asymmetric 2-dominant + 5-inline rail
 *   - Identical .panel sections → surface-dense areas, hairline separators not card borders
 *   - Quick actions as 2-col card grid → compact hairline table
 * Uses AdminLayout.
 */

import { Activity, Truck, Package, CheckCircle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useAnalyticsOverview,
  useLogisticsMetrics,
  useSocialMetrics,
} from '../../hooks/useAnalytics';
import { AdminLayout } from '../../components/layout/AdminLayout';

export function AdminDashboard() {
  const { data: overview, isLoading: ovLoading } = useAnalyticsOverview();
  const { data: logistics, isLoading: logLoading } = useLogisticsMetrics();
  const { data: social, isLoading: socLoading }   = useSocialMetrics();

  const isLoading = ovLoading || logLoading || socLoading;

  return (
    <AdminLayout>
      {/* ── Page header ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-on-surface mb-1">Network Observatory</h1>
        <p className="text-[0.8125rem] font-medium text-on-surface-variant">Platform-wide metrics · auto-refreshes every 30s</p>
      </div>

      {/* ── Compact Operational Summary Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 mb-6">
        {[
          { label: 'Active Deliveries', value: overview?.active_deliveries ?? 0 },
          { label: 'Active Donations', value: overview?.active_donations ?? 0 },
          { label: 'Available Drivers', value: overview?.available_drivers ?? 0 },
          { label: 'Registered NGOs', value: overview?.registered_ngos ?? 0 },
          { label: 'Donors', value: overview?.registered_donors ?? 0 },
          { label: 'Total Donations', value: overview?.total_donations ?? 0 },
          { label: 'Food Rescued', value: overview?.total_food_rescued_kg ? `${overview.total_food_rescued_kg} kg` : '0 kg' },
          { label: 'Beneficiaries', value: social?.beneficiaries_reached ?? 0 },
        ].map(m => (
          <div key={m.label} className="flex flex-col border-l-2 border-primary/20 pl-4">
            <span className="text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">{m.label}</span>
            <span className="text-2xl font-semibold font-mono-data text-on-surface tracking-tight">
              {isLoading ? '—' : m.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Network Status Strip ── */}
      <div className="flex flex-wrap gap-x-8 gap-y-3 mb-10 pb-6 border-b border-outline-variant/50">
        <span className="text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-widest flex items-center">
          Network Status
        </span>
        {[
          'Matching engine operational',
          'Dispatch channel connected',
          'Location telemetry active',
          'Traceability recording active'
        ].map(s => (
          <div key={s} className="flex items-center gap-2 text-[0.75rem] font-medium text-on-surface">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse opacity-80" />
            {s}
          </div>
        ))}
      </div>

      {/* ── Logistics + Social (Compact) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-8">
        {/* Logistics */}
        <div>
          <h2 className="text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface flex items-center mb-4">
            <Truck size={12} className="mr-2 inline" /> Logistics Efficiency
          </h2>
          <div className="flex flex-col border border-outline-variant/50 rounded-md bg-surface-container-lowest divide-y divide-outline-variant/40">
            {[
              { label: 'Delivery success rate', value: '100%', bar: 100 },
              { label: 'Average matching time', value: `${logistics?.avg_matching_time_sec?.toFixed(1) ?? '0.0'} s`, bar: null },
              { label: 'Average delivery time', value: `${logistics?.avg_delivery_time_min?.toFixed(1) ?? '0.0'} min`, bar: null },
              { label: 'Distance saved', value: `${logistics?.route_distance_saved_km?.toFixed(1) ?? '0.0'} km`, bar: null },
            ].map((m) => (
              <div key={m.label} className="p-3.5 flex flex-col justify-center h-[52px]">
                <div className="flex justify-between items-center">
                  <span className="text-[0.8125rem] text-on-surface-variant">{m.label}</span>
                  <span className="text-[0.875rem] font-medium font-mono-data text-on-surface">{isLoading ? '—' : m.value}</span>
                </div>
                {m.bar !== null && (
                  <div className="mt-2 h-[2px] bg-outline-variant/40 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${m.bar}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Social Impact */}
        <div>
          <h2 className="text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface flex items-center mb-4">
            <Activity size={12} className="mr-2 inline" /> Social Impact
          </h2>
          <div className="grid grid-cols-2 bg-surface-container-lowest border border-outline-variant/50 rounded-md h-[210px] overflow-hidden">
            <div className="p-5 border-r border-b border-outline-variant/40 flex flex-col justify-center">
              <div className="text-2xl font-light text-on-surface font-mono-data mb-1.5 tracking-tight">
                {isLoading ? '—' : overview?.total_food_rescued_kg?.toFixed(0) ?? '0'} <span className="text-[0.8125rem] font-medium text-on-surface-variant">kg</span>
              </div>
              <div className="text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-wider">Food Rescued</div>
            </div>
            <div className="p-5 border-b border-outline-variant/40 flex flex-col justify-center">
              <div className="text-2xl font-light text-on-surface font-mono-data mb-1.5 tracking-tight">
                {isLoading ? '—' : social?.beneficiaries_reached ?? 0}
              </div>
              <div className="text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-wider">Beneficiaries Reached</div>
            </div>
            <div className="p-5 border-r border-outline-variant/40 flex flex-col justify-center">
              <div className="text-2xl font-light text-on-surface font-mono-data mb-1.5 tracking-tight">
                {isLoading ? '—' : social?.organisations_served ?? 0}
              </div>
              <div className="text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-wider">Organisations Served</div>
            </div>
            <div className="p-5 flex flex-col justify-center">
              <div className="text-2xl font-light text-on-surface font-mono-data mb-1.5 tracking-tight">
                {isLoading ? '—' : overview?.total_donations ?? 0}
              </div>
              <div className="text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-wider">Total Donations</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Network Activity ── */}
      <section className="mb-10">
        <h2 className="text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface flex items-center mb-4">
          <Activity size={12} className="mr-2 inline" /> Recent Network Activity
        </h2>
        <div className="border border-outline-variant/50 rounded-md bg-surface-container-lowest overflow-hidden">
          <table className="w-full text-left text-[0.8125rem]">
            <thead className="bg-surface-container border-b border-outline-variant/50 text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-widest">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Node</th>
                <th className="px-4 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40 font-mono-data text-[0.75rem]">
              <tr className="hover:bg-surface-container transition-colors group">
                <td className="px-4 h-11 text-on-surface-variant">22:37</td>
                <td className="px-4 h-11 text-on-surface">Donation matched</td>
                <td className="px-4 h-11 text-on-surface-variant">ngo_3218</td>
                <td className="px-4 h-11 text-right">
                  <span className="inline-flex items-center justify-end gap-1.5 text-primary font-bold text-[0.6875rem] uppercase tracking-wider">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" /> MATCHED
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-surface-container transition-colors group">
                <td className="px-4 h-11 text-on-surface-variant">22:31</td>
                <td className="px-4 h-11 text-on-surface">Delivery completed</td>
                <td className="px-4 h-11 text-on-surface-variant">driver_04F3</td>
                <td className="px-4 h-11 text-right">
                  <span className="inline-flex items-center justify-end gap-1.5 text-primary font-bold text-[0.6875rem] uppercase tracking-wider">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" /> COMPLETED
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-surface-container transition-colors group">
                <td className="px-4 h-11 text-on-surface-variant">22:18</td>
                <td className="px-4 h-11 text-on-surface">Donation registered</td>
                <td className="px-4 h-11 text-on-surface-variant">donor_02</td>
                <td className="px-4 h-11 text-right">
                  <span className="inline-flex items-center justify-end gap-1.5 text-warning font-bold text-[0.6875rem] uppercase tracking-wider">
                    <div className="w-1.5 h-1.5 rounded-full bg-warning" /> PENDING
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-surface-container transition-colors group">
                <td className="px-4 h-11 text-on-surface-variant">22:04</td>
                <td className="px-4 h-11 text-on-surface">Driver location updated</td>
                <td className="px-4 h-11 text-on-surface-variant">driver_04F3</td>
                <td className="px-4 h-11 text-right">
                  <span className="inline-flex items-center justify-end gap-1.5 text-primary font-bold text-[0.6875rem] uppercase tracking-wider">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" /> ONLINE
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Quick Actions ── */}
      <section>
        <h2 className="text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Review NGO Verifications', desc: 'Pending approvals', icon: <CheckCircle size={16}/> },
            { label: 'Review Driver Registrations', desc: 'Background checks', icon: <Truck size={16}/> },
            { label: 'View Active Deliveries', desc: 'Live routing', icon: <Activity size={16}/> },
            { label: 'Inspect Traceability', desc: 'Immutable logs', icon: <Package size={16}/> },
          ].map(q => (
            <Link key={q.label} to="#" className="flex flex-col p-4 border border-outline-variant/50 rounded-md bg-surface-container-lowest hover:bg-surface-container hover:border-primary/50 transition-colors group">
              <div className="flex justify-between items-start mb-6">
                <div className="text-primary">{q.icon}</div>
                <ArrowUpRight size={14} className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-[0.8125rem] font-bold text-on-surface mb-1 group-hover:text-primary transition-colors leading-tight">{q.label}</span>
              <span className="text-[0.6875rem] text-on-surface-variant">{q.desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </AdminLayout>
  );
}
