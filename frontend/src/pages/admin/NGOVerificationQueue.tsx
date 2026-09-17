/**
 * NGOVerificationQueue — admin workspace for approving/rejecting NGO registrations.
 * AI-tells removed:
 *   - Empty state with centered icon-in-circle → terse single-line status bar
 *   - NGO list items with icon-in-box → compact hairline table rows
 *   - Detail panel generic equal-column grid → surface-float (one shadow on page)
 * Uses AdminLayout.
 */

import { useState } from 'react';
import { CheckCircle, XCircle, Calendar, Weight, AlertTriangle } from 'lucide-react';
import { usePendingNGOs, useVerifyNGO } from '../../hooks/useAdmin';
import { AdminLayout } from '../../components/layout/AdminLayout';
import type { NGO } from '../../types/api';

function NGORow({ ngo, selected, onClick }: { ngo: NGO; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '11px 16px',
        width: '100%',
        textAlign: 'left',
        borderBottom: '1px solid var(--border-hair)',
        background: selected ? 'var(--bg-hover)' : 'transparent',
        borderLeft: selected ? '2px solid var(--amber-dim)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      className="hover:bg-hover"
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
            marginBottom: '3px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {ngo.organisation_name}
        </p>
        <div
          className="flex items-center gap-3"
          style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}
        >
          <span className="flex items-center gap-1">
            <Weight size={10} /> {ngo.storage_capacity_kg} kg
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={10} /> {new Date(ngo.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
      <span className="status-pill-warning">
        <span className="status-pill-dot dot-amber" />
        Pending
      </span>
    </button>
  );
}

export function NGOVerificationQueue() {
  const { data: pendingNGOs, isLoading } = usePendingNGOs();
  const verifyMutation = useVerifyNGO();

  const [selectedNGO, setSelectedNGO] = useState<NGO | null>(null);
  const [reason, setReason]           = useState('');
  const [toast, setToast]             = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleVerify = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedNGO || !reason.trim()) {
      showToast('An audit reason is required before proceeding.', 'error');
      return;
    }
    try {
      await verifyMutation.mutateAsync({ ngoId: selectedNGO.id, request: { status, reason: reason.trim() } });
      showToast(`NGO ${status === 'APPROVED' ? 'approved' : 'rejected'}.`, 'success');
      setSelectedNGO(null);
      setReason('');
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || 'Verification failed.', 'error');
    }
  };

  return (
    <AdminLayout>
      {/* Toast */}
      {toast && (
        <div className={toast.type === 'success' ? 'toast-success' : 'toast-error'}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Verification Workspace</h1>
          <p className="page-subtitle">Review pending NGO registrations for network entry.</p>
        </div>
        {pendingNGOs && pendingNGOs.length > 0 && (
          <span className="status-pill-warning">
            <span className="status-pill-dot dot-amber" />
            {pendingNGOs.length} pending
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: '56px', width: '100%' }} />
          ))}
        </div>
      )}

      {/* Empty state — terse, not centered icon-in-circle */}
      {!isLoading && (!pendingNGOs || pendingNGOs.length === 0) && (
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderLeft: '3px solid var(--success)',
            background: 'rgba(90,122,93,0.06)',
          }}
        >
          <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Queue clear — no pending verifications require action.
          </p>
        </div>
      )}

      {/* Main workspace */}
      {!isLoading && pendingNGOs && pendingNGOs.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '5fr 7fr',
            gap: '20px',
            height: 'calc(100vh - 14rem)',
            minHeight: '600px',
          }}
          className="grid-cols-1 lg:!grid-cols-[5fr_7fr]"
        >
          {/* NGO queue list */}
          <div
            className="surface-dense"
            style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {/* List header */}
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--border-hair)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span className="section-label">Pending Nodes</span>
              <span className="section-label" style={{ color: 'var(--text-muted)' }}>{pendingNGOs.length} total</span>
            </div>
            {/* Scrollable list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {pendingNGOs.map((ngo) => (
                <NGORow
                  key={ngo.id}
                  ngo={ngo}
                  selected={selectedNGO?.id === ngo.id}
                  onClick={() => { setSelectedNGO(ngo); setReason(''); }}
                />
              ))}
            </div>
          </div>

          {/* Detail panel — surface-float (the ONE shadow element on page) */}
          <div
            className="surface-float"
            style={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: '2px',
            }}
          >
            {!selectedNGO ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  padding: '32px',
                }}
              >
                <p className="section-label" style={{ marginBottom: '8px' }}>Workspace</p>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.5rem',
                    fontWeight: 300,
                    color: 'var(--text-secondary)',
                    letterSpacing: '-0.02em',
                    fontVariationSettings: "'opsz' 24",
                    maxWidth: '22ch',
                  }}
                >
                  Select a pending node to begin the verification audit.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

                {/* Detail header */}
                <div
                  style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border-hair)',
                    background: 'var(--bg-inset)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="section-label" style={{ marginBottom: '6px' }}>Organisation</p>
                      <h2
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '1.375rem',
                          fontWeight: 300,
                          color: 'var(--text-primary)',
                          letterSpacing: '-0.02em',
                          fontVariationSettings: "'opsz' 22",
                        }}
                      >
                        {selectedNGO.organisation_name}
                      </h2>
                      <p
                        className="font-mono-data"
                        style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '4px' }}
                      >
                        {selectedNGO.id}
                      </p>
                    </div>
                    <span className="status-pill-warning" style={{ flexShrink: 0 }}>
                      <span className="status-pill-dot dot-amber" />
                      Action Required
                    </span>
                  </div>
                </div>

                {/* Scrollable content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                  {/* Data fields — compact hairline table, not equal-col card grid */}
                  <p className="section-label" style={{ marginBottom: '12px' }}>Node Details</p>
                  <div className="surface-dense" style={{ marginBottom: '24px', overflow: 'hidden' }}>
                    {[
                      { label: 'Location', value: selectedNGO.address },
                      { label: 'Applied', value: new Date(selectedNGO.created_at).toLocaleString() },
                      { label: 'Storage Capacity', value: `${selectedNGO.storage_capacity_kg} kg` },
                      { label: 'Available Capacity', value: `${selectedNGO.available_capacity_kg} kg` },
                    ].map((d, i, arr) => (
                      <div
                        key={d.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          padding: '10px 16px',
                          borderBottom: i < arr.length - 1 ? '1px solid var(--border-hair)' : 'none',
                          gap: '16px',
                        }}
                      >
                        <span className="section-label">{d.label}</span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', textAlign: 'right' }}>
                          {d.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Audit log textarea */}
                  <div className="flex items-center gap-2" style={{ marginBottom: '10px' }}>
                    <p className="section-label">Audit Note</p>
                    <AlertTriangle size={11} style={{ color: 'var(--amber-dim)' }} />
                    <span className="section-label" style={{ color: 'var(--amber-dim)' }}>Required</span>
                  </div>
                  <div
                    className="surface-inset"
                    style={{ overflow: 'hidden', transition: 'border-color 0.15s' }}
                  >
                    <textarea
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: '0.875rem',
                        color: 'var(--text-primary)',
                        padding: '12px 14px',
                        resize: 'none',
                        minHeight: '100px',
                        fontFamily: 'var(--font-ui)',
                        lineHeight: 1.6,
                      }}
                      placeholder="Verification notes (e.g., 'Facility inspection passed', 'Documents incomplete')..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 14px 8px',
                        borderTop: '1px solid var(--border-hair)',
                      }}
                    >
                      <span className="section-label" style={{ color: 'var(--text-muted)' }}>
                        {reason.length} chars
                      </span>
                      <span className="section-label" style={{ color: 'var(--text-muted)' }}>
                        Visible to node
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action footer */}
                <div
                  style={{
                    padding: '16px 24px',
                    borderTop: '1px solid var(--border-hair)',
                    background: 'var(--bg-inset)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '10px',
                  }}
                >
                  {verifyMutation.isPending ? (
                    <span className="section-label" style={{ color: 'var(--text-muted)' }}>
                      Processing…
                    </span>
                  ) : (
                    <>
                      <button
                        className="btn-danger"
                        onClick={() => handleVerify('REJECTED')}
                        disabled={!reason.trim()}
                        style={{ padding: '8px 20px' }}
                      >
                        <XCircle size={14} /> Reject
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => handleVerify('APPROVED')}
                        disabled={!reason.trim()}
                        style={{ padding: '8px 24px' }}
                      >
                        <CheckCircle size={14} /> Approve
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
