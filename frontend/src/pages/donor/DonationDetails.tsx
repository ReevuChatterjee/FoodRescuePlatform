/**
 * DonationDetails — detailed view with status timeline, map, photo upload, cancel.
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Clock, Package, Truck, CheckCircle, XCircle, Upload, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { apiClient } from '../../api/client';
import type { Donation, SuccessEnvelope } from '../../types/api';
import { StatusBadge } from '../../components/donor/StatusBadge';
import { useDonationWebSocket } from '../../hooks/useDonationWebSocket';
import { AppLayout } from '../../components/layout/AppLayout';

// Status timeline order
const STATUS_TIMELINE = [
  { status: 'AVAILABLE',       icon: <Package size={14} />,     label: 'Listed' },
  { status: 'MATCHING',        icon: <Clock size={14} />,       label: 'Matching NGO' },
  { status: 'MATCHED',         icon: <CheckCircle size={14} />, label: 'Matched' },
  { status: 'ACCEPTED',        icon: <CheckCircle size={14} />, label: 'NGO Accepted' },
  { status: 'DRIVER_ASSIGNED', icon: <Truck size={14} />,       label: 'Driver Assigned' },
  { status: 'PICKUP_STARTED',  icon: <Truck size={14} />,       label: 'Pickup Started' },
  { status: 'PICKED_UP',       icon: <Truck size={14} />,       label: 'Picked Up' },
  { status: 'IN_TRANSIT',      icon: <Truck size={14} />,       label: 'In Transit' },
  { status: 'DELIVERED',       icon: <CheckCircle size={14} />, label: 'Delivered' },
];

const CANCELLABLE = ['AVAILABLE', 'MATCHING', 'MATCHED', 'ACCEPTED', 'DRIVER_ASSIGNED', 'PICKUP_STARTED'];

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = STATUS_TIMELINE.findIndex((s) => s.status === currentStatus);
  const isTerminalBad = ['NO_MATCH_FOUND', 'REJECTED', 'EXPIRED', 'CANCELLED', 'DRIVER_ISSUE'].includes(currentStatus);

  return (
    <div className="panel p-6">
      <h3 className="section-title"><Clock size={16} className="text-zinc-400" /> Status Timeline</h3>
      <div className="flex flex-col gap-0">
        {STATUS_TIMELINE.map((step, i) => {
          const done = currentIdx > i;
          const active = currentIdx === i;
          return (
            <div key={step.status} className="flex items-start gap-4">
              {/* Connector line */}
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-sm flex items-center justify-center flex-shrink-0 transition-colors ${
                  done ? 'bg-emerald-600 text-white' : active ? 'bg-emerald-950 border border-emerald-900 text-emerald-500' : 'bg-zinc-900 border border-zinc-800 text-zinc-600'
                }`}>
                  {step.icon}
                </div>
                {i < STATUS_TIMELINE.length - 1 && (
                  <div className={`w-px flex-1 mt-1 mb-1 min-h-[16px] transition-colors ${done ? 'bg-emerald-600' : 'bg-zinc-800'}`} />
                )}
              </div>
              <div className="pb-4 pt-1">
                <p className={`text-sm font-medium ${done || active ? 'text-zinc-100' : 'text-zinc-500'}`}>
                  {step.label}
                </p>
                {active && !isTerminalBad && (
                  <p className="text-xs mt-0.5 text-emerald-500 font-medium">Current status</p>
                )}
              </div>
            </div>
          );
        })}

        {isTerminalBad && (
          <div className="flex items-center gap-4 mt-2">
            <div className="w-7 h-7 rounded-sm bg-red-950 border border-red-900 text-red-500 flex items-center justify-center">
              <XCircle size={14} />
            </div>
            <p className="text-sm font-medium text-red-500">{currentStatus.replace(/_/g, ' ')}</p>
          </div>
        )}
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
        <div className="space-y-4">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-48 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="panel p-12 text-center">
          <p className="text-red-500 font-medium">Failed to load donation details.</p>
        </div>
      </AppLayout>
    );
  }

  const donation = data;
  const isCancellable = CANCELLABLE.includes(donation.status);

  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button className="btn-secondary px-3 py-2" onClick={() => navigate('/donor')}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title">{donation.food_name}</h1>
            <p className="page-subtitle font-mono">{donation.id}</p>
          </div>
        </div>
        <div>
          <StatusBadge status={donation.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — details + actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main info */}
          <div className="panel p-6">
            <h3 className="section-title"><Package size={16} className="text-zinc-400" /> Donation Info</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Food Category', value: donation.food_category.replace(/_/g, ' ') },
                { label: 'Quantity', value: `${donation.quantity_kg} kg` },
                { label: 'Expiry', value: format(new Date(donation.expiry_time), 'MMM d, yyyy HH:mm') },
                { label: 'Created', value: format(new Date(donation.created_at), 'MMM d, yyyy HH:mm') },
              ].map((d) => (
                <div key={d.label} className="bg-zinc-950 border border-zinc-800 rounded-sm p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1">{d.label}</p>
                  <p className="text-sm font-semibold text-zinc-100 tabular-nums">{d.value}</p>
                </div>
              ))}
            </div>

            {/* Matched NGO & Driver */}
            {(donation.matched_ngo_id || donation.driver_id || donation.eta_minutes !== null) && (
              <div className="mt-4 p-4 rounded-sm border border-emerald-900 bg-emerald-950/30">
                <div className="flex items-center gap-2 mb-3">
                  <Truck size={16} className="text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-500 uppercase tracking-wide">Delivery Details</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {donation.matched_ngo_id && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1">Matched NGO</p>
                      <p className="font-medium text-xs font-mono text-zinc-300 break-all">{donation.matched_ngo_id}</p>
                    </div>
                  )}
                  {donation.driver_id && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1">Driver</p>
                      <p className="font-medium text-xs font-mono text-zinc-300 break-all">{donation.driver_id}</p>
                    </div>
                  )}
                  {donation.eta_minutes !== null && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1">ETA</p>
                      <p className="font-semibold text-amber-500 tabular-nums">{donation.eta_minutes} min</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="panel p-6">
            <h3 className="section-title"><MapPin size={16} className="text-zinc-400" /> Pickup Location</h3>
            <p className="text-sm text-zinc-300 mb-4 font-medium">
              {(donation.pickup_location as any)?.address || 'Location not specified'}
            </p>
            {/* Map placeholder — real Leaflet map if lat/lng available */}
            <div className="rounded-sm flex items-center justify-center bg-zinc-950 border border-zinc-800 h-48">
              <div className="text-center">
                <MapPin size={32} className="mx-auto mb-2 text-zinc-700" />
                <p className="text-sm text-zinc-500 font-mono">
                  {(donation.pickup_location as any)?.latitude
                    ? `${(donation.pickup_location as any).latitude.toFixed(4)}, ${(donation.pickup_location as any).longitude.toFixed(4)}`
                    : 'Map view available with driver assigned'}
                </p>
              </div>
            </div>
          </div>

          {/* Photo upload */}
          <div className="panel p-6">
            <h3 className="section-title"><Upload size={16} className="text-zinc-400" /> Donation Photos</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Upload photos of the food for quality verification and audit records.
            </p>
            <div className="flex items-center gap-3">
              <label className="flex-1 cursor-pointer">
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
                <div className={`input-base text-center py-6 cursor-pointer border-dashed ${photo ? 'border-emerald-500 text-emerald-500' : 'border-zinc-700 hover:border-emerald-500 text-zinc-500 hover:text-emerald-500'} transition-colors`}>
                  {photo ? (
                    <span className="font-medium">📎 {photo.name}</span>
                  ) : (
                    <span>Click to select photo</span>
                  )}
                </div>
              </label>
              <button
                onClick={() => photoMutation.mutate()}
                disabled={!photo || photoMutation.isPending}
                className="btn-primary py-3 px-5 flex-shrink-0"
              >
                {photoMutation.isPending ? 'Uploading…' : 'Upload'}
              </button>
            </div>
            {photoMutation.isSuccess && (
              <p className="text-xs font-medium mt-3 text-emerald-500">✓ Photo uploaded successfully</p>
            )}
          </div>

          {/* Cancel */}
          {isCancellable && (
            <div className="panel p-6 border-red-900 bg-red-950/10">
              <h3 className="section-title text-red-500 flex items-center gap-2">
                <AlertTriangle size={16} /> Cancel Donation
              </h3>

              {!showCancelConfirm ? (
                <button className="btn-danger" onClick={() => setShowCancelConfirm(true)}>
                  Cancel this Donation
                </button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-400">
                    Please provide a reason for cancellation. This will be recorded.
                  </p>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancellation…"
                    className="input-base border-red-900 focus:border-red-500"
                  />
                  <div className="flex gap-3">
                    <button className="btn-danger flex-1" disabled={!cancelReason || cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate()}>
                      {cancelMutation.isPending ? 'Cancelling…' : 'Confirm Cancel'}
                    </button>
                    <button className="btn-secondary" onClick={() => { setShowCancelConfirm(false); setCancelReason(''); }}>
                      Keep Donation
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column — timeline */}
        <div>
          <StatusTimeline currentStatus={donation.status} />
        </div>
      </div>
    </AppLayout>
  );
}
