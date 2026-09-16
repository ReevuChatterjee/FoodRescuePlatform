/**
 * DonorDashboard — shows all donor donations with stats and real-time WebSocket updates.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Package, CheckCircle, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { apiClient } from '../../api/client';
import type { Donation, SuccessEnvelope } from '../../types/api';
import { StatusBadge } from '../../components/donor/StatusBadge';
import { useDonationWebSocket } from '../../hooks/useDonationWebSocket';
import { AppLayout } from '../../components/layout/AppLayout';
import { format } from 'date-fns';

const CATEGORY_LABELS: Record<string, string> = {
  RAW_PRODUCE: 'Raw Produce',
  COOKED: 'Cooked',
  PACKAGED: 'Packaged',
  BAKED_GOODS: 'Baked Goods',
  DAIRY: 'Dairy',
  MIXED: 'Mixed',
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

  // Derived stats
  const totalKg = donations.reduce((s, d) => s + d.quantity_kg, 0);
  const active = donations.filter((d) => ['AVAILABLE', 'MATCHING', 'MATCHED', 'ACCEPTED', 'DRIVER_ASSIGNED', 'PICKUP_STARTED', 'IN_TRANSIT'].includes(d.status)).length;
  const delivered = donations.filter((d) => d.status === 'DELIVERED').length;

  if (error) {
    return (
      <AppLayout>
        <div className="panel p-12 text-center">
          <p className="text-red-500 font-medium">Failed to load donations. Please try refreshing.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Donations</h1>
          <p className="page-subtitle">Track your food donations in real time</p>
        </div>
        <Link to="/donor/donate" className="btn-primary">
          <Plus size={16} /> New Donation
        </Link>
      </div>

      {/* Stats row */}
      {!isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Donations', value: donations.length, icon: <Package size={16} />, color: 'text-zinc-100' },
            { label: 'Active', value: active, icon: <Clock size={16} />, color: 'text-blue-400' },
            { label: 'Delivered', value: delivered, icon: <CheckCircle size={16} />, color: 'text-emerald-400' },
            { label: 'Food Donated', value: `${totalKg.toFixed(1)} kg`, icon: <TrendingUp size={16} />, color: 'text-zinc-100' },
          ].map((s) => (
            <div key={s.label} className="panel flex flex-col justify-between p-5">
              <div className="flex items-center gap-1.5 text-zinc-500 mb-3">
                {s.icon}
                <span className="text-xs font-medium uppercase tracking-wide">{s.label}</span>
              </div>
              <p className={`text-2xl font-semibold tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3 mb-8">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 w-full" />)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && donations.length === 0 && (
        <div className="panel p-16 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-sm bg-zinc-800 flex items-center justify-center mb-5 text-zinc-400">
            <Package size={24} />
          </div>
          <h3 className="text-base font-semibold text-zinc-100 mb-2">No donations yet</h3>
          <p className="text-sm text-zinc-400 mb-6">
            Start by listing your first surplus food donation.
          </p>
          <Link to="/donor/donate" className="btn-primary">
            <Plus size={16} /> Create First Donation
          </Link>
        </div>
      )}

      {/* Donations list */}
      {!isLoading && donations.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-sm overflow-hidden">
          <div className="divide-y divide-zinc-800">
            {donations.map((donation) => {
              const isExpiringSoon = new Date(donation.expiry_time) < new Date(Date.now() + 2 * 3600 * 1000);
              return (
                <Link
                  key={donation.id}
                  to={`/donor/donation/${donation.id}`}
                  className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-zinc-900 group"
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-sm bg-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-400">
                    <Package size={16} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <p className="font-medium text-sm text-zinc-100 truncate">
                        {donation.food_name}
                      </p>
                      <StatusBadge status={donation.status} />
                      {isExpiringSoon && ['AVAILABLE', 'MATCHING'].includes(donation.status) && (
                        <span className="badge-red">Expiring soon</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span>{CATEGORY_LABELS[donation.food_category] ?? donation.food_category}</span>
                      <span>•</span>
                      <span className="tabular-nums">{donation.quantity_kg} kg</span>
                      <span>•</span>
                      <span>Expires {format(new Date(donation.expiry_time), 'MMM d, HH:mm')}</span>
                      
                      {donation.matched_ngo_id && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-500 font-medium">Matched to NGO</span>
                        </>
                      )}
                      
                      {donation.eta_minutes !== null && (
                        <>
                          <span>•</span>
                          <span className="text-blue-400 font-medium">ETA {donation.eta_minutes}m</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Created */}
                  <div className="hidden sm:block text-right flex-shrink-0">
                    <p className="text-xs text-zinc-400">
                      {format(new Date(donation.created_at), 'MMM d, yyyy')}
                    </p>
                    <p className="text-xs text-zinc-500 tabular-nums">
                      {format(new Date(donation.created_at), 'HH:mm')}
                    </p>
                  </div>

                  <ArrowRight size={16} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
