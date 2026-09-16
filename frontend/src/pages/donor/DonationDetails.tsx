/**
 * DonationDetails — detailed view with status timeline, map, photo upload, cancel.
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Clock, Package, Truck, CheckCircle, XCircle, Upload, AlertTriangle, Crosshair } from 'lucide-react';
import { format } from 'date-fns';
import { apiClient } from '../../api/client';
import type { Donation, SuccessEnvelope } from '../../types/api';
import { StatusBadge } from '../../components/donor/StatusBadge';
import { useDonationWebSocket } from '../../hooks/useDonationWebSocket';
import { AppLayout } from '../../components/layout/AppLayout';

// Status timeline order
const STATUS_TIMELINE = [
  { status: 'AVAILABLE',       icon: <Package size={14} />,     label: 'Payload Listed' },
  { status: 'MATCHING',        icon: <Crosshair size={14} />,   label: 'Routing / Matching' },
  { status: 'MATCHED',         icon: <CheckCircle size={14} />, label: 'Node Matched' },
  { status: 'ACCEPTED',        icon: <CheckCircle size={14} />, label: 'Node Accepted' },
  { status: 'DRIVER_ASSIGNED', icon: <Truck size={14} />,       label: 'Logistics Assigned' },
  { status: 'PICKUP_STARTED',  icon: <Truck size={14} />,       label: 'En Route to Pickup' },
  { status: 'PICKED_UP',       icon: <Truck size={14} />,       label: 'Payload Collected' },
  { status: 'IN_TRANSIT',      icon: <Truck size={14} />,       label: 'In Transit' },
  { status: 'DELIVERED',       icon: <CheckCircle size={14} />, label: 'Handoff Verified' },
];

const CANCELLABLE = ['AVAILABLE', 'MATCHING', 'MATCHED', 'ACCEPTED', 'DRIVER_ASSIGNED', 'PICKUP_STARTED'];

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = STATUS_TIMELINE.findIndex((s) => s.status === currentStatus);
  const isTerminalBad = ['NO_MATCH_FOUND', 'REJECTED', 'EXPIRED', 'CANCELLED', 'DRIVER_ISSUE'].includes(currentStatus);

  return (
    <div className="panel p-6 border-[var(--border-strong)] bg-[var(--bg-page)] relative overflow-hidden h-full">
      <div className="absolute top-0 right-0 p-4 opacity-5">
        <Clock size={160} />
      </div>
      <div className="relative z-10">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-6 flex items-center gap-2">
          <Clock size={14} className="text-[var(--text-muted)]" /> Telemetry Sequence
        </h3>
        <div className="flex flex-col gap-0">
          {STATUS_TIMELINE.map((step, i) => {
            const done = currentIdx > i;
            const active = currentIdx === i;
            return (
              <div key={step.status} className="flex items-start gap-4">
                {/* Connector line */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 transition-colors border ${
                    done ? 'bg-[var(--success)] text-white border-[var(--success)]' : active ? 'bg-[var(--brand)]/10 border-[var(--brand)] text-[var(--brand)] shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-[var(--bg-panel)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}>
                    {step.icon}
                  </div>
                  {i < STATUS_TIMELINE.length - 1 && (
                    <div className={`w-px flex-1 mt-1 mb-1 min-h-[20px] transition-colors ${done ? 'bg-[var(--success)]' : 'bg-[var(--border-subtle)]'}`} />
                  )}
                </div>
                <div className="pb-5 pt-1.5">
                  <p className={`text-sm tracking-tight ${done || active ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)] font-medium'}`}>
                    {step.label}
                  </p>
                  {active && !isTerminalBad && (
                    <p className="text-[10px] font-mono-data mt-1 text-[var(--brand)] animate-pulse">ACTIVE STATE</p>
                  )}
                </div>
              </div>
            );
          })}

          {isTerminalBad && (
            <div className="flex items-start gap-4 mt-2">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-sm bg-[var(--error)]/10 border border-[var(--error)] text-[var(--error)] flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                  <XCircle size={14} />
                </div>
              </div>
              <div className="pt-1.5">
                 <p className="text-sm font-bold tracking-tight text-[var(--error)]">{currentStatus.replace(/_/g, ' ')}</p>
                 <p className="text-[10px] font-mono-data mt-1 text-[var(--error)]">TERMINAL EXCEPTION</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
      <AppLayout>
        <div className="space-y-6">
          <div className="skeleton h-12 w-1/3 rounded-md" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="skeleton h-48 w-full rounded-md" />
              <div className="skeleton h-48 w-full rounded-md" />
            </div>
            <div className="skeleton h-96 w-full rounded-md" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="panel p-16 text-center border-[var(--error)]/20 bg-[var(--error)]/5">
          <div className="w-16 h-16 rounded-full bg-[var(--error)]/10 flex items-center justify-center mx-auto mb-4">
             <XCircle size={32} className="text-[var(--error)]" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">Telemetry Lost</h3>
          <p className="text-[var(--error)] font-medium text-sm">Failed to retrieve payload details from the network.</p>
        </div>
      </AppLayout>
    );
  }

  const donation = data;
  const isCancellable = CANCELLABLE.includes(donation.status);

  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button className="btn-secondary px-3 py-2" onClick={() => navigate('/donor')}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title">{donation.food_name}</h1>
            <p className="page-subtitle font-mono-data text-[var(--text-muted)] mt-1 tracking-widest">PID: {donation.id}</p>
          </div>
        </div>
        <div>
          <StatusBadge status={donation.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column — details + actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main info */}
          <div className="panel p-6 border-[var(--border-strong)] bg-[var(--bg-page)] relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5">
               <Package size={120} />
             </div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-6 flex items-center gap-2 relative z-10">
              <Package size={14} className="text-[var(--text-muted)]" /> Payload Specifications
            </h3>
            <div className="grid grid-cols-2 gap-4 relative z-10">
              {[
                { label: 'Classification', value: donation.food_category.replace(/_/g, ' ') },
                { label: 'Net Mass', value: <span className="font-mono-data text-base">{donation.quantity_kg} kg</span> },
                { label: 'Critical Expiry', value: <span className="font-mono-data text-[var(--warning)]">{format(new Date(donation.expiry_time), 'MMM d, yyyy HH:mm')}</span> },
                { label: 'Network Entry', value: <span className="font-mono-data text-[var(--text-secondary)]">{format(new Date(donation.created_at), 'MMM d, yyyy HH:mm')}</span> },
              ].map((d) => (
                <div key={d.label} className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-md p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">{d.label}</p>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{d.value}</div>
                </div>
              ))}
            </div>

            {/* Matched NGO & Driver */}
            {(donation.matched_ngo_id || donation.driver_id || donation.eta_minutes !== null) && (
              <div className="mt-6 p-5 rounded-md border border-[var(--brand)]/30 bg-[var(--brand)]/5 relative z-10">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--brand)]/20">
                  <div className="flex items-center gap-2">
                    <Truck size={16} className="text-[var(--brand)]" />
                    <span className="text-xs font-bold text-[var(--brand)] uppercase tracking-widest">Logistics Assignment</span>
                  </div>
                  {donation.eta_minutes !== null && (
                    <div className="flex items-center gap-2 bg-[var(--bg-page)] border border-[var(--warning)]/30 px-3 py-1 rounded-sm shadow-sm">
                       <span className="text-[10px] font-semibold text-[var(--text-secondary)] tracking-widest uppercase">ETA</span>
                       <span className="font-mono-data text-[var(--warning)] font-bold">{donation.eta_minutes} min</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {donation.matched_ngo_id && (
                    <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-3 rounded-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">Destination Node</p>
                      <p className="font-medium text-xs font-mono-data text-[var(--text-primary)] break-all">{donation.matched_ngo_id}</p>
                    </div>
                  )}
                  {donation.driver_id && (
                    <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-3 rounded-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">Assigned Courier</p>
                      <p className="font-medium text-xs font-mono-data text-[var(--text-primary)] break-all">{donation.driver_id}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Location */}
             <div className="panel p-6 border-[var(--border-subtle)]">
               <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                 <MapPin size={14} className="text-[var(--text-muted)]" /> Origin Coordinates
               </h3>
               <p className="text-sm text-[var(--text-primary)] mb-4 font-medium leading-relaxed border-l-2 border-[var(--brand)] pl-3">
                 {(donation.pickup_location as any)?.address || 'Location not specified'}
               </p>
               {/* Map placeholder — real Leaflet map if lat/lng available */}
               <div className="rounded-sm flex items-center justify-center bg-[var(--bg-panel)] border border-[var(--border-strong)] h-32 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(var(--brand) 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
                 <div className="text-center relative z-10 bg-[var(--bg-page)]/80 backdrop-blur-sm p-3 rounded-sm border border-[var(--border-subtle)] shadow-sm">
                   <MapPin size={24} className="mx-auto mb-2 text-[var(--brand)]" />
                   <p className="text-[10px] text-[var(--text-secondary)] font-mono-data">
                     {(donation.pickup_location as any)?.latitude
                       ? `${(donation.pickup_location as any).latitude.toFixed(4)}, ${(donation.pickup_location as any).longitude.toFixed(4)}`
                       : 'Awaiting coordinate lock'}
                   </p>
                 </div>
               </div>
             </div>

             {/* Photo upload */}
             <div className="panel p-6 border-[var(--border-subtle)] flex flex-col">
               <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                 <Upload size={14} className="text-[var(--text-muted)]" /> Visual Telemetry
               </h3>
               <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
                 Attach verification imagery. Required for network audit logs and recipient validation.
               </p>
               <div className="flex-1 flex flex-col justify-end">
                  <div className="flex items-center gap-3">
                    <label className="flex-1 cursor-pointer">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
                      <div className={`input-base text-center py-4 cursor-pointer border-dashed border-2 ${photo ? 'border-[var(--brand)] text-[var(--brand)] bg-[var(--brand)]/5' : 'border-[var(--border-strong)] hover:border-[var(--brand)] text-[var(--text-muted)] hover:text-[var(--brand)]'} transition-all`}>
                        {photo ? (
                          <span className="font-semibold text-xs tracking-wide">📎 {photo.name}</span>
                        ) : (
                          <span className="text-xs font-semibold tracking-wide uppercase">Select File</span>
                        )}
                      </div>
                    </label>
                    <button
                      onClick={() => photoMutation.mutate()}
                      disabled={!photo || photoMutation.isPending}
                      className="btn-primary py-4 px-5 flex-shrink-0"
                    >
                      {photoMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    </button>
                  </div>
                  {photoMutation.isSuccess && (
                    <p className="text-[10px] font-mono-data font-bold mt-3 text-[var(--success)] uppercase tracking-widest">
                       TRANSMISSION SUCCESSFUL
                    </p>
                  )}
               </div>
             </div>
          </div>

          {/* Cancel */}
          {isCancellable && (
            <div className="panel p-6 border-[var(--error)] bg-[var(--error)]/5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--error)] mb-4 flex items-center gap-2">
                <AlertTriangle size={14} /> Critical Action
              </h3>

              {!showCancelConfirm ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                   <p className="text-sm text-[var(--text-secondary)] max-w-md">
                      Aborting this payload will remove it from the routing network and notify any matched logistics.
                   </p>
                   <button className="px-6 py-2.5 rounded-sm text-sm font-semibold tracking-wide flex items-center justify-center gap-2 bg-[var(--bg-page)] border border-[var(--error)] text-[var(--error)] hover:bg-[var(--error)] hover:text-black transition-colors shadow-sm flex-shrink-0" onClick={() => setShowCancelConfirm(true)}>
                     Abort Payload
                   </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-[var(--bg-page)] border border-[var(--border-subtle)] rounded-sm">
                     <label className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 block">
                        Reason for Abort
                     </label>
                     <input
                       type="text"
                       value={cancelReason}
                       onChange={(e) => setCancelReason(e.target.value)}
                       placeholder="e.g. Spilled, Expired, No longer available..."
                       className="input-base border-[var(--border-strong)] focus:border-[var(--error)]"
                     />
                  </div>
                  <div className="flex gap-3">
                    <button className="btn-secondary flex-1" onClick={() => { setShowCancelConfirm(false); setCancelReason(''); }}>
                      Cancel Abort
                    </button>
                    <button className="px-6 py-2.5 rounded-sm text-sm font-semibold tracking-wide flex items-center justify-center gap-2 bg-[var(--error)] text-black hover:bg-red-400 transition-colors shadow-sm flex-1" disabled={!cancelReason || cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate()}>
                      {cancelMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> EXECUTING…</> : 'CONFIRM ABORT'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column — timeline */}
        <div className="lg:h-full lg:min-h-[600px]">
          <StatusTimeline currentStatus={donation.status} />
        </div>
      </div>
    </AppLayout>
  );
}

