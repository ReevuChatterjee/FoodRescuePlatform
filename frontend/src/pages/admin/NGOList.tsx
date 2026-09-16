/**
 * NGOList — admin view of all NGOs with verification status filter.
 * Calls GET /api/v1/ngos?verification_status=...
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, CheckCircle, XCircle, Clock, Search, Weight } from 'lucide-react';
import { apiClient } from '../../api/client';
import { AppLayout } from '../../components/layout/AppLayout';
import type { NGO, SuccessEnvelope } from '../../types/api';

type FilterStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const FILTERS: FilterStatus[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

const STATUS_BADGE: Record<string, JSX.Element> = {
  APPROVED: <span className="badge-green"><CheckCircle size={10} /> Approved</span>,
  PENDING: <span className="badge-yellow"><Clock size={10} /> Pending</span>,
  REJECTED: <span className="badge-red"><XCircle size={10} /> Rejected</span>,
};

export function NGOList() {
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [search, setSearch] = useState('');

  const { data: ngos, isLoading } = useQuery({
    queryKey: ['admin', 'ngos', filter],
    queryFn: async () => {
      const params = filter !== 'ALL' ? `?verification_status=${filter}` : '';
      const { data } = await apiClient.get<SuccessEnvelope<NGO[]>>(`/api/v1/ngos${params}`);
      return data.data;
    },
    refetchInterval: 30000,
  });

  const filtered = (ngos || []).filter(
    (n) => !search || n.organisation_name.toLowerCase().includes(search.toLowerCase()) || n.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header flex justify-between items-start">
        <div>
          <h1 className="page-title">NGO Registry</h1>
          <p className="page-subtitle">All registered NGOs and their verification status</p>
        </div>
        <span className="badge-gray">
          {filtered.length} NGO{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            className="input-base pl-10"
            placeholder="Search by name or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-sm">
          {FILTERS.map((f) => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-sm text-xs font-semibold transition-colors ${
                  isActive ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel p-16 text-center flex flex-col items-center">
          <Building2 size={32} className="mb-4 text-zinc-600" />
          <h3 className="font-semibold text-zinc-100 mb-1">No NGOs found</h3>
          <p className="text-sm text-zinc-400">
            {search ? 'Try a different search term.' : `No NGOs with status ${filter}.`}
          </p>
        </div>
      ) : (
        <div className="bg-zinc-950 border border-zinc-800 rounded-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium uppercase tracking-wide border-b border-zinc-800 text-zinc-500 bg-zinc-900/50">
            <div className="col-span-4">Organisation</div>
            <div className="col-span-3">Address</div>
            <div className="col-span-2">Capacity</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Registered</div>
          </div>

          <div className="divide-y divide-zinc-800">
            {filtered.map((ngo) => {
              const usedPct = ngo.storage_capacity_kg > 0
                ? ((ngo.storage_capacity_kg - ngo.available_capacity_kg) / ngo.storage_capacity_kg) * 100
                : 0;
              return (
                <div key={ngo.id} className="grid grid-cols-12 gap-4 px-6 py-4 transition-colors hover:bg-zinc-900 items-center">
                  {/* Name */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-sm bg-zinc-800 text-zinc-400 flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100 truncate">{ngo.organisation_name}</p>
                      <p className="text-xs text-zinc-500 font-mono truncate">{ngo.id}</p>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="col-span-3 text-sm text-zinc-400">
                    <p className="truncate">{ngo.address}</p>
                  </div>

                  {/* Capacity */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5 text-xs mb-1.5 text-zinc-500 font-medium">
                      <Weight size={12} />
                      <span className="tabular-nums">{ngo.available_capacity_kg}/{ngo.storage_capacity_kg} kg</span>
                    </div>
                    <div className="capacity-bar h-1">
                      <div
                        className={`capacity-fill ${usedPct > 90 ? 'critical' : usedPct > 70 ? 'warning' : ''}`}
                        style={{ width: `${Math.min(usedPct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-1">
                    {STATUS_BADGE[ngo.verification_status] ?? <span className="badge-gray">{ngo.verification_status}</span>}
                  </div>

                  {/* Date */}
                  <div className="col-span-2 text-xs text-zinc-500 tabular-nums">
                    {new Date(ngo.created_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
