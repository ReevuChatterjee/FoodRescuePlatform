/**
 * NGO Verification Queue — admin workflow for approving/rejecting NGO registrations.
 *
 * Per Section C: state machine PENDING → APPROVED/REJECTED.
 * Shows pending NGOs with their submitted verification documents.
 * Admin provides a reason (required) and chooses status.
 */

import { useState } from 'react';
import { CheckCircle, XCircle, FileText, AlertCircle } from 'lucide-react';
import { usePendingNGOs, useVerifyNGO } from '../../hooks/useAdmin';
import type { NGO } from '../../types/api';

export function NGOVerificationQueue() {
  const { data: pendingNGOs, isLoading } = usePendingNGOs();
  const verifyMutation = useVerifyNGO();

  const [selectedNGO, setSelectedNGO] = useState<NGO | null>(null);
  const [reason, setReason] = useState('');

  const handleVerify = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedNGO || !reason.trim()) {
      alert('Please provide a reason for your decision.');
      return;
    }

    try {
      await verifyMutation.mutateAsync({
        ngoId: selectedNGO.id,
        request: { status, reason: reason.trim() },
      });
      alert(`NGO ${status.toLowerCase()} successfully.`);
      setSelectedNGO(null);
      setReason('');
    } catch (error: any) {
      alert(`Failed to verify NGO: ${error.response?.data?.error?.message || error.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-sm text-zinc-500 font-mono tracking-wider uppercase">Loading pending queue...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">NGO Verification Queue</h1>
        <p className="text-sm text-zinc-500 mt-1">Review and process new organisation applications.</p>
      </div>

      {!pendingNGOs || pendingNGOs.length === 0 ? (
        <div className="bg-white p-8 rounded-md border border-zinc-200 text-center text-zinc-500 text-sm">
          No pending NGO verifications at this time.
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* NGO List */}
          <div className="lg:w-1/3 flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Pending ({pendingNGOs.length})</h2>
            {pendingNGOs.map((ngo) => (
              <button
                key={ngo.id}
                className={`text-left p-4 border rounded-md transition-colors ${
                  selectedNGO?.id === ngo.id
                    ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
                onClick={() => setSelectedNGO(ngo)}
              >
                <h3 className="font-semibold text-zinc-900 text-base">{ngo.organisation_name}</h3>
                <p className="text-xs text-zinc-500 mt-1 truncate">{ngo.address}</p>
                <div className="mt-3 flex gap-3 text-xs font-mono text-zinc-600 bg-white border border-zinc-200 p-2 rounded-sm inline-block">
                  <span>CAP: {ngo.storage_capacity_kg}kg</span>
                </div>
              </button>
            ))}
          </div>

          {/* Verification Panel */}
          <div className="lg:w-2/3">
            <div className="bg-white rounded-md border border-zinc-200 sticky top-6">
              {!selectedNGO ? (
                <div className="text-center text-zinc-400 py-24 text-sm">
                  <AlertCircle size={32} className="mx-auto mb-3 opacity-50" />
                  Select an application from the queue to review.
                </div>
              ) : (
                <div className="p-6">
                  <div className="border-b border-zinc-100 pb-4 mb-4">
                    <h2 className="text-xl font-bold text-zinc-900 tracking-tight">{selectedNGO.organisation_name}</h2>
                    <p className="text-xs text-zinc-500 font-mono mt-1">ID: {selectedNGO.id}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <DetailRow label="Address" value={selectedNGO.address} />
                    <DetailRow label="Registered" value={new Date(selectedNGO.created_at).toLocaleString()} />
                    <DetailRow label="Storage Capacity" value={`${selectedNGO.storage_capacity_kg} kg`} />
                    <DetailRow label="Available Capacity" value={`${selectedNGO.available_capacity_kg} kg`} />
                  </div>

                  {/* Verification Documents Section */}
                  <div className="mb-6 p-4 bg-zinc-50 border border-zinc-200 rounded-md">
                    <h3 className="text-sm font-semibold text-zinc-900 mb-2 flex items-center gap-2">
                      <FileText size={16} className="text-zinc-500" />
                      Verification Documents
                    </h3>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      Check documents via the internal NGO module or external links. Document attachments are pending backend integration.
                    </p>
                  </div>

                  {/* Decision Form */}
                  <div className="space-y-4 pt-4 border-t border-zinc-100">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-2">
                        Decision Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        className="w-full text-sm border border-zinc-300 rounded-md p-3 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                        rows={3}
                        placeholder="E.g., Registration certificate verified..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        className="flex-1 bg-emerald-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleVerify('APPROVED')}
                        disabled={!reason.trim() || verifyMutation.isPending}
                      >
                        <CheckCircle size={18} />
                        Approve
                      </button>
                      <button
                        className="flex-1 bg-red-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleVerify('REJECTED')}
                        disabled={!reason.trim() || verifyMutation.isPending}
                      >
                        <XCircle size={18} />
                        Reject
                      </button>
                    </div>

                    {verifyMutation.isPending && (
                      <p className="text-center text-xs font-mono text-zinc-500">Processing transaction...</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">{label}</span>
      <span className="text-sm text-zinc-900">{value}</span>
    </div>
  );
}
