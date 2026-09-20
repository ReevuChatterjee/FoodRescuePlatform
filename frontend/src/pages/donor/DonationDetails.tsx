import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { apiClient } from '../../api/client';
import type { Donation, SuccessEnvelope } from '../../types/api';
import { useDonationWebSocket } from '../../hooks/useDonationWebSocket';
import { DonorLayout } from '../../components/layout/DonorLayout';

// Semantic status mapping
function getStatusIndicator(status: string) {
  switch (status) {
    case 'DELIVERED':
      return { color: 'bg-primary', label: 'Delivered' };
    case 'EXPIRED':
    case 'CANCELLED':
    case 'NO_MATCH_FOUND':
    case 'REJECTED':
    case 'DRIVER_ISSUE':
      return { color: 'bg-error', label: status.replace(/_/g, ' ').charAt(0) + status.replace(/_/g, ' ').slice(1).toLowerCase() };
    case 'AVAILABLE':
    case 'MATCHING':
    case 'MATCHED':
    case 'ACCEPTED':
    case 'DRIVER_ASSIGNED':
    case 'PICKUP_STARTED':
    case 'PICKED_UP':
    case 'IN_TRANSIT':
      return { color: 'bg-warning', label: 'Active' };
    default:
      return { color: 'bg-outline-variant', label: status };
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  RAW_PRODUCE: 'Raw produce',
  COOKED:      'Cooked food',
  PACKAGED:    'Packaged',
  BAKED_GOODS: 'Baked goods',
  DAIRY:       'Dairy',
  MIXED:       'Mixed',
};

const STATUS_TIMELINE = [
  { status: 'AVAILABLE',       label: 'Payload listed' },
  { status: 'MATCHING',        label: 'Routing / matching' },
  { status: 'MATCHED',         label: 'Node matched' },
  { status: 'ACCEPTED',        label: 'Node accepted' },
  { status: 'DRIVER_ASSIGNED', label: 'Logistics assigned' },
  { status: 'PICKUP_STARTED',  label: 'En route to pickup' },
  { status: 'PICKED_UP',       label: 'Payload collected' },
  { status: 'IN_TRANSIT',      label: 'In transit' },
  { status: 'DELIVERED',       label: 'Handoff verified' },
];

const CANCELLABLE = ['AVAILABLE', 'MATCHING', 'MATCHED', 'ACCEPTED', 'DRIVER_ASSIGNED', 'PICKUP_STARTED'];

export function DonationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelReason, setCancelReason] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useDonationWebSocket();

  const { data, isLoading, error } = useQuery({
    queryKey: ['donation', id],
    queryFn: async () => {
      const res = await apiClient.get<SuccessEnvelope<Donation>>(`/api/v1/donations/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch(`/api/v1/donations/${id}/cancel`, { reason: cancelReason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation', id] });
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      setCancelReason('');
      setShowCancelConfirm(false);
    },
  });

  const photoMutation = useMutation({
    mutationFn: async () => {
      if (!photo) return;
      const formData = new FormData();
      formData.append('file', photo);
      const res = await apiClient.post(`/api/v1/donations/${id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      setPhoto(null);
    },
  });

  if (isLoading) {
    return (
      <DonorLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-surface-container-lowest border border-outline-variant/30 rounded w-1/3" />
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-8">
            <div className="space-y-6">
              <div className="h-40 bg-surface-container-lowest border border-outline-variant/30 rounded" />
              <div className="h-40 bg-surface-container-lowest border border-outline-variant/30 rounded" />
            </div>
            <div className="h-80 bg-surface-container-lowest border border-outline-variant/30 rounded" />
          </div>
        </div>
      </DonorLayout>
    );
  }

  if (error || !data) {
    return (
      <DonorLayout>
        <div className="pt-12">
          <p className="text-[1.25rem] font-medium text-error mb-2">Record unavailable</p>
          <p className="text-[0.9375rem] text-on-surface-variant">Failed to retrieve operational data for this donation.</p>
        </div>
      </DonorLayout>
    );
  }

  const donation = data;
  const isCancellable = CANCELLABLE.includes(donation.status);
  const currentIdx = STATUS_TIMELINE.findIndex((s) => s.status === donation.status);
  const isTerminalBad = ['NO_MATCH_FOUND', 'REJECTED', 'EXPIRED', 'CANCELLED', 'DRIVER_ISSUE'].includes(donation.status);
  const indicator = getStatusIndicator(donation.status);

  return (
    <DonorLayout>
      <div className="mb-8">
        <button className="inline-flex items-center gap-2 text-[0.875rem] font-medium text-on-surface-variant hover:text-on-surface mb-6 transition-colors" onClick={() => navigate('/donor')}>
          <ArrowLeft size={16} /> Back to donations
        </button>
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant/30 pb-6">
          <div>
            <h1 className="text-[1.75rem] font-semibold text-on-surface tracking-tight mb-1">{donation.food_name}</h1>
            <p className="text-[0.8125rem] font-mono-data text-on-surface-variant">PID: {donation.id}</p>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[0.8125rem] font-medium text-on-surface-variant uppercase tracking-widest">Status:</span>
             <span className={`w-2 h-2 rounded-full ${indicator.color}`} />
             <span className="text-[0.9375rem] font-semibold text-on-surface">{indicator.label}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-12 items-start">
        {/* ── Main Content Column ── */}
        <div className="space-y-12">
          
          {/* Payload */}
          <section>
            <h2 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-widest mb-4 pb-2 border-b border-outline-variant/30">Payload</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div>
                <p className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Classification</p>
                <p className="text-[0.875rem] text-on-surface">{CATEGORY_LABELS[donation.food_category] ?? donation.food_category}</p>
              </div>
              <div>
                <p className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Quantity</p>
                <p className="text-[0.875rem] text-on-surface">{donation.quantity_kg} kg</p>
              </div>
              <div>
                <p className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Use by</p>
                <p className="text-[0.875rem] text-on-surface font-mono-data">{format(new Date(donation.expiry_time), 'MMM d, HH:mm')}</p>
              </div>
              <div>
                <p className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Listed</p>
                <p className="text-[0.875rem] text-on-surface font-mono-data">{format(new Date(donation.created_at), 'MMM d, HH:mm')}</p>
              </div>
            </div>
          </section>

          {/* Matching Analysis */}
          {(donation.matched_ngo_id || donation.match_breakdown) && (
            <section>
              <h2 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-widest mb-4 pb-2 border-b border-outline-variant/30">Matching analysis</h2>
              
              {donation.matched_ngo_id && (
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Destination</p>
                    <p className="text-[0.875rem] text-on-surface font-mono-data">{donation.matched_ngo_id}</p>
                  </div>
                  {donation.driver_id && (
                    <div>
                      <p className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Assigned logistics</p>
                      <p className="text-[0.875rem] text-on-surface font-mono-data">{donation.driver_id}</p>
                    </div>
                  )}
                </div>
              )}

              {donation.match_breakdown && (
                <div>
                  <p className="text-[0.8125rem] text-on-surface-variant mb-6">
                    Match score is calculated from capacity, shelf life, transit efficiency, demand urgency and route distance.
                  </p>
                  
                  <div className="mb-6">
                    <p className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Overall match score</p>
                    <p className="text-[2rem] font-semibold text-primary">{(donation.match_score! * 100).toFixed(1)}%</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                    <div>
                      <p className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Capacity fit</p>
                      <p className="text-[0.875rem] text-on-surface font-mono-data">{(donation.match_breakdown.capacity_score * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Shelf-life fit</p>
                      <p className="text-[0.875rem] text-on-surface font-mono-data">{(donation.match_breakdown.shelf_life_score * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Transit efficiency</p>
                      <p className="text-[0.875rem] text-on-surface font-mono-data">{(donation.match_breakdown.transit_score * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Demand urgency</p>
                      <p className="text-[0.875rem] text-on-surface font-mono-data">{(donation.match_breakdown.demand_score * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Route distance</p>
                      <p className="text-[0.875rem] text-on-surface font-mono-data">{(donation.match_breakdown.route_score * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Origin */}
          <section>
            <h2 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-widest mb-4 pb-2 border-b border-outline-variant/30">Origin</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Address</p>
                <p className="text-[0.875rem] text-on-surface leading-relaxed">{(donation.pickup_location as any)?.address || 'Location not specified'}</p>
              </div>
              <div>
                <p className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Coordinates</p>
                <p className="text-[0.875rem] text-on-surface font-mono-data">
                  {(donation.pickup_location as any)?.latitude 
                    ? `${(donation.pickup_location as any).latitude.toFixed(4)}, ${(donation.pickup_location as any).longitude.toFixed(4)}`
                    : '—'}
                </p>
              </div>
            </div>
          </section>

          {/* Verification */}
          <section>
            <h2 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-widest mb-4 pb-2 border-b border-outline-variant/30">Verification imagery</h2>
            <p className="text-[0.8125rem] text-on-surface-variant mb-4">Required for delivery and audit verification.</p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <label className="w-full sm:w-auto">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
                <div className="h-10 px-4 flex items-center justify-center bg-surface-container-lowest border border-outline-variant rounded text-[0.875rem] font-medium text-on-surface hover:bg-surface-container cursor-pointer transition-colors">
                  {photo ? photo.name : 'Select file'}
                </div>
              </label>
              <button
                onClick={() => photoMutation.mutate()}
                disabled={!photo || photoMutation.isPending}
                className="h-10 px-6 bg-surface-container border border-outline-variant text-on-surface text-[0.875rem] font-medium rounded hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {photoMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Upload'}
              </button>
            </div>
            {photoMutation.isSuccess && (
              <p className="text-[0.8125rem] font-medium text-success mt-2">File successfully uploaded.</p>
            )}
          </section>

          {/* Cancel */}
          {isCancellable && (
            <section className="pt-6">
              <h2 className="text-[0.875rem] font-semibold text-error uppercase tracking-widest mb-4 pb-2 border-b border-error/20">Danger zone</h2>
              
              {!showCancelConfirm ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <p className="text-[0.875rem] text-on-surface-variant max-w-lg">
                    Aborting this donation removes it from the routing network and notifies any matched logistics participants.
                  </p>
                  <button className="h-10 px-6 bg-transparent border border-error text-error text-[0.875rem] font-medium rounded hover:bg-error hover:text-white transition-colors flex-shrink-0" onClick={() => setShowCancelConfirm(true)}>
                    Abort donation
                  </button>
                </div>
              ) : (
                <div className="max-w-lg">
                  <label className="text-[0.8125rem] font-semibold text-on-surface mb-1.5 block">Reason for abort</label>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g. Food spoiled, accidental listing"
                    className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded text-[0.875rem] text-on-surface mb-4 focus:border-error focus:ring-1 focus:ring-error outline-none transition-shadow"
                  />
                  <div className="flex gap-3">
                    <button className="flex-1 h-10 px-4 bg-surface-container text-on-surface-variant rounded text-[0.875rem] font-medium hover:bg-surface-container-high hover:text-on-surface transition-colors" onClick={() => { setShowCancelConfirm(false); setCancelReason(''); }}>
                      Cancel
                    </button>
                    <button className="flex-1 h-10 px-4 bg-error text-white rounded text-[0.875rem] font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2" disabled={!cancelReason || cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate()}>
                      {cancelMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Confirm abort'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

        </div>

        {/* ── Sidebar Telemetry ── */}
        <div>
          <h2 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-widest mb-6 pb-2 border-b border-outline-variant/30">Telemetry</h2>
          <div className="flex flex-col">
            {STATUS_TIMELINE.map((step, i) => {
              const done = currentIdx > i;
              const active = currentIdx === i;
              const showLine = i < STATUS_TIMELINE.length - 1;
              
              return (
                <div key={step.status} className="flex items-start gap-4">
                  <div className="flex flex-col items-center mt-1">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${done ? 'bg-primary' : active ? 'border-2 border-primary' : 'border-2 border-outline-variant/50'}`} />
                    {showLine && (
                      <div className={`w-px min-h-[32px] my-1 ${done ? 'bg-primary/30' : 'bg-outline-variant/30'}`} />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className={`text-[0.875rem] ${done || active ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}>
                      {step.label}
                    </p>
                  </div>
                </div>
              );
            })}

            {isTerminalBad && (
              <div className="flex items-start gap-4 mt-2">
                <div className="flex flex-col items-center mt-1">
                  <div className="w-3 h-3 rounded-full flex-shrink-0 bg-error" />
                </div>
                <div>
                  <p className="text-[0.875rem] font-semibold text-error">{donation.status.replace(/_/g, ' ')}</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </DonorLayout>
  );
}
