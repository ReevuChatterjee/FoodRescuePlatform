/**
 * NGOList — admin view of all NGOs with verification status filter.
 * Calls GET /api/v1/ngos?verification_status=...
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Search, ArrowRight } from 'lucide-react';
import { apiClient } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import type { NGO, SuccessEnvelope } from '../../types/api';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
type CapacityFilter = 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH';
type OpFilter = 'ALL' | 'ONLINE' | 'OFFLINE';

export function NGOList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [capacityFilter, setCapacityFilter] = useState<CapacityFilter>('ALL');
  const [opFilter, setOpFilter] = useState<OpFilter>('ALL');

  const { data: allNgos = [], isLoading } = useQuery({
    queryKey: ['admin', 'ngos'],
    queryFn: async () => {
      const { data } = await apiClient.get<SuccessEnvelope<NGO[]>>(`/api/v1/ngos`);
      return data.data;
    },
    refetchInterval: 30000,
  });

  const stats = useMemo(() => {
    return allNgos.reduce(
      (acc, n) => {
        acc.total++;
        if (n.verification_status === 'APPROVED') acc.approved++;
        if (n.verification_status === 'PENDING') acc.pending++;
        acc.totalCap += n.storage_capacity_kg;
        acc.availCap += n.available_capacity_kg;
        return acc;
      },
      { total: 0, approved: 0, pending: 0, totalCap: 0, availCap: 0 }
    );
  }, [allNgos]);

  const filtered = useMemo(() => {
    return allNgos.filter((n) => {
      if (search && !n.organisation_name.toLowerCase().includes(search.toLowerCase()) && !n.address.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'ALL' && n.verification_status !== statusFilter) return false;
      
      const usedPct = n.storage_capacity_kg > 0 ? ((n.storage_capacity_kg - n.available_capacity_kg) / n.storage_capacity_kg) * 100 : 0;
      if (capacityFilter === 'LOW' && usedPct > 33) return false;
      if (capacityFilter === 'MEDIUM' && (usedPct <= 33 || usedPct > 66)) return false;
      if (capacityFilter === 'HIGH' && usedPct <= 66) return false;

      const isOnline = n.verification_status === 'APPROVED';
      if (opFilter === 'ONLINE' && !isOnline) return false;
      if (opFilter === 'OFFLINE' && isOnline) return false;

      return true;
    });
  }, [allNgos, search, statusFilter, capacityFilter, opFilter]);

  return (
    <AdminLayout>
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface mb-1">NGO Registry</h1>
          <p className="text-[0.8125rem] font-medium text-on-surface-variant">Directory of registered nodes and operational status.</p>
        </div>
        <div className="flex gap-6 text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest font-mono-data border-l border-outline-variant pl-6">
          <span className="flex flex-col gap-0.5"><span>Total</span><span className="text-sm text-on-surface">{stats.total.toString().padStart(2, '0')}</span></span>
          <span className="flex flex-col gap-0.5"><span>Approved</span><span className="text-sm text-primary">{stats.approved.toString().padStart(2, '0')}</span></span>
          <span className="flex flex-col gap-0.5"><span>Pending</span><span className="text-sm text-warning">{stats.pending.toString().padStart(2, '0')}</span></span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col xl:flex-row gap-4 mb-4">
        {/* Search */}
        <div className="relative w-full xl:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            className="w-full h-9 pl-9 pr-3 text-sm bg-surface-container-lowest border border-outline-variant/50 rounded-sm focus:outline-none focus:border-primary/50 text-on-surface placeholder:text-on-surface-variant/70"
            placeholder="Search facility / location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Groups */}
        <div className="flex flex-wrap gap-4 flex-1">
          {/* Status */}
          <div className="flex items-center text-xs">
            <span className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-wider mr-3">Status</span>
            <div className="flex rounded-sm overflow-hidden border border-outline-variant/50">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as StatusFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 font-semibold transition-colors ${statusFilter === f ? 'bg-surface-container text-on-surface' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container/50'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {/* Capacity */}
          <div className="flex items-center text-xs">
            <span className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-wider mr-3">Capacity</span>
            <div className="flex rounded-sm overflow-hidden border border-outline-variant/50">
              {(['ALL', 'LOW', 'MEDIUM', 'HIGH'] as CapacityFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setCapacityFilter(f)}
                  className={`px-3 py-1.5 font-semibold transition-colors ${capacityFilter === f ? 'bg-surface-container text-on-surface' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container/50'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {/* Operational */}
          <div className="flex items-center text-xs">
            <span className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-wider mr-3">Op. Status</span>
            <div className="flex rounded-sm overflow-hidden border border-outline-variant/50">
              {(['ALL', 'ONLINE', 'OFFLINE'] as OpFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setOpFilter(f)}
                  className={`px-3 py-1.5 font-semibold transition-colors ${opFilter === f ? 'bg-surface-container text-on-surface' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container/50'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="border border-outline-variant/50 rounded-sm bg-surface-container-lowest overflow-hidden flex flex-col mb-4">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-[0.8125rem] min-w-[1000px]">
            <thead className="bg-surface-container-lowest border-b border-outline-variant/50 text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Capacity</th>
                <th className="px-4 py-3 font-medium">Utilization</th>
                <th className="px-4 py-3 font-medium">Op. Status</th>
                <th className="px-4 py-3 font-medium">Verification</th>
                <th className="px-4 py-3 font-medium">Registered</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 font-mono-data text-[0.75rem]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-on-surface-variant">
                    <div className="flex justify-center"><div className="w-4 h-4 rounded-full bg-primary animate-pulse" /></div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <Building2 size={24} className="text-on-surface-variant mb-3 opacity-50" />
                      <span className="text-sm font-semibold text-on-surface">No nodes found</span>
                      <span className="text-xs text-on-surface-variant mt-1">Adjust your filters to see more results.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((ngo) => {
                  const used = ngo.storage_capacity_kg - ngo.available_capacity_kg;
                  const usedPct = ngo.storage_capacity_kg > 0 ? (used / ngo.storage_capacity_kg) * 100 : 0;
                  const isOnline = ngo.verification_status === 'APPROVED';
                  
                  return (
                    <tr key={ngo.id} className="hover:bg-surface-container/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-on-surface font-sans">{ngo.organisation_name}</div>
                        <div className="text-[0.625rem] text-on-surface-variant opacity-70">ID: {ngo.id.substring(0,8)}</div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant truncate max-w-[150px]" title={ngo.address}>
                        {ngo.address}
                      </td>
                      <td className="px-4 py-3">
                        <div className="whitespace-nowrap">{used} / {ngo.storage_capacity_kg} kg</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1 bg-outline-variant/40 rounded-none overflow-hidden flex-shrink-0">
                            <div className="h-full bg-primary" style={{ width: `${Math.min(usedPct, 100)}%` }} />
                          </div>
                          <span className="w-8 text-right">{usedPct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isOnline ? (
                          <span className="text-primary font-bold text-[0.6875rem] uppercase tracking-wider flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> ONLINE</span>
                        ) : (
                          <span className="text-on-surface-variant font-bold text-[0.6875rem] uppercase tracking-wider flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-outline-variant" /> OFFLINE</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-[0.6875rem] uppercase tracking-wider ${
                          ngo.verification_status === 'APPROVED' ? 'text-primary' : 
                          ngo.verification_status === 'PENDING' ? 'text-warning' : 'text-error'
                        }`}>{ngo.verification_status}</span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {new Date(ngo.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-primary font-bold text-xs hover:underline flex items-center justify-end gap-1 w-full opacity-50 group-hover:opacity-100 transition-opacity">
                          View <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Registry Summary ── */}
      <div className="flex flex-wrap items-center gap-8 bg-surface-container-lowest border border-outline-variant/50 p-4 rounded-sm text-xs font-mono-data text-on-surface-variant">
        <span><strong className="text-on-surface font-sans">{stats.total}</strong> registered facilities</span>
        <span><strong className="text-on-surface font-sans">{stats.totalCap} kg</strong> total capacity</span>
        <span><strong className="text-on-surface font-sans">{stats.availCap} kg</strong> available capacity</span>
        <span><strong className="text-on-surface font-sans">{stats.totalCap > 0 ? (((stats.totalCap - stats.availCap) / stats.totalCap) * 100).toFixed(0) : 0}%</strong> average utilization</span>
      </div>
    </AdminLayout>
  );
}

