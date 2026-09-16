/**
 * NGOVerificationQueue — admin workflow for approving/rejecting NGO registrations.
 * PENDING → APPROVED/REJECTED state machine per Section C.
 */

import { useState } from 'react';
import { CheckCircle, XCircle, Building2, Calendar, Weight, Info } from 'lucide-react';
import { usePendingNGOs, useVerifyNGO } from '../../hooks/useAdmin';
import { AppLayout } from '../../components/layout/AppLayout';
import type { NGO } from '../../types/api';

function NGOCard({ ngo, selected, onClick }: { ngo: NGO; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-sm cursor-pointer transition-colors border ${
        selected ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-zinc-900 text-zinc-400 flex items-center justify-center flex-shrink-0">
            <Building2 size={16} />
          </div>
          <div>
            <p className="font-semibold text-sm text-zinc-100">
              {ngo.organisation_name}
            </p>
            <p className="text-xs mt-0.5 text-zinc-500">{ngo.address}</p>
          </div>
        </div>
        <span className="badge-yellow flex-shrink-0">Pending</span>
      </div>
      <div className="flex gap-4 mt-4 text-xs text-zinc-500 font-medium">
        <span className="flex items-center gap-1.5"><Weight size={14} className="text-zinc-600" /> {ngo.storage_capacity_kg} kg</span>
        <span className="flex items-center gap-1.5"><Calendar size={14} className="text-zinc-600" /> {new Date(ngo.created_at).toLocaleDateString()}</span>
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
      showToast('Please provide a reason before deciding.', 'error');
      return;
    }
    try {
      await verifyMutation.mutateAsync({ ngoId: selectedNGO.id, request: { status, reason: reason.trim() } });
      showToast(`NGO ${status === 'APPROVED' ? 'approved' : 'rejected'} successfully.`, 'success');
      setSelectedNGO(null);
      setReason('');
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || 'Action failed.', 'error');
    }
  };

  return (
    <AppLayout>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-sm text-sm font-medium shadow-lg border ${
          toast.type === 'success' ? 'bg-emerald-950 border-emerald-900 text-emerald-400' : 'bg-red-950 border-red-900 text-red-400'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="page-header flex justify-between items-start">
        <div>
          <h1 className="page-title">NGO Verification Queue</h1>
          <p className="page-subtitle">Review and approve NGO registration applications</p>
        </div>
        {pendingNGOs && pendingNGOs.length > 0 && (
          <span className="badge-yellow">
            {pendingNGOs.length} pending
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 w-full" />)}
        </div>
      ) : !pendingNGOs || pendingNGOs.length === 0 ? (
        <div className="panel p-16 text-center flex flex-col items-center">
          <CheckCircle size={32} className="mb-4 text-emerald-500" />
          <h3 className="text-base font-semibold text-zinc-100 mb-1">Queue Empty</h3>
          <p className="text-sm text-zinc-400">No pending NGO verifications.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* NGO list — 2 cols */}
          <div className="lg:col-span-2 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-4">
              {pendingNGOs.length} application{pendingNGOs.length !== 1 ? 's' : ''} pending review
            </p>
            {pendingNGOs.map((ngo) => (
              <NGOCard
                key={ngo.id}
                ngo={ngo}
                selected={selectedNGO?.id === ngo.id}
                onClick={() => { setSelectedNGO(ngo); setReason(''); }}
              />
            ))}
          </div>

          {/* Detail / decision panel — 3 cols */}
          <div className="lg:col-span-3">
            <div className="panel p-6 sticky top-6">
              {!selectedNGO ? (
                <div className="py-16 text-center flex flex-col items-center">
                  <Info size={32} className="mb-4 text-zinc-600" />
                  <p className="text-sm text-zinc-400">Select an NGO from the list to review their application</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-800">
                    <div className="w-10 h-10 rounded-sm bg-zinc-800 text-zinc-400 flex items-center justify-center">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-100">
                        {selectedNGO.organisation_name}
                      </h2>
                      <p className="text-xs text-zinc-500 font-mono mt-0.5">{selectedNGO.ngo_id}</p>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {[
                      { label: 'Address', value: selectedNGO.address },
                      { label: 'Storage Capacity', value: `${selectedNGO.storage_capacity_kg} kg` },
                      { label: 'Available Capacity', value: `${selectedNGO.available_capacity_kg} kg` },
                      { label: 'Applied On', value: new Date(selectedNGO.created_at).toLocaleString() },
                    ].map((d) => (
                      <div key={d.label} className="bg-zinc-950 border border-zinc-800 rounded-sm p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1">{d.label}</p>
                        <p className="text-sm font-semibold text-zinc-100">{d.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Reason */}
                  <div className="mb-6">
                    <label className="form-label">
                      Decision reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="input-base resize-none"
                      rows={4}
                      placeholder="E.g., 'FSSAI registration verified. Storage facility confirmed at site visit.'"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <p className="text-xs mt-2 text-zinc-500">
                      This reason will be recorded in the audit log and visible to the NGO.
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      className="btn-primary flex-1 py-2.5"
                      onClick={() => handleVerify('APPROVED')}
                      disabled={!reason.trim() || verifyMutation.isPending}
                    >
                      <CheckCircle size={16} /> Approve NGO
                    </button>
                    <button
                      className="px-4 py-2.5 rounded-sm text-sm font-semibold flex items-center justify-center gap-2 border border-red-900 bg-red-950 text-red-400 hover:bg-red-900 transition-colors flex-1"
                      onClick={() => handleVerify('REJECTED')}
                      disabled={!reason.trim() || verifyMutation.isPending}
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>

                  {verifyMutation.isPending && (
                    <p className="text-center text-xs mt-4 text-emerald-500 font-medium">
                      Processing verification…
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
