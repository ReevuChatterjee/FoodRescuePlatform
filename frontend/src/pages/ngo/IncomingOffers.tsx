/**
 * IncomingOffers — NGO view of matched donations waiting for accept/reject.
 * GET /api/v1/ngos/{id}/incoming — shows donations matched to this NGO.
 */

import { useState } from 'react';
import { Package, Clock, Weight, CheckCircle, XCircle, RefreshCw, AlertTriangle, Crosshair, Navigation } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMyNGOProfile, useIncomingOffers } from '../../hooks/useNGO';
import { AppLayout } from '../../components/layout/AppLayout';
import { apiClient } from '../../api/client';

function ShelfLifeBar({ minutes }: { minutes: number }) {
  const totalMinutes = 8 * 60; // 8 hours reference
  const pct = Math.min((minutes / totalMinutes) * 100, 100);
  const color = minutes < 30 ? 'bg-[var(--error)]' : minutes < 120 ? 'bg-[var(--warning)]' : 'bg-[var(--success)]';
  const textColor = minutes < 30 ? 'text-[var(--error)]' : minutes < 120 ? 'text-[var(--warning)]' : 'text-[var(--success)]';
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
        <span className="text-[var(--text-muted)]">Viability Window</span>
        <span className={`${textColor} font-mono-data`}>
          {minutes >= 60 ? `${Math.floor(minutes / 60)}H ${minutes % 60}M` : `${minutes}M`}
        </span>
      </div>
      <div className="h-1.5 w-full bg-[var(--bg-page)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function IncomingOffers() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useMyNGOProfile();
  const { data: offers, isLoading: offersLoading, refetch } = useIncomingOffers(profile?.ngo_id);
  const [actionDonationId, setActionDonationId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Accept = update donation status to ACCEPTED
  const acceptMutation = useMutation({
    mutationFn: async (donationId: string) => {
      // The NGO accepts by acknowledging — this updates the donation status
      const res = await apiClient.patch(`/api/v1/donations/${donationId}`, { status: 'ACCEPTED' });
      return res.data;
    },
    onSuccess: () => {
      showToast('Payload accepted! Dispatch sequence initiated.', 'success');
      setActionDonationId(null);
      queryClient.invalidateQueries({ queryKey: ['ngo', 'incoming'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.error?.message || 'Failed to authorize payload.', 'error');
      setActionDonationId(null);
    },
  });

  // Reject = cancel the match (marks donation as available again)
  const rejectMutation = useMutation({
    mutationFn: async (donationId: string) => {
      const res = await apiClient.patch(`/api/v1/donations/${donationId}/cancel`, {
        reason: 'NGO rejected matched donation — insufficient capacity or category mismatch',
      });
      return res.data;
    },
    onSuccess: () => {
      showToast('Payload rejected. Rematching algorithms active.', 'success');
      setActionDonationId(null);
      queryClient.invalidateQueries({ queryKey: ['ngo', 'incoming'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.error?.message || 'Failed to reject payload.', 'error');
      setActionDonationId(null);
    },
  });

  const isLoading = profileLoading || offersLoading;

  return (
    <AppLayout>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-md text-sm font-semibold tracking-wide shadow-lg border ${
          toast.type === 'success' ? 'bg-[var(--success)]/10 border-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--error)]/10 border-[var(--error)]/20 text-[var(--error)]'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title">Inbound Dispatch Queue</h1>
          <p className="page-subtitle">Matched surplus payloads requiring node authorization.</p>
        </div>
        <button className="btn-secondary px-4 py-2 flex items-center gap-2" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Sync Network
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-48 w-full rounded-md" />)}
        </div>
      ) : !offers || offers.length === 0 ? (
        <div className="panel p-16 text-center flex flex-col items-center border-[var(--border-subtle)] bg-[var(--bg-page)] relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(var(--brand) 1px, transparent 1px), linear-gradient(90deg, var(--brand) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          <div className="w-16 h-16 rounded-full bg-[var(--bg-panel)] flex items-center justify-center mb-6 border border-[var(--border-strong)] relative z-10">
            <Crosshair size={24} className="text-[var(--text-muted)]" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2 relative z-10">Sector Clear</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4 max-w-md relative z-10">
            Algorithmic routing has no pending payloads for your coordinates. Monitor this terminal for incoming dispatches.
          </p>
          <div className="flex items-center gap-2 text-[10px] font-mono-data text-[var(--brand)] animate-pulse relative z-10 border border-[var(--brand)]/30 bg-[var(--brand)]/5 px-3 py-1 rounded-sm">
             <Navigation size={10} /> SCANNING NETWORK...
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
             <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
               Active Matches
             </p>
             <span className="text-xs font-mono-data text-[var(--text-muted)]">{offers.length} PAYLOAD(S)</span>
          </div>

          {offers.map((offer) => {
            const isPending = actionDonationId === offer.donation_id;
            const isUrgent = offer.remaining_shelf_life_min < 60;

            return (
              <div key={offer.donation_id}
                className={`panel p-6 relative overflow-hidden ${isUrgent ? 'border-[var(--error)]/50 bg-[var(--error)]/5' : 'border-[var(--brand)]/30 bg-[var(--bg-page)]'}`}>
                
                {isUrgent && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--error)]/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                )}

                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
                  {/* Category icon */}
                  <div className={`w-12 h-12 rounded-sm flex items-center justify-center flex-shrink-0 border ${isUrgent ? 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/30' : 'bg-[var(--bg-panel)] text-[var(--brand)] border-[var(--border-strong)]'}`}>
                    {isUrgent ? <AlertTriangle size={24} /> : <Package size={24} />}
                  </div>

                  <div className="flex-1 min-w-0 w-full">
                    {/* Title row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                         <h3 className="text-lg font-bold tracking-tight text-[var(--text-primary)] truncate">
                           {offer.food_name}
                         </h3>
                         {isUrgent && (
                           <span className="px-2 py-0.5 rounded-sm bg-[var(--error)] text-black text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 shadow-sm">
                             <AlertTriangle size={10} /> CRITICAL
                           </span>
                         )}
                      </div>
                      <span className="text-[10px] font-mono-data text-[var(--text-muted)] hidden sm:block">ID: {offer.donation_id.split('-')[0]}</span>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6">
                      <div className="flex flex-col">
                         <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Net Mass</span>
                         <span className="text-sm font-mono-data text-[var(--text-primary)] flex items-center gap-1.5"><Weight size={12} className="text-[var(--brand)]" /> {offer.quantity_kg} kg</span>
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Classification</span>
                         <span className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5"><Package size={12} className="text-[var(--brand)]" /> {offer.food_category.replace(/_/g, ' ')}</span>
                      </div>
                      {offer.eta_minutes !== null && (
                        <div className="flex flex-col">
                           <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Proj. ETA</span>
                           <span className="text-sm font-mono-data text-[var(--warning)] flex items-center gap-1.5"><Clock size={12} /> {offer.eta_minutes} min</span>
                        </div>
                      )}
                      {offer.match_score !== null && (
                        <div className="flex flex-col">
                           <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Algorithmic Fit</span>
                           <span className="text-sm font-mono-data text-[var(--success)] flex items-center gap-1.5"><Crosshair size={12} /> {(offer.match_score * 100).toFixed(0)}%</span>
                        </div>
                      )}
                    </div>

                    {/* Shelf life and Capacity bars */}
                    <div className="mb-6 w-full flex flex-col sm:flex-row gap-6">
                      <div className="flex-1">
                        <ShelfLifeBar minutes={offer.remaining_shelf_life_min} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="w-full">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
                            <span className="text-[var(--text-muted)]">Capacity Consumption</span>
                            <span className={`font-mono-data ${profile?.available_capacity_kg && offer.quantity_kg > profile.available_capacity_kg ? 'text-[var(--error)]' : 'text-[var(--brand)]'}`}>
                              {offer.quantity_kg} kg
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-[var(--bg-page)] rounded-none overflow-hidden flex border border-[var(--border-subtle)]">
                            {/* Current utilized capacity */}
                            <div 
                              className="h-full bg-[var(--border-strong)] opacity-50"
                              style={{ width: `${profile?.storage_capacity_kg ? ((profile.storage_capacity_kg - profile.available_capacity_kg) / profile.storage_capacity_kg) * 100 : 0}%` }}
                            />
                            {/* The space this offer will consume */}
                            <div 
                              className={`h-full ${profile?.available_capacity_kg && offer.quantity_kg > profile.available_capacity_kg ? 'bg-[var(--error)]' : 'bg-[var(--brand)]'} relative`}
                              style={{ width: `${profile?.storage_capacity_kg ? (offer.quantity_kg / profile.storage_capacity_kg) * 100 : 0}%` }}
                            >
                               <div className="absolute inset-0 w-full h-full opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, #000 4px, #000 8px)' }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[var(--border-subtle)]">
                      <button
                        className="btn-primary flex-1 py-3 px-6 flex justify-center items-center gap-2 bg-[var(--brand)] text-black shadow-sm"
                        disabled={isPending}
                        onClick={() => {
                          setActionDonationId(offer.donation_id);
                          acceptMutation.mutate(offer.donation_id);
                        }}
                      >
                        <CheckCircle size={18} />
                        AUTHORIZE PAYLOAD
                      </button>
                      <button
                        className="px-6 py-3 rounded-sm text-sm font-semibold flex justify-center items-center gap-2 border border-[var(--error)] bg-[var(--bg-page)] text-[var(--error)] hover:bg-[var(--error)] hover:text-black transition-colors flex-1 sm:flex-none"
                        disabled={isPending}
                        onClick={() => {
                          setActionDonationId(offer.donation_id);
                          rejectMutation.mutate(offer.donation_id);
                        }}
                      >
                        <XCircle size={18} />
                        DENY
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
