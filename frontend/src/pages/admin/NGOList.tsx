/**
 * NGOList — admin view of all NGOs with verification status filter.
 * Calls GET /api/v1/ngos?verification_status=...
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, CheckCircle, XCircle, Clock, Search, Weight, ChevronRight } from 'lucide-react';
import { apiClient } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import type { NGO, SuccessEnvelope } from '../../types/api';

type FilterStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const FILTERS: FilterStatus[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

const STATUS_BADGE: Record<string, JSX.Element> = {
  APPROVED: <span className="badge-green"><CheckCircle size={12} /> Approved</span>,
  PENDING: <span className="badge-orange"><Clock size={12} /> Pending</span>,
  REJECTED: <span className="badge-red"><XCircle size={12} /> Rejected</span>,
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
    <AdminLayout>
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title">NGO Registry</h1>
          <p className="page-subtitle">Directory of all registered nodes and operational status.</p>
        </div>
        <span className="badge-gray px-3 py-1 text-sm font-mono-data">
          TOTAL: {filtered.length} NODE{filtered.length !== 1 ? 'S' : ''}
        </span>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="input-base pl-10"
            placeholder="Search by facility name or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 p-1 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-md shadow-sm">
          {FILTERS.map((f) => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-sm text-xs font-semibold tracking-wide transition-colors ${
                  isActive ? 'bg-[var(--bg-panel-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-page)]'
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
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-16 w-full rounded-md" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel p-16 text-center flex flex-col items-center border-[var(--border-subtle)]">
          <Building2 size={32} className="mb-4 text-[var(--text-muted)]" />
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">No active nodes found</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {search ? 'Try adjusting your search parameters.' : `No NGOs found matching status: ${filter}.`}
          </p>
        </div>
      ) : (
        <div className="bg-[var(--bg-page)] border border-[var(--border-strong)] rounded-md overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-wide border-b border-[var(--border-strong)] text-[var(--text-secondary)] bg-[var(--bg-panel)]">
            <div className="col-span-3">Organization</div>
            <div className="col-span-3">Location</div>
            <div className="col-span-2">Capacity Utilization</div>
            <div className="col-span-2">Verification Status</div>
            <div className="col-span-1">Registered</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {filtered.map((ngo) => {
              const usedPct = ngo.storage_capacity_kg > 0
                ? ((ngo.storage_capacity_kg - ngo.available_capacity_kg) / ngo.storage_capacity_kg) * 100
                : 0;
              return (
                <div key={ngo.id} className="grid grid-cols-12 gap-4 px-6 py-4 transition-colors hover:bg-[var(--bg-panel-hover)] items-center group">
                  {/* Name */}
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-sm bg-[var(--bg-panel)] border border-[var(--border-strong)] text-[var(--text-muted)] flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)] truncate">{ngo.organisation_name}</p>
                      <p className="text-xs text-[var(--text-muted)] font-mono-data truncate">ID: {ngo.id.substring(0,8)}</p>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="col-span-3 text-sm text-[var(--text-secondary)]">
                    <p className="truncate" title={ngo.address}>{ngo.address}</p>
                  </div>

                  {/* Capacity */}
                  <div className="col-span-2 pr-4">
                    <div className="flex justify-between items-center text-xs mb-1.5 text-[var(--text-secondary)] font-medium">
                      <span className="font-mono-data tabular-nums">{ngo.available_capacity_kg} <span className="text-[var(--text-muted)]">/ {ngo.storage_capacity_kg} kg</span></span>
                      <Weight size={12} className="text-[var(--text-muted)]" />
                    </div>
                    <div className="capacity-bar h-1">
                      <div
                        className={`capacity-fill ${usedPct > 90 ? 'critical' : usedPct > 70 ? 'warning' : ''}`}
                        style={{ width: `${Math.min(usedPct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 flex items-center">
                    {STATUS_BADGE[ngo.verification_status] ?? <span className="badge-gray">{ngo.verification_status}</span>}
                  </div>

                  {/* Date */}
                  <div className="col-span-1 text-xs text-[var(--text-secondary)] font-mono-data">
                    {new Date(ngo.created_at).toLocaleDateString()}
                  </div>
                  
                  {/* Action */}
                  <div className="col-span-1 flex justify-end">
                     <button className="btn-ghost p-2 opacity-0 group-hover:opacity-100 transition-opacity" title="View details">
                       <ChevronRight size={16} />
                     </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

