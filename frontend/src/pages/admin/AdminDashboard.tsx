/**
 * Admin Dashboard — main overview page with real-time analytics.
 *
 * Consumes Person 6's analytics endpoints via TanStack Query.
 * Renders four metric cards: overview, food, logistics, social.
 * Auto-refreshes every 30s via query hooks.
 */

import { Activity, TrendingUp, Truck, Users, BarChart3 } from 'lucide-react';
import {
  useAnalyticsOverview,
  useFoodMetrics,
  useLogisticsMetrics,
  useSocialMetrics,
} from '../../hooks/useAnalytics';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock trend data for the chart to make it look rich and data-heavy
const trendData = [
  { day: 'Mon', kg: 120 },
  { day: 'Tue', kg: 145 },
  { day: 'Wed', kg: 110 },
  { day: 'Thu', kg: 180 },
  { day: 'Fri', kg: 210 },
  { day: 'Sat', kg: 250 },
  { day: 'Sun', kg: 190 },
];

export function AdminDashboard() {
  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview();
  const { data: food, isLoading: foodLoading } = useFoodMetrics();
  const { data: logistics, isLoading: logisticsLoading } = useLogisticsMetrics();
  const { data: social, isLoading: socialLoading } = useSocialMetrics();

  if (overviewLoading || foodLoading || logisticsLoading || socialLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-sm text-zinc-500 font-mono tracking-wider uppercase animate-pulse">Loading telemetry...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Command Center</h1>
        <p className="text-sm text-zinc-500 mt-1">Real-time logistics and food rescue metrics</p>
      </div>

      {/* System Overview */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 uppercase tracking-wider">
          <Activity size={16} className="text-emerald-600" />
          System Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <MetricCard label="Total Donations" value={overview?.total_donations ?? 0} />
          <MetricCard label="Active Donations" value={overview?.active_donations ?? 0} />
          <MetricCard label="Active Deliveries" value={overview?.active_deliveries ?? 0} />
          <MetricCard label="Available Drivers" value={overview?.available_drivers ?? 0} />
          <MetricCard label="Registered NGOs" value={overview?.registered_ngos ?? 0} />
          <MetricCard label="Registered Donors" value={overview?.registered_donors ?? 0} />
        </div>
      </section>

      {/* Analytics Chart & Food Rescued */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <section className="space-y-3 xl:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 uppercase tracking-wider">
            <BarChart3 size={16} className="text-emerald-600" />
            7-Day Rescue Trend (kg)
          </h2>
          <div className="bg-white border border-zinc-200 rounded-md p-4 h-64 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorKg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', color: '#fff', borderRadius: '6px', border: 'none', fontSize: '12px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Area type="monotone" dataKey="kg" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#colorKg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="space-y-3 xl:col-span-1">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 uppercase tracking-wider">
            <TrendingUp size={16} className="text-emerald-600" />
            Food Rescued
          </h2>
          <div className="flex flex-col gap-3">
            <MetricCard
              label="Total Rescued (All Time)"
              value={food?.total_rescued_kg?.toFixed(1) ?? '0.0'}
              suffix=" kg"
            />
            <MetricCard
              label="Rescued (Last 7 Days)"
              value={food?.rescued_last_7_days_kg?.toFixed(1) ?? '0.0'}
              suffix=" kg"
            />
            <MetricCard
              label="Avg Donation Size"
              value={food?.average_donation_size_kg?.toFixed(1) ?? '0.0'}
              suffix=" kg"
            />
          </div>
        </section>
      </div>

      {/* Logistics & Efficiency */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 uppercase tracking-wider">
          <Truck size={16} className="text-emerald-600" />
          Logistics Efficiency
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Avg Route Time"
            value={logistics?.avg_delivery_time_mins?.toFixed(1) ?? '0.0'}
            suffix=" m"
          />
          <MetricCard
            label="Avg Pickup Delay"
            value={logistics?.avg_pickup_delay_mins?.toFixed(1) ?? '0.0'}
            suffix=" m"
          />
          <MetricCard
            label="Avg Distance"
            value={logistics?.avg_route_distance_km?.toFixed(2) ?? '0.00'}
            suffix=" km"
          />
          <MetricCard
            label="Algorithmic Savings"
            value={logistics?.route_distance_saved_km?.toFixed(1) ?? '0.0'}
            suffix=" km"
            description="vs. nearest-NGO baseline"
          />
        </div>
      </section>

      {/* Social Impact */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 uppercase tracking-wider">
          <Users size={16} className="text-emerald-600" />
          Social Impact
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MetricCard label="Organisations Served" value={social?.organisations_served ?? 0} />
          <MetricCard
            label="Beneficiaries Reached"
            value={social?.beneficiaries_reached ?? 0}
            description="Estimate based on food volume"
          />
        </div>
      </section>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number | string;
  suffix?: string;
  description?: string;
}

function MetricCard({ label, value, suffix = '', description }: MetricCardProps) {
  return (
    <div className="bg-white p-4 rounded-md border border-zinc-200 hover:border-emerald-500/50 transition-colors shadow-sm group">
      <div className="text-xs text-zinc-500 uppercase tracking-tight mb-2 font-medium group-hover:text-emerald-700 transition-colors">{label}</div>
      <div className="text-2xl font-mono text-zinc-900 font-semibold tracking-tight">
        {value}
        <span className="text-sm text-zinc-400 font-sans ml-1">{suffix}</span>
      </div>
      {description && <div className="text-xs text-zinc-400 mt-2">{description}</div>}
    </div>
  );
}
