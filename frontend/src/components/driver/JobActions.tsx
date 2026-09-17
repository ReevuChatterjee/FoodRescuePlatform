/**
 * Delivery actions for the driver (Person 5): start trip, confirm pickup, confirm
 * delivery, report an issue (before pickup only). Big tap targets; each form
 * holds one idempotency key so "Try again" re-sends the same action.
 */

import { useState } from 'react';
import { AlertOctagon, CheckCircle2, Loader2, Navigation, PackageCheck, X } from 'lucide-react';
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

const BIG_PRIMARY = 'btn-primary w-full py-4 text-base font-semibold flex items-center justify-center gap-2 bg-[var(--brand)] text-black';
const BIG_SECONDARY = 'btn-secondary w-full py-4 text-base flex items-center justify-center gap-2';

export const DELIVERY_CONDITIONS = ['GOOD', 'FAIR', 'POOR'] as const;

type Panel = 'pickup' | 'deliver' | 'issue' | null;

export function JobActions({ job, vehicleCapacityKg }: { job: DriverJob; vehicleCapacityKg: number }) {
  const [panel, setPanel] = useState<Panel>(null);
  const prePickup = PRE_PICKUP_STATUSES.includes(job.status);

  return (
    <section className="space-y-3" aria-label="Job actions">
      {job.status === 'DRIVER_ASSIGNED' && panel === null && <StartTripButton deliveryId={job.delivery_id} />}

      {prePickup && (panel === 'pickup'
        ? <PickupForm job={job} capacityKg={vehicleCapacityKg} onClose={() => setPanel(null)} />
        : panel === null && (
          <button type="button" className={job.status === 'PICKUP_STARTED' ? BIG_PRIMARY : BIG_SECONDARY} onClick={() => setPanel('pickup')}>
            <PackageCheck size={20} /> Confirm pickup
          </button>
        ))}

      {!prePickup && (panel === 'deliver'
        ? <DeliverForm job={job} onClose={() => setPanel(null)} />
        : panel === null && (
          <button type="button" className={BIG_PRIMARY} onClick={() => setPanel('deliver')}>
            <CheckCircle2 size={20} /> Confirm delivery
          </button>
        ))}

      {prePickup && (panel === 'issue'
        ? <ReportIssueForm job={job} onClose={() => setPanel(null)} />
        : panel === null && (
          <button type="button" className="btn-ghost w-full py-3 text-sm flex items-center justify-center gap-2 text-[var(--error)]"
            onClick={() => setPanel('issue')}>
            <AlertOctagon size={16} /> Can't make it? Report an issue
          </button>
        ))}
    </section>
  );
}

function StartTripButton({ deliveryId }: { deliveryId: string }) {
  const { key, reset } = useActionKey();
  const start = useStartTrip();
  return (
    <div className="space-y-2">
      <button type="button" className={BIG_PRIMARY} disabled={start.isPending}
        onClick={() => start.mutate({ deliveryId, idempotencyKey: key }, { onSuccess: reset })}>
        {start.isPending ? <Loader2 size={20} className="animate-spin" /> : <Navigation size={20} />}
        {start.isError ? 'Try again: start trip to pickup' : 'Start trip to pickup'}
      </button>
      {start.isError && <ErrorText error={start.error} />}
    </div>
  );
}

function FormShell({ title, onClose, children, onSubmit }: {
  title: string; onClose: () => void; children: React.ReactNode; onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="panel p-5 space-y-4 bg-[var(--bg-page)] border-[var(--border-strong)]" aria-label={title}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--text-secondary)]">{title}</h3>
        <button type="button" onClick={onClose} className="btn-ghost p-2" aria-label="Close"><X size={20} /></button>
      </div>
      {children}
    </form>
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
    <FormShell title="Confirm pickup" onClose={close} onSubmit={submit}>
      <label className="block">
        <span className="form-label">Quantity loaded (kg)</span>
        <input className="input-base text-lg py-3" type="number" inputMode="decimal" step="0.1" min="0.1"
          value={kg} onChange={(e) => setKg(e.target.value)} />
      </label>
      {invalid && (
        <p className="form-error">Enter more than 0 kg{capacityKg > 0 ? `, up to your vehicle's ${capacityKg.toFixed(1)} kg` : ''}.</p>
      )}
      <SubmitButton pending={pickup.isPending} failed={pickup.isError} disabled={invalid} label="Confirm pickup" />
      {pickup.isError && <ErrorText error={pickup.error} />}
    </FormShell>
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
    <FormShell title="Confirm delivery" onClose={close} onSubmit={submit}>
      <label className="block">
        <span className="form-label">Quantity handed over (kg)</span>
        <input className="input-base text-lg py-3" type="number" inputMode="decimal" step="0.1" min="0"
          value={kg} onChange={(e) => setKg(e.target.value)} />
      </label>
      {value < job.quantity_kg && value >= 0 && (
        <p className="text-xs text-[var(--text-muted)]">Less than the {job.quantity_kg.toFixed(1)} kg picked up: this is recorded as a partial delivery.</p>
      )}
      <fieldset>
        <legend className="form-label">Condition</legend>
        <div className="grid grid-cols-3 gap-2">
          {DELIVERY_CONDITIONS.map((c) => (
            <button key={c} type="button" onClick={() => setCondition(c)} aria-pressed={condition === c}
              className={`py-3 rounded-sm border text-sm font-semibold ${condition === c
                ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]'
                : 'border-[var(--border-strong)] text-[var(--text-secondary)]'}`}>
              {c}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-3 py-2 text-base text-[var(--text-primary)]">
        <input type="checkbox" className="w-6 h-6 accent-[var(--brand)]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        The NGO received the food
      </label>
      <SubmitButton pending={deliver.isPending} failed={deliver.isError} disabled={invalid} label="Confirm delivery" />
      {deliver.isError && <ErrorText error={deliver.error} />}
    </FormShell>
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
    <FormShell title="Report an issue" onClose={close} onSubmit={submit}>
      <p className="text-sm text-[var(--text-secondary)]">
        The job is handed to another driver for the same NGO and you are set offline.
      </p>
      <label className="block">
        <span className="form-label">What happened?</span>
        <textarea className="input-base text-base" rows={3} maxLength={200} value={reason}
          onChange={(e) => setReason(e.target.value)} placeholder="e.g. Flat tyre" />
      </label>
      <button type="submit" className="btn-danger w-full py-4 text-base font-semibold flex items-center justify-center gap-2"
        disabled={invalid || report.isPending}>
        {report.isPending && <Loader2 size={20} className="animate-spin" />}
        {report.isError ? 'Try again: report issue' : 'Report issue'}
      </button>
      {report.isError && <ErrorText error={report.error} />}
    </FormShell>
  );
}

function SubmitButton({ pending, failed, disabled, label }: { pending: boolean; failed: boolean; disabled: boolean; label: string }) {
  return (
    <button type="submit" className={BIG_PRIMARY} disabled={disabled || pending}>
      {pending && <Loader2 size={20} className="animate-spin" />}
      {failed ? `Try again: ${label.toLowerCase()}` : label}
    </button>
  );
}

function ErrorText({ error }: { error: unknown }) {
  return <p role="alert" className="form-error">{apiErrorMessage(error)}</p>;
}
