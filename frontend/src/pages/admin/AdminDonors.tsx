/**
 * AdminDonors — Admin view of all registered commercial food donors.
 * Calls GET /api/v1/donors
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, ArrowRight, X, Mail, MapPin, Package, CheckCircle2, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import type { DonorItem, SuccessEnvelope } from '../../types/api';

type CategoryFilter = 'ALL' | 'PRODUCE' | 'COOKED' | 'PACKAGED' | 'BAKERY' | 'DAIRY';
type VerificationFilter = 'ALL' | 'VERIFIED' | 'PENDING';
type ActivityFilter = 'ALL' | 'ACTIVE' | 'IDLE';

export function AdminDonors() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<CategoryFilter>('ALL');
  const [verFilter, setVerFilter] = useState<VerificationFilter>('ALL');
  const [actFilter, setActFilter] = useState<ActivityFilter>('ALL');
  const [selectedDonor, setSelectedDonor] = useState<DonorItem | null>(null);

  const { data: allDonors = [], isLoading } = useQuery({
    queryKey: ['admin', 'donors'],
    queryFn: async () => {
      const { data } = await apiClient.get<SuccessEnvelope<DonorItem[]>>('/api/v1/donors');
      return data.data;
    },
    refetchInterval: 15000,
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ donorId, status }: { donorId: string; status: string }) => {
      const { data } = await apiClient.patch(`/api/v1/donors/${donorId}/verify`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'donors'] });
      if (selectedDonor) {
        setSelectedDonor((prev) => prev ? { ...prev, verification_status: 'VERIFIED' } : null);
      }
    },
  });

  const stats = useMemo(() => {
    return allDonors.reduce(
      (acc, d) => {
        acc.total++;
        if (d.verification_status === 'VERIFIED') acc.verified++;
        if (d.active_donations > 0) acc.activeRescues++;
        acc.totalKg += d.total_donated_kg || 0;
        acc.totalBatches += d.total_donations || 0;
        acc.activeBatches += d.active_donations || 0;
        return acc;
      },
      { total: 0, verified: 0, activeRescues: 0, totalKg: 0, totalBatches: 0, activeBatches: 0 }
    );
  }, [allDonors]);

  const filtered = useMemo(() => {
    return allDonors.filter((d) => {
      if (search) {
        const q = search.toLowerCase();
        const matchName = d.organisation_name?.toLowerCase().includes(q);
        const matchAddr = d.address?.toLowerCase().includes(q);
        const matchContact = d.contact_person?.toLowerCase().includes(q);
        const matchEmail = d.email?.toLowerCase().includes(q);
        if (!matchName && !matchAddr && !matchContact && !matchEmail) return false;
      }

      if (catFilter !== 'ALL' && !d.daily_waste_category?.toUpperCase().includes(catFilter)) {
        return false;
      }

      if (verFilter !== 'ALL' && d.verification_status !== verFilter) {
        return false;
      }

      if (actFilter === 'ACTIVE' && d.total_donations === 0) return false;
      if (actFilter === 'IDLE' && d.total_donations > 0) return false;

      return true;
    });
  }, [allDonors, search, catFilter, verFilter, actFilter]);

  return (
    <AdminLayout>
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface mb-1">Donor Registry</h1>
          <p className="text-[0.8125rem] font-medium text-on-surface-variant">
            Directory of commercial food donors, facilities, and rescue volume metrics.
          </p>
        </div>
        <div className="flex gap-6 text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest font-mono-data border-l border-outline-variant pl-6">
          <span className="flex flex-col gap-0.5">
            <span>Total</span>
            <span className="text-sm text-on-surface">{stats.total.toString().padStart(2, '0')}</span>
          </span>
          <span className="flex flex-col gap-0.5">
            <span>Active</span>
            <span className="text-sm text-primary">{stats.activeRescues.toString().padStart(2, '0')}</span>
          </span>
          <span className="flex flex-col gap-0.5">
            <span>Volume</span>
            <span className="text-sm text-on-surface">{stats.totalKg.toFixed(0)} kg</span>
          </span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col xl:flex-row gap-4 mb-4">
        {/* Search */}
        <div className="relative w-full xl:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            className="w-full h-9 pl-9 pr-3 text-sm bg-surface-container-lowest border border-outline-variant/50 rounded-md focus:outline-none focus:border-primary/50 text-on-surface placeholder:text-on-surface-variant/70"
            placeholder="Search donor / location / contact"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Groups */}
        <div className="flex flex-wrap gap-4 flex-1">
          {/* Category */}
          <div className="flex items-center text-xs">
            <span className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-wider mr-3">Waste Category</span>
            <div className="flex rounded-md overflow-hidden border border-outline-variant/50">
              {(['ALL', 'PRODUCE', 'COOKED', 'PACKAGED', 'BAKERY', 'DAIRY'] as CategoryFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setCatFilter(f)}
                  className={`px-3 py-1.5 font-semibold transition-colors ${
                    catFilter === f
                      ? 'bg-surface-container text-on-surface'
                      : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container/50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Verification */}
          <div className="flex items-center text-xs">
            <span className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-wider mr-3">Verification</span>
            <div className="flex rounded-md overflow-hidden border border-outline-variant/50">
              {(['ALL', 'VERIFIED', 'PENDING'] as VerificationFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setVerFilter(f)}
                  className={`px-3 py-1.5 font-semibold transition-colors ${
                    verFilter === f
                      ? 'bg-surface-container text-on-surface'
                      : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container/50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="flex items-center text-xs">
            <span className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-wider mr-3">Activity</span>
            <div className="flex rounded-md overflow-hidden border border-outline-variant/50">
              {(['ALL', 'ACTIVE', 'IDLE'] as ActivityFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setActFilter(f)}
                  className={`px-3 py-1.5 font-semibold transition-colors ${
                    actFilter === f
                      ? 'bg-surface-container text-on-surface'
                      : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container/50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="border border-outline-variant/50 rounded-md bg-surface-container-lowest overflow-hidden flex flex-col mb-4">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-[0.8125rem] min-w-[1000px]">
            <thead className="bg-surface-container-lowest border-b border-outline-variant/50 text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 font-medium">Donor Organization</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Contact Person</th>
                <th className="px-4 py-3 font-medium">Total Rescues</th>
                <th className="px-4 py-3 font-medium">Volume Rescued</th>
                <th className="px-4 py-3 font-medium">Verification</th>
                <th className="px-4 py-3 font-medium">Registered</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 font-mono-data text-[0.75rem]">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-on-surface-variant">
                    <div className="flex justify-center">
                      <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <Users size={24} className="text-on-surface-variant mb-3 opacity-50" />
                      <span className="text-sm font-semibold text-on-surface">No donors found</span>
                      <span className="text-xs text-on-surface-variant mt-1">Adjust your filters to see more results.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((donor) => {
                  const isVerified = donor.verification_status === 'VERIFIED';
                  const hasActive = donor.active_donations > 0;

                  return (
                    <tr key={donor.id} className="hover:bg-surface-container/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-on-surface font-sans">{donor.organisation_name}</div>
                        <div className="text-[0.625rem] text-on-surface-variant opacity-70">
                          ID: {donor.id.substring(0, 8)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant truncate max-w-[180px]" title={donor.address}>
                        {donor.address}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[0.6875rem] font-bold tracking-wide uppercase bg-surface-container text-on-surface">
                          {donor.daily_waste_category || 'PRODUCE'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        <div className="font-sans text-on-surface font-medium">{donor.contact_person}</div>
                        <div className="text-[0.625rem] opacity-70">{donor.phone || donor.email || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-on-surface">{donor.total_donations}</span>
                          <span className="text-on-surface-variant opacity-70">batches</span>
                          {hasActive && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[0.5625rem] font-bold bg-primary/10 text-primary uppercase ml-1">
                              {donor.active_donations} Active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-on-surface">{donor.total_donated_kg} kg</span>
                      </td>
                      <td className="px-4 py-3">
                        {isVerified ? (
                          <span className="text-primary font-bold text-[0.6875rem] uppercase tracking-wider flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" /> VERIFIED
                          </span>
                        ) : (
                          <span className="text-warning font-bold text-[0.6875rem] uppercase tracking-wider flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-warning" /> PENDING
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {donor.created_at ? new Date(donor.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedDonor(donor)}
                          className="text-primary font-bold text-xs hover:underline flex items-center justify-end gap-1 w-full opacity-70 group-hover:opacity-100 transition-opacity"
                        >
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
      <div className="flex flex-wrap items-center gap-8 bg-surface-container-lowest border border-outline-variant/50 p-4 rounded-md text-xs font-mono-data text-on-surface-variant">
        <span><strong className="text-on-surface font-sans">{stats.total}</strong> registered donors</span>
        <span><strong className="text-on-surface font-sans">{stats.totalBatches}</strong> total donations created</span>
        <span><strong className="text-on-surface font-sans">{stats.totalKg.toFixed(1)} kg</strong> surplus food rescued</span>
        <span><strong className="text-on-surface font-sans">{stats.activeBatches}</strong> active in pipeline</span>
      </div>

      {/* ── Donor Details Drawer / Modal ── */}
      {selectedDonor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-md w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-outline-variant/40 bg-surface-container/20">
              <div>
                <h3 className="text-lg font-bold text-on-surface">{selectedDonor.organisation_name}</h3>
                <p className="text-xs text-on-surface-variant">Donor ID: {selectedDonor.id}</p>
              </div>
              <button
                onClick={() => setSelectedDonor(null)}
                className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 flex flex-col gap-5 text-sm">
              <div className="grid grid-cols-2 gap-4 bg-surface-container/30 p-4 rounded border border-outline-variant/30">
                <div>
                  <span className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                    Total Contributed
                  </span>
                  <span className="text-xl font-bold font-mono-data text-on-surface">
                    {selectedDonor.total_donated_kg} kg
                  </span>
                  <span className="text-xs text-on-surface-variant block mt-0.5">
                    {selectedDonor.total_donations} total donation batches
                  </span>
                </div>
                <div>
                  <span className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                    Active Rescues
                  </span>
                  <span className="text-xl font-bold font-mono-data text-primary">
                    {selectedDonor.active_donations}
                  </span>
                  <span className="text-xs text-on-surface-variant block mt-0.5">
                    currently moving or awaiting pickup
                  </span>
                </div>
              </div>

              {/* Information list */}
              <div className="flex flex-col gap-3 font-mono-data text-xs">
                <div className="flex items-start gap-2.5">
                  <MapPin size={14} className="text-on-surface-variant mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-on-surface-variant block text-[0.6875rem]">Address & Coordinates</span>
                    <span className="text-on-surface font-sans">{selectedDonor.address}</span>
                    {selectedDonor.location && (
                      <span className="text-[0.6875rem] text-on-surface-variant block">
                        Geo: {selectedDonor.location}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Package size={14} className="text-on-surface-variant mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-on-surface-variant block text-[0.6875rem]">Primary Waste Stream</span>
                    <span className="text-on-surface font-sans font-medium uppercase">
                      {selectedDonor.daily_waste_category || 'General Surplus Food'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Mail size={14} className="text-on-surface-variant mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-on-surface-variant block text-[0.6875rem]">Contact Information</span>
                    <span className="text-on-surface font-sans font-medium">{selectedDonor.contact_person}</span>
                    <span className="text-on-surface-variant block">
                      {selectedDonor.email || 'No email provided'} • {selectedDonor.phone || 'No phone'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <ShieldCheck size={14} className="text-on-surface-variant mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-on-surface-variant block text-[0.6875rem]">Verification Status</span>
                    <span className={`font-bold uppercase ${
                      selectedDonor.verification_status === 'VERIFIED' ? 'text-primary' : 'text-warning'
                    }`}>
                      {selectedDonor.verification_status || 'VERIFIED'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex justify-end gap-3 border-t border-outline-variant/30">
                {selectedDonor.verification_status !== 'VERIFIED' && (
                  <button
                    onClick={() => verifyMutation.mutate({ donorId: selectedDonor.id, status: 'VERIFIED' })}
                    disabled={verifyMutation.isPending}
                    className="btn-primary flex items-center gap-1.5 text-xs py-2 px-4"
                  >
                    <CheckCircle2 size={14} />
                    Verify Donor Facility
                  </button>
                )}
                <button
                  onClick={() => setSelectedDonor(null)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
