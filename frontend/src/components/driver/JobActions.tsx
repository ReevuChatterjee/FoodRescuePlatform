import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  PRE_PICKUP_STATUSES,
  apiErrorMessage,
  useActionKey,
  useConfirmDelivery,
  useConfirmPickup,
  useReportIssue,
  useStartTrip,
  type DriverJob,
} from '../../hooks/useDriver';

export const DELIVERY_CONDITIONS = ['GOOD', 'FAIR', 'POOR'] as const;

export function JobActions({ job, vehicleCapacityKg }: { job: DriverJob; vehicleCapacityKg: number }) {
  const [showIssue, setShowIssue] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Determine which action is currently required
  const isAssigned = job.status === 'DRIVER_ASSIGNED';
  const isPickup = job.status === 'PICKUP_STARTED';
  const isDeliver = job.status === 'PICKED_UP' || job.status === 'IN_TRANSIT';
  const prePickup = PRE_PICKUP_STATUSES.includes(job.status);

  // If reporting an issue, we hide the primary flow
  if (showIssue) {
    return (
      <section className="pt-6 border-t border-outline-variant/30 mt-6" aria-label="Report Issue">
        <ReportIssueForm job={job} onClose={() => setShowIssue(false)} />
      </section>
    );
  }

  return (
    <section className="pt-6 border-t border-outline-variant/30 mt-6" aria-label="Job actions">
      
      {/* State 1: Accept Delivery */}
      {isAssigned && <StartTripButton deliveryId={job.delivery_id} />}

      {/* State 2: Confirm Pickup */}
      {isPickup && (
        showForm ? (
          <PickupForm job={job} capacityKg={vehicleCapacityKg} onClose={() => setShowForm(false)} />
        ) : (
          <button type="button" className="h-12 px-8 bg-primary text-on-primary rounded text-[1rem] font-medium hover:bg-primary/90 transition-colors w-full" onClick={() => setShowForm(true)}>
            Confirm pickup
          </button>
        )
      )}

      {/* State 3: Confirm Delivery */}
      {isDeliver && (
        showForm ? (
          <DeliverForm job={job} onClose={() => setShowForm(false)} />
        ) : (
          <button type="button" className="h-12 px-8 bg-primary text-on-primary rounded text-[1rem] font-medium hover:bg-primary/90 transition-colors w-full" onClick={() => setShowForm(true)}>
            Confirm handoff
          </button>
        )
      )}

      {/* Issue reporting is always a secondary action while pre-pickup */}
      {prePickup && !showForm && (
        <button type="button" className="mt-4 w-full text-center text-[0.8125rem] font-medium text-error hover:underline"
          onClick={() => setShowIssue(true)}>
          Report an issue
        </button>
      )}
    </section>
  );
}

function StartTripButton({ deliveryId }: { deliveryId: string }) {
  const { key, reset } = useActionKey();
  const start = useStartTrip();
  return (
    <div>
      <button type="button" className="h-12 px-8 bg-primary text-on-primary rounded text-[1rem] font-medium hover:bg-primary/90 transition-colors w-full flex items-center justify-center gap-2 disabled:opacity-50" disabled={start.isPending}
        onClick={() => start.mutate({ deliveryId, idempotencyKey: key }, { onSuccess: reset })}>
        {start.isPending && <Loader2 size={16} className="animate-spin" />}
        {start.isError ? 'Try again' : 'Accept delivery'}
      </button>
      {start.isError && <ErrorText error={start.error} />}
    </div>
  );
}

function PickupForm({ job, capacityKg, onClose }: { job: DriverJob; capacityKg: number; onClose: () => void }) {
  const { key, reset } = useActionKey();
  const pickup = useConfirmPickup();
  const [kg, setKg] = useState(job.quantity_kg.toFixed(1));
  const value = Number(kg);
  const invalid = !(value > 0) || (capacityKg > 0 && value > capacityKg);

  const close = () => { reset(); onClose(); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    pickup.mutate(
      { deliveryId: job.delivery_id, idempotencyKey: key, confirmed_quantity_kg: Math.round(value * 10) / 10 },
      { onSuccess: close },
    );
  };

  return (
    <form onSubmit={submit} className="bg-surface-container-lowest border border-outline-variant p-5 rounded" aria-label="Confirm pickup">
      <h3 className="text-[1rem] font-semibold text-on-surface tracking-tight mb-4">Confirm pickup</h3>
      
      <div className="mb-6">
        <label className="block text-[0.8125rem] font-semibold text-on-surface mb-1.5">Quantity loaded (kg)</label>
        <input className="w-full sm:w-1/2 h-10 px-3 bg-surface border border-outline-variant rounded text-[0.875rem] font-mono-data text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" type="number" inputMode="decimal" step="0.1" min="0.1"
          value={kg} onChange={(e) => setKg(e.target.value)} />
        {invalid && (
          <p className="text-[0.75rem] font-medium text-error mt-1.5">Enter more than 0 kg{capacityKg > 0 ? `, up to your vehicle's ${capacityKg.toFixed(1)} kg` : ''}.</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-outline-variant/30">
        <button type="button" onClick={onClose} className="w-full sm:w-auto h-10 px-5 text-[0.875rem] font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={invalid || pickup.isPending} className="w-full sm:w-auto h-10 px-6 bg-primary text-on-primary rounded text-[0.875rem] font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
          {pickup.isPending && <Loader2 size={16} className="animate-spin" />} Submit
        </button>
      </div>
      {pickup.isError && <ErrorText error={pickup.error} />}
    </form>
  );
}

function DeliverForm({ job, onClose }: { job: DriverJob; onClose: () => void }) {
  const { key, reset } = useActionKey();
  const deliver = useConfirmDelivery();
  const [kg, setKg] = useState(job.quantity_kg.toFixed(1));
  const [condition, setCondition] = useState<string>('GOOD');
  const [confirmed, setConfirmed] = useState(false);
  const value = Number(kg);
  const invalid = !(value >= 0) || kg.trim() === '' || !confirmed;

  const close = () => { reset(); onClose(); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    deliver.mutate(
      {
        deliveryId: job.delivery_id, idempotencyKey: key, quantity_handed_over: Math.round(value * 10) / 10,
        condition, recipient_confirmation: confirmed,
      },
      { onSuccess: close },
    );
  };

  return (
    <form onSubmit={submit} className="bg-surface-container-lowest border border-outline-variant p-5 rounded" aria-label="Confirm handoff">
      <h3 className="text-[1rem] font-semibold text-on-surface tracking-tight mb-4">Confirm handoff</h3>
      
      <div className="space-y-6">
        <div>
          <label className="block text-[0.8125rem] font-semibold text-on-surface mb-1.5">Quantity handed over (kg)</label>
          <input className="w-full sm:w-1/2 h-10 px-3 bg-surface border border-outline-variant rounded text-[0.875rem] font-mono-data text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" type="number" inputMode="decimal" step="0.1" min="0"
            value={kg} onChange={(e) => setKg(e.target.value)} />
          {value < job.quantity_kg && value >= 0 && (
            <p className="text-[0.75rem] text-on-surface-variant mt-1.5">Less than the {job.quantity_kg.toFixed(1)} kg picked up: this is recorded as a partial delivery.</p>
          )}
        </div>
        
        <fieldset>
          <legend className="block text-[0.8125rem] font-semibold text-on-surface mb-1.5">Condition</legend>
          <div className="grid grid-cols-3 gap-2">
            {DELIVERY_CONDITIONS.map((c) => (
              <button key={c} type="button" onClick={() => setCondition(c)} aria-pressed={condition === c}
                className={`h-10 rounded border text-[0.8125rem] font-semibold transition-colors ${condition === c
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-outline-variant/50 text-on-surface-variant hover:text-on-surface hover:border-outline-variant'}`}>
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </fieldset>
        
        <label className="flex items-center gap-3 py-2 text-[0.875rem] font-medium text-on-surface cursor-pointer select-none">
          <input type="checkbox" className="w-4 h-4 text-primary bg-surface border-outline-variant rounded focus:ring-primary focus:ring-2" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          The NGO received the food
        </label>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 mt-6 border-t border-outline-variant/30">
        <button type="button" onClick={onClose} className="w-full sm:w-auto h-10 px-5 text-[0.875rem] font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={invalid || deliver.isPending} className="w-full sm:w-auto h-10 px-6 bg-primary text-on-primary rounded text-[0.875rem] font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
          {deliver.isPending && <Loader2 size={16} className="animate-spin" />} Submit
        </button>
      </div>
      {deliver.isError && <ErrorText error={deliver.error} />}
    </form>
  );
}

function ReportIssueForm({ job, onClose }: { job: DriverJob; onClose: () => void }) {
  const { key, reset } = useActionKey();
  const report = useReportIssue();
  const [reason, setReason] = useState('');
  const invalid = reason.trim().length < 3;

  const close = () => { reset(); onClose(); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    report.mutate({ deliveryId: job.delivery_id, idempotencyKey: key, reason: reason.trim() }, { onSuccess: close });
  };

  return (
    <form onSubmit={submit} className="bg-surface-container-lowest border border-error/30 p-5 rounded" aria-label="Report an issue">
      <h3 className="text-[1rem] font-semibold text-error tracking-tight mb-2">Report an issue</h3>
      <p className="text-[0.875rem] text-on-surface-variant mb-6">
        The job will be handed to another driver for the same NGO and you will be set offline.
      </p>
      
      <div className="mb-6">
        <label className="block text-[0.8125rem] font-semibold text-on-surface mb-1.5">What happened?</label>
        <textarea className="w-full p-3 bg-surface border border-outline-variant rounded text-[0.875rem] text-on-surface focus:border-error focus:ring-1 focus:ring-error outline-none transition-shadow resize-none" rows={3} maxLength={200} value={reason}
          onChange={(e) => setReason(e.target.value)} placeholder="e.g. Flat tyre, vehicle breakdown" />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-outline-variant/30">
        <button type="button" onClick={onClose} className="w-full sm:w-auto h-10 px-5 text-[0.875rem] font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={invalid || report.isPending} className="w-full sm:w-auto h-10 px-6 bg-error text-white rounded text-[0.875rem] font-medium hover:bg-error/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
          {report.isPending && <Loader2 size={16} className="animate-spin" />} Submit
        </button>
      </div>
      {report.isError && <ErrorText error={report.error} />}
    </form>
  );
}

function ErrorText({ error }: { error: unknown }) {
  return <p role="alert" className="text-[0.75rem] font-medium text-error mt-2">{apiErrorMessage(error)}</p>;
}
