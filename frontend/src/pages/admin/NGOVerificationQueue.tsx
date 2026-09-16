/**
 * NGOVerificationQueue — admin workflow for approving/rejecting NGO registrations.
 * PENDING → APPROVED/REJECTED state machine per Section C.
 */

import { useState } from 'react';
import { CheckCircle, XCircle, Building2, Calendar, Weight, Info, AlertTriangle } from 'lucide-react';
import { usePendingNGOs, useVerifyNGO } from '../../hooks/useAdmin';
import { AppLayout } from '../../components/layout/AppLayout';
import type { NGO } from '../../types/api';

function NGOCard({ ngo, selected, onClick }: { ngo: NGO; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-md cursor-pointer transition-all border ${
        selected ? 'bg-[var(--bg-panel-hover)] border-[var(--brand)] shadow-sm' : 'bg-[var(--bg-panel)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 transition-colors ${selected ? 'bg-[var(--brand)]/10 text-[var(--brand)]' : 'bg-[var(--bg-page)] text-[var(--text-muted)] border border-[var(--border-subtle)]'}`}>
            <Building2 size={16} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm tracking-tight text-[var(--text-primary)] truncate">
              {ngo.organisation_name}
            </p>
            <p className="text-xs text-[var(--text-muted)] font-mono-data truncate">ID: {ngo.id.substring(0,8)}</p>
          </div>
        </div>
        <span className="badge-orange flex-shrink-0 shadow-sm">Pending</span>
      </div>
      <div className="flex gap-4 mt-4 text-xs text-[var(--text-secondary)] font-medium bg-[var(--bg-page)] p-2 rounded-sm border border-[var(--border-subtle)]">
        <span className="flex items-center gap-1.5"><Weight size={14} className="text-[var(--text-muted)]" /> {ngo.storage_capacity_kg} kg</span>
        <span className="flex items-center gap-1.5"><Calendar size={14} className="text-[var(--text-muted)]" /> {new Date(ngo.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

export function NGOVerificationQueue() {
  const { data: pendingNGOs, isLoading } = usePendingNGOs();
  const verifyMutation = useVerifyNGO();

  const [selectedNGO, setSelectedNGO] = useState<NGO | null>(null);
  const [reason, setReason] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleVerify = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedNGO || !reason.trim()) {
      showToast('System requires an audit reason before proceeding.', 'error');
      return;
    }
    try {
      await verifyMutation.mutateAsync({ ngoId: selectedNGO.id, request: { status, reason: reason.trim() } });
      showToast(`Node ${status === 'APPROVED' ? 'verified' : 'rejected'} and network updated.`, 'success');
      setSelectedNGO(null);
      setReason('');
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || 'Verification transaction failed.', 'error');
    }
  };

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
          <h1 className="page-title">Verification Workspace</h1>
          <p className="page-subtitle">Review pending node registrations for network entry.</p>
        </div>
        {pendingNGOs && pendingNGOs.length > 0 && (
          <span className="badge-orange px-3 py-1 text-sm font-mono-data">
            {pendingNGOs.length} PENDING
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 w-full rounded-md" />)}
        </div>
      ) : !pendingNGOs || pendingNGOs.length === 0 ? (
        <div className="panel p-16 text-center flex flex-col items-center border-[var(--border-subtle)]">
          <div className="w-16 h-16 rounded-full bg-[var(--success)]/10 flex items-center justify-center mb-4">
             <CheckCircle size={32} className="text-[var(--success)]" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">Queue Clear</h3>
          <p className="text-sm text-[var(--text-secondary)]">No pending verifications require operator action.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)] min-h-[600px]">
          {/* NGO list — 4 cols */}
          <div className="lg:col-span-4 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-4 px-1">
               <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                 Pending Nodes
               </p>
               <span className="text-xs font-mono-data text-[var(--text-muted)]">{pendingNGOs.length} total</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
              {pendingNGOs.map((ngo) => (
                <NGOCard
                  key={ngo.id}
                  ngo={ngo}
                  selected={selectedNGO?.id === ngo.id}
                  onClick={() => { setSelectedNGO(ngo); setReason(''); }}
                />
              ))}
            </div>
          </div>

          {/* Detail / decision panel — 8 cols */}
          <div className="lg:col-span-8 flex flex-col h-full">
            <div className="panel flex-1 flex flex-col overflow-hidden border-[var(--border-strong)] bg-[var(--bg-page)] relative">
              {!selectedNGO ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-16">
                  <div className="w-16 h-16 rounded-full bg-[var(--bg-panel)] flex items-center justify-center mb-6 border border-[var(--border-subtle)]">
                     <Info size={24} className="text-[var(--text-muted)]" />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">Workspace Idle</h3>
                  <p className="text-sm text-[var(--text-secondary)] max-w-sm">Select a pending node from the queue to initiate the verification audit.</p>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* Workspace Header */}
                  <div className="flex items-center gap-4 p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
                    <div className="w-12 h-12 rounded-sm bg-[var(--bg-page)] border border-[var(--border-strong)] text-[var(--text-primary)] flex items-center justify-center">
                      <Building2 size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                         <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                           {selectedNGO.organisation_name}
                         </h2>
                         <span className="badge-orange">Action Required</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] font-mono-data mt-1">NODE_ID: {selectedNGO.ngo_id}</p>
                    </div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto p-6">
                     <div className="mb-8">
                       <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-4">Node Telemetry</h3>
                       {/* Details grid */}
                       <div className="grid grid-cols-2 gap-4">
                         {[
                           { label: 'Facility Location', value: selectedNGO.address },
                           { label: 'Application Timestamp', value: new Date(selectedNGO.created_at).toLocaleString() },
                           { label: 'Stated Storage Capacity', value: <span className="font-mono-data">{selectedNGO.storage_capacity_kg} kg</span> },
                           { label: 'Current Available Capacity', value: <span className="font-mono-data">{selectedNGO.available_capacity_kg} kg</span> },
                         ].map((d) => (
                           <div key={d.label} className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-md p-4">
                             <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">{d.label}</p>
                             <p className="text-sm font-medium text-[var(--text-primary)]">{d.value}</p>
                           </div>
                         ))}
                       </div>
                     </div>
                     
                     <div className="mb-2">
                       <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">Audit Log</h3>
                          <AlertTriangle size={14} className="text-[var(--warning)]" />
                       </div>
                       <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-md p-1 focus-within:border-[var(--brand)] transition-colors shadow-inner">
                         <textarea
                           className="w-full bg-transparent border-0 focus:ring-0 text-sm text-[var(--text-primary)] p-3 resize-none min-h-[120px]"
                           placeholder="Enter verification notes (e.g., 'Facility inspection passed', 'Documents incomplete')..."
                           value={reason}
                           onChange={(e) => setReason(e.target.value)}
                         />
                         <div className="flex justify-between items-center px-3 pb-2 pt-1 border-t border-[var(--border-subtle)]/50">
                            <span className="text-xs font-mono-data text-[var(--text-muted)]">{reason.length} CHARS</span>
                            <span className="text-xs text-[var(--text-muted)]">Visible to node</span>
                         </div>
                       </div>
                     </div>
                  </div>

                  {/* Action Footer */}
                  <div className="p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] flex items-center justify-between gap-4">
                    {verifyMutation.isPending ? (
                      <div className="flex-1 text-center text-sm font-mono-data text-[var(--brand)] animate-pulse">
                        EXECUTING TRANSACTION...
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-[var(--text-secondary)] hidden sm:block">
                           Confirm decision to update network state.
                        </p>
                        <div className="flex gap-3 flex-1 sm:flex-none">
                          <button
                            className="px-6 py-2.5 rounded-sm text-sm font-semibold tracking-wide flex items-center justify-center gap-2 bg-[var(--bg-page)] border border-[var(--error)] text-[var(--error)] hover:bg-[var(--error)] hover:text-black transition-colors"
                            onClick={() => handleVerify('REJECTED')}
                            disabled={!reason.trim()}
                          >
                            <XCircle size={16} /> Deny Entry
                          </button>
                          <button
                            className="btn-primary px-8 py-2.5"
                            onClick={() => handleVerify('APPROVED')}
                            disabled={!reason.trim()}
                          >
                            <CheckCircle size={16} /> Verify Node
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

