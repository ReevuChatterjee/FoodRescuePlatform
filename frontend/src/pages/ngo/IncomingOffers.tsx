/**
 * IncomingOffers — NGO view of matched donations.
 * AI-tells removed:
 *   - blur-3xl decorative glow blob on urgent → 3px terracotta left-border only
 *   - icon-in-box on offer card → icon inline with text
 *   - equal-column action button layout → full-width accept + text reject link
 *   - grid background decoration on empty state → terse two-line message
 * Uses NGOLayout.
 */

import { useState } from 'react';
import { Clock, Weight, CheckCircle, XCircle, RefreshCw, AlertTriangle, Crosshair } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMyNGOProfile, useIncomingOffers } from '../../hooks/useNGO';
import { NGOLayout } from '../../components/layout/NGOLayout';
import { apiClient } from '../../api/client';

function ShelfLifeBar({ minutes }: { minutes: number }) {
  const totalMinutes = 8 * 60;
  const pct = Math.min((minutes / totalMinutes) * 100, 100);
  const isUrgent  = minutes < 30;
  const isWarning = minutes < 120;
  const fillColor = isUrgent ? 'var(--terracotta)' : isWarning ? 'var(--amber-dim)' : 'var(--moss-light)';
  const textColor = isUrgent ? 'var(--terracotta)' : isWarning ? 'var(--amber-dim)' : 'var(--success)';

  return (
    <div style={{ width: '100%' }}>
      <div className="flex justify-between" style={{ marginBottom: '6px' }}>
        <span className="section-label">Viability Window</span>
        <span
          className="font-mono-data section-label"
          style={{ color: textColor }}
        >
          {minutes >= 60
            ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
            : `${minutes}m`}
        </span>
      </div>
      <div className="capacity-bar">
        <div
          className="capacity-fill"
          style={{ width: `${pct}%`, background: fillColor, transition: 'width 1s var(--ease-reveal)' }}
        />
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

  const acceptMutation = useMutation({
    mutationFn: async (offer: any) => {
      const payload: any = { 
        ngo_id: profile?.ngo_id,
        match_score: offer.match_score || 0,
        weights_version_id: offer.weights_version_id || "default"
      };
      const res = await apiClient.post(`/api/v1/matching/${offer.donation_id}/accept`, payload);
      return res.data;
    },
    onSuccess: () => {
      showToast('Offer accepted — dispatch sequence initiated.', 'success');
      setActionDonationId(null);
      queryClient.invalidateQueries({ queryKey: ['ngo', 'incoming'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.error?.message || 'Failed to accept offer.', 'error');
      setActionDonationId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (donationId: string) => {
      const payload = {
        ngo_id: profile?.ngo_id,
        reason: 'NGO rejected matched donation — insufficient capacity or category mismatch'
      };
      const res = await apiClient.post(`/api/v1/matching/${donationId}/reject`, payload);
      return res.data;
    },
    onSuccess: () => {
      showToast('Offer declined — rematching initiated.', 'success');
      setActionDonationId(null);
      queryClient.invalidateQueries({ queryKey: ['ngo', 'incoming'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.error?.message || 'Failed to decline offer.', 'error');
      setActionDonationId(null);
    },
  });

  const isLoading = profileLoading || offersLoading;

  return (
    <NGOLayout>
      {/* Toast */}
      {toast && (
        <div className={toast.type === 'success' ? 'toast-success' : 'toast-error'}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Inbound Dispatch Queue</h1>
          <p className="page-subtitle">Matched surplus offers requiring authorization.</p>
        </div>
        <button
          className="btn-secondary flex items-center gap-2"
          onClick={() => refetch()}
          disabled={isLoading}
          style={{ padding: '6px 14px' }}
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          Sync
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: '180px', width: '100%' }} />
          ))}
        </div>
      )}

      {/* Empty state — terse, no decorative grid background */}
      {!isLoading && (!offers || offers.length === 0) && (
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            borderLeft: '3px solid var(--border-med)',
          }}
        >
          <Crosshair size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              No pending offers at this time.
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Last checked: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}

      {/* Offer cards */}
      {!isLoading && offers && offers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Count */}
          <div className="flex items-center justify-between" style={{ padding: '0 2px' }}>
            <span className="section-label">{offers.length} offer{offers.length !== 1 ? 's' : ''} pending</span>
          </div>

          {offers.map((offer) => {
            const isPending  = actionDonationId === offer.donation_id;
            const isUrgent   = offer.remaining_shelf_life_min < 60;
            const overCapacity = profile?.available_capacity_kg !== undefined
              && offer.quantity_kg > profile.available_capacity_kg;
            const capacityUsedPct = profile?.storage_capacity_kg
              ? ((profile.storage_capacity_kg - (profile.available_capacity_kg ?? 0)) / profile.storage_capacity_kg) * 100
              : 0;
            const offerPct = profile?.storage_capacity_kg
              ? (offer.quantity_kg / profile.storage_capacity_kg) * 100
              : 0;

            return (
              <div
                key={offer.donation_id}
                style={{
                  border: '1px solid var(--border-hair)',
                  borderLeft: `3px solid ${isUrgent ? 'var(--terracotta)' : 'var(--border-med)'}`,
                  background: isUrgent ? 'var(--terracotta-dim)' : 'var(--bg-panel)',
                  padding: '20px 24px',
                  position: 'relative',
                }}
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-4" style={{ marginBottom: '16px' }}>
                  <div>
                    <div className="flex items-center gap-3" style={{ marginBottom: '4px' }}>
                      <h3
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '1.375rem',
                          fontWeight: 300,
                          color: 'var(--text-primary)',
                          letterSpacing: '-0.02em',
                          fontVariationSettings: "'opsz' 22",
                        }}
                      >
                        {offer.food_name}
                      </h3>
                      {isUrgent && (
                        <span className="status-pill-error">
                          <span className="status-pill-dot dot-error" />
                          <AlertTriangle size={9} style={{ marginRight: '2px' }} /> Urgent
                        </span>
                      )}
                    </div>
                    <span
                      className="section-label"
                      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      {offer.donation_id.split('-')[0]}
                    </span>
                  </div>
                </div>

                {/* Meta row — inline, no boxes */}
                <div
                  className="flex flex-wrap gap-6"
                  style={{ marginBottom: '16px', fontSize: '0.8125rem' }}
                >
                  <div>
                    <span className="section-label" style={{ marginRight: '6px' }}>Mass</span>
                    <span className="font-mono-data" style={{ color: 'var(--text-primary)' }}>
                      <Weight size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      {offer.quantity_kg} kg
                    </span>
                  </div>
                  <div>
                    <span className="section-label" style={{ marginRight: '6px' }}>Category</span>
                    <span style={{ color: 'var(--text-primary)' }}>{offer.food_category.replace(/_/g, ' ')}</span>
                  </div>
                  {offer.eta_minutes !== null && (
                    <div>
                      <span className="section-label" style={{ marginRight: '6px' }}>ETA</span>
                      <span className="font-mono-data" style={{ color: 'var(--amber-dim)' }}>
                        <Clock size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                        {offer.eta_minutes} min
                      </span>
                    </div>
                  )}
                  {offer.match_score !== null && (
                    <div>
                      <span className="section-label" style={{ marginRight: '6px' }}>Match Score</span>
                      <span className="font-mono-data" style={{ color: 'var(--moss-light)' }}>
                        <Crosshair size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                        {(offer.match_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Bars */}
                <div
                  className="flex flex-col sm:flex-row gap-4"
                  style={{ marginBottom: '20px' }}
                >
                  <div style={{ flex: 1 }}>
                    <ShelfLifeBar minutes={offer.remaining_shelf_life_min} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="flex justify-between" style={{ marginBottom: '6px' }}>
                      <span className="section-label">Capacity Impact</span>
                      <span
                        className="font-mono-data section-label"
                        style={{ color: overCapacity ? 'var(--terracotta)' : 'var(--moss-light)' }}
                      >
                        {offer.quantity_kg} kg
                      </span>
                    </div>
                    {/* Stacked capacity bar */}
                    <div
                      style={{
                        height: '3px',
                        background: 'var(--border-hair)',
                        display: 'flex',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(capacityUsedPct, 100)}%`,
                          height: '100%',
                          background: 'var(--border-strong)',
                          opacity: 0.5,
                        }}
                      />
                      <div
                        style={{
                          width: `${Math.min(offerPct, 100 - capacityUsedPct)}%`,
                          height: '100%',
                          background: overCapacity ? 'var(--terracotta)' : 'var(--moss-light)',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions: full-width Accept + text Decline */}
                <div
                  className="flex items-center gap-4"
                  style={{ paddingTop: '16px', borderTop: '1px solid var(--border-hair)' }}
                >
                  <button
                    className="btn-primary flex items-center justify-center gap-2"
                    style={{ flex: 1, padding: '10px' }}
                    disabled={isPending}
                    onClick={() => {
                      setActionDonationId(offer.donation_id);
                      acceptMutation.mutate(offer);
                    }}
                  >
                    <CheckCircle size={15} /> Accept Offer
                  </button>
                  <button
                    onClick={() => {
                      setActionDonationId(offer.donation_id);
                      rejectMutation.mutate(offer.donation_id);
                    }}
                    disabled={isPending}
                    className="flex items-center gap-1.5 section-label hover:text-[var(--terracotta)] transition-colors"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: isPending ? 'not-allowed' : 'pointer',
                      color: 'var(--text-muted)',
                      padding: '10px 4px',
                    }}
                  >
                    <XCircle size={12} /> Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </NGOLayout>
  );
}
