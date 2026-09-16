/**
 * IncomingOffers — NGO view of matched donations waiting for accept/reject.
 * GET /api/v1/ngos/{id}/incoming — shows donations matched to this NGO.
 */

import { useState } from 'react';
import { Package, Clock, Weight, CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMyNGOProfile, useIncomingOffers } from '../../hooks/useNGO';
import { AppLayout } from '../../components/layout/AppLayout';
import { apiClient } from '../../api/client';

function ShelfLifeBar({ minutes }: { minutes: number }) {
  const totalMinutes = 8 * 60; // 8 hours reference
  const pct = Math.min((minutes / totalMinutes) * 100, 100);
  const color = minutes < 30 ? 'bg-red-500' : minutes < 120 ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = minutes < 30 ? 'text-red-400' : minutes < 120 ? 'text-amber-400' : 'text-emerald-400';
  return (
    <div>
      <div className="flex justify-between text-xs font-medium uppercase tracking-wide mb-2 text-zinc-500">
        <span>Shelf life</span>
        <span className={textColor}>
          {minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`}
        </span>
      </div>
      <div className="capacity-bar">
        <div className={`capacity-fill ${color}`} style={{ width: `${pct}%` }} />
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
      showToast('Donation accepted! Driver will be dispatched.', 'success');
      setActionDonationId(null);
      queryClient.invalidateQueries({ queryKey: ['ngo', 'incoming'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.error?.message || 'Failed to accept donation.', 'error');
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
      showToast('Donation rejected. It will be rematched.', 'success');
      setActionDonationId(null);
      queryClient.invalidateQueries({ queryKey: ['ngo', 'incoming'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.error?.message || 'Failed to reject donation.', 'error');
      setActionDonationId(null);
    },
  });

  const isLoading = profileLoading || offersLoading;

  return (
    <AppLayout>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-sm text-sm font-medium shadow-lg border ${toast.type === 'success' ? 'bg-emerald-950 border-emerald-900 text-emerald-400' : 'bg-red-950 border-red-900 text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Incoming Offers</h1>
          <p className="page-subtitle">Matched donations waiting for your acceptance</p>
        </div>
        <button className="btn-secondary" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-40 w-full" />)}
        </div>
      ) : !offers || offers.length === 0 ? (
        <div className="panel p-16 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-sm bg-zinc-800 text-zinc-400 flex items-center justify-center mb-5">
            <Package size={24} />
          </div>
          <h3 className="text-base font-semibold text-zinc-100 mb-2">No incoming offers</h3>
          <p className="text-sm text-zinc-400 mb-2">
            When the matching engine assigns donations to your NGO, they'll appear here.
          </p>
          <p className="text-xs text-zinc-500">
            Make sure your capacity and accepted categories are up to date in Settings.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            {offers.length} donation{offers.length !== 1 ? 's' : ''} matched to your NGO — act quickly before they expire
          </p>

          {offers.map((offer) => {
            const isPending = actionDonationId === offer.donation_id;
            const isUrgent = offer.remaining_shelf_life_min < 60;

            return (
              <div key={offer.donation_id}
                className={`panel p-6 ${isUrgent ? 'border-red-900 bg-red-950/20' : ''}`}>
                <div className="flex items-start gap-4">
                  {/* Category icon */}
                  <div className="w-10 h-10 rounded-sm bg-zinc-800 text-zinc-400 flex items-center justify-center flex-shrink-0">
                    <Package size={20} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="font-semibold text-zinc-100">
                        {offer.food_name}
                      </h3>
                      {isUrgent && (
                        <span className="badge-red text-xs flex items-center gap-1 uppercase tracking-wide font-semibold">
                          <AlertTriangle size={10} /> Urgent
                        </span>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-4 text-xs text-zinc-400 mb-5">
                      <span className="flex items-center gap-1.5">
                        <Weight size={14} className="text-zinc-500" /> <span className="tabular-nums">{offer.quantity_kg} kg</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Package size={14} className="text-zinc-500" /> {offer.food_category.replace(/_/g, ' ')}
                      </span>
                      {offer.eta_minutes !== null && (
                        <span className="flex items-center gap-1.5">
                          <Clock size={14} className="text-zinc-500" /> ETA <span className="tabular-nums">{offer.eta_minutes} min</span>
                        </span>
                      )}
                      {offer.match_score !== null && (
                        <span className="flex items-center gap-1.5">
                          ⭐ Score <span className="tabular-nums">{(offer.match_score * 100).toFixed(0)}%</span>
                        </span>
                      )}
                    </div>

                    {/* Shelf life bar */}
                    <div className="mb-6 max-w-xs">
                      <ShelfLifeBar minutes={offer.remaining_shelf_life_min} />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3">
                      <button
                        className="btn-primary px-6 py-2"
                        disabled={isPending}
                        onClick={() => {
                          setActionDonationId(offer.donation_id);
                          acceptMutation.mutate(offer.donation_id);
                        }}
                      >
                        <CheckCircle size={16} />
                        Accept
                      </button>
                      <button
                        className="px-6 py-2 rounded-sm text-sm font-semibold flex items-center gap-2 border border-red-900 bg-red-950 text-red-400 hover:bg-red-900 transition-colors"
                        disabled={isPending}
                        onClick={() => {
                          setActionDonationId(offer.donation_id);
                          rejectMutation.mutate(offer.donation_id);
                        }}
                      >
                        <XCircle size={16} />
                        Reject
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
