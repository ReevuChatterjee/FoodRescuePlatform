/**
 * Admin Dashboard — real-time analytics with charts.
 * Consumes Person 6's analytics endpoints via TanStack Query.
 * Auto-refreshes every 30s.
 */

import { Activity, Truck, Users, Package, CheckCircle, Clock, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  useAnalyticsOverview,
  useFoodMetrics,
  useLogisticsMetrics,
  useSocialMetrics,
} from '../../hooks/useAnalytics';
import { AppLayout } from '../../components/layout/AppLayout';

function SkeletonCard() {
  return (
    <div className="panel">
      <div className="skeleton h-4 w-24 mb-4" />
      <div className="skeleton h-8 w-16" />
    </div>
  );
}

export function AdminDashboard() {
  const { data: overview, isLoading: ovLoading } = useAnalyticsOverview();
  const { isLoading: foodLoading } = useFoodMetrics();
  const { data: logistics, isLoading: logLoading } = useLogisticsMetrics();
  const { data: social, isLoading: socLoading } = useSocialMetrics();

  const isLoading = ovLoading || foodLoading || logLoading || socLoading;

  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Platform overview — auto-refreshes every 30s</p>
        </div>
        <div>
          <span className="badge-green text-[10px] uppercase tracking-wider">Live Connection</span>
        </div>
      </div>

      {/* ── System Overview KPIs ── */}
      <section className="mb-8">
        <h2 className="section-title"><Activity size={16} className="text-zinc-400" /> System Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {isLoading ? Array(7).fill(0).map((_, i) => <SkeletonCard key={i} />) : [
            { label: 'Total Donations', value: overview?.total_donations ?? 0, icon: <Package size={14} />, color: 'text-zinc-100' },
            { label: 'Active Donations', value: overview?.active_donations ?? 0, icon: <Clock size={14} />, color: 'text-blue-400' },
            { label: 'Active Deliveries', value: overview?.active_deliveries ?? 0, icon: <Truck size={14} />, color: 'text-amber-400' },
            { label: 'Available Drivers', value: overview?.available_drivers ?? 0, icon: <Truck size={14} />, color: 'text-emerald-400' },
            { label: 'Registered NGOs', value: overview?.registered_ngos ?? 0, icon: <CheckCircle size={14} />, color: 'text-zinc-100' },
            { label: 'Registered Donors', value: overview?.registered_donors ?? 0, icon: <Users size={14} />, color: 'text-zinc-100' },
            { label: 'Registered Drivers', value: overview?.registered_drivers ?? 0, icon: <Users size={14} />, color: 'text-zinc-100' },
          ].map((kpi) => (
            <div key={kpi.label} className="panel flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-zinc-500 mb-3">
                {kpi.icon}
                <span className="text-xs font-medium uppercase tracking-wide">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-semibold tabular-nums ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Logistics & Social ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logistics */}
        <div className="panel">
          <h2 className="section-title"><Truck size={16} className="text-zinc-400" /> Logistics Efficiency</h2>
          <div className="space-y-5">
            {[
              { label: 'Delivery Success Rate', value: `${((logistics?.delivery_success_rate ?? 0) * 100).toFixed(0)}%`, bar: (logistics?.delivery_success_rate ?? 0) * 100, fillClass: 'bg-emerald-500' },
              { label: 'Avg Matching Time', value: `${logistics?.avg_matching_time_sec?.toFixed(1) ?? '0.0'} sec`, bar: null, fillClass: '' },
              { label: 'Avg Delivery Time', value: `${logistics?.avg_delivery_time_min?.toFixed(1) ?? '0.0'} min`, bar: null, fillClass: '' },
              { label: 'Route Distance Saved', value: `${logistics?.route_distance_saved_km?.toFixed(1) ?? '0.0'} km`, bar: null, fillClass: '' },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-zinc-400">{m.label}</span>
                  <span className="font-semibold text-zinc-100 tabular-nums">{m.value}</span>
                </div>
                {m.bar !== null && (
                  <div className="capacity-bar">
                    <div className={`capacity-fill ${m.fillClass}`} style={{ width: `${Math.min(m.bar, 100)}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Social Impact */}
        <div className="panel">
          <h2 className="section-title"><Users size={16} className="text-zinc-400" /> Social Impact</h2>
          <div className="space-y-6">
            <div className="border-b border-zinc-800 pb-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1">Organisations Served</p>
              <p className="text-4xl font-semibold tabular-nums text-zinc-100">{social?.organisations_served ?? 0}</p>
            </div>
            <div className="border-b border-zinc-800 pb-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1">Beneficiaries Reached</p>
              <p className="text-4xl font-semibold tabular-nums text-zinc-100">{social?.beneficiaries_reached ?? 0}</p>
              <p className="text-xs mt-1 text-zinc-500">Estimate — real tracking pending full delivery data</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1">Total Food Rescued</p>
              <p className="text-3xl font-semibold tabular-nums text-zinc-100">
                {overview?.total_food_rescued_kg?.toFixed(1) ?? '0.0'} <span className="text-sm font-normal text-zinc-500">kg</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Links ── */}
      <div className="mt-6 panel">
        <h2 className="section-title"><BarChart2 size={16} className="text-zinc-400" /> Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Review NGO Verifications', href: '/admin/ngos/verify', badge: 'Pending' },
            { label: 'Browse All NGOs', href: '/admin/ngos', badge: `${overview?.registered_ngos ?? 0} total` },
          ].map((q) => (
            <Link key={q.label} to={q.href}
              className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-sm hover:bg-zinc-800 transition-colors">
              <span className="text-sm font-medium text-zinc-100">{q.label}</span>
              <span className="badge-gray">{q.badge}</span>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
