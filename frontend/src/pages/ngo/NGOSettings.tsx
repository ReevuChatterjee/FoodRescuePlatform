/**
 * NGOSettings — lets NGO update capacity, demand entries, and profile info.
 * PATCH /api/v1/ngos/{id}/capacity, /demand, and /
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Settings, Weight, TrendingUp, Save, Loader2, Plus, Terminal } from 'lucide-react';
import { useMyNGOProfile, useUpdateNGOCapacity, useUpdateNGODemand, useUpdateNGOProfile } from '../../hooks/useNGO';
import { NGOLayout } from '../../components/layout/NGOLayout';
import { LocationAutocomplete } from '../../components/common/LocationAutocomplete';

const FOOD_CATEGORIES = ['COOKED', 'RAW_PRODUCE', 'PACKAGED', 'BAKED_GOODS', 'DAIRY', 'MIXED'];
const CATEGORY_LABELS: Record<string, string> = {
  COOKED: 'Cooked Food', RAW_PRODUCE: 'Raw Produce', PACKAGED: 'Packaged',
  BAKED_GOODS: 'Baked Goods', DAIRY: 'Dairy', MIXED: 'Mixed',
};

// Schemas
const capacitySchema = z.object({
  available_capacity_kg: z.number().min(0, 'Must be ≥ 0'),
});
const demandSchema = z.object({
  food_category: z.enum(['COOKED', 'RAW_PRODUCE', 'PACKAGED', 'BAKED_GOODS', 'DAIRY', 'MIXED']),
  required_quantity_kg: z.number().positive('Must be > 0'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  valid_until: z.string().min(1, 'Required'),
});
const profileSchema = z.object({
  organisation_name: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  operating_start: z.string().min(1),
  operating_end: z.string().min(1),
  accepted_categories: z.array(z.string()),
});

type CapacityForm = z.infer<typeof capacitySchema>;
type DemandForm = z.infer<typeof demandSchema>;
type ProfileForm = z.infer<typeof profileSchema>;

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="panel p-6 border-[var(--border-strong)] bg-[var(--bg-page)] relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5">
        <Terminal size={120} />
      </div>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-6 flex items-center gap-2 relative z-10">
        <span className="text-[var(--brand)]">{icon}</span> {title}
      </h2>
      <div className="relative z-10">
         {children}
      </div>
    </div>
  );
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-md text-sm font-semibold tracking-wide shadow-lg border ${
      type === 'success' ? 'bg-[var(--success)]/10 border-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--error)]/10 border-[var(--error)]/20 text-[var(--error)]'
    }`}>
      {msg}
    </div>
  );
}

export function NGOSettings() {
  const { data: profile, isLoading } = useMyNGOProfile();
  const ngoId = profile?.ngo_id;

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(profile?.accepted_categories ?? []);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Capacity form
  const capForm = useForm<CapacityForm>({
    resolver: zodResolver(capacitySchema),
    values: { available_capacity_kg: profile?.available_capacity_kg ?? 0 },
  });
  const capMutation = useUpdateNGOCapacity(ngoId);

  // Demand form
  const demandForm = useForm<DemandForm>({
    resolver: zodResolver(demandSchema),
    defaultValues: { food_category: 'COOKED', required_quantity_kg: 50, priority: 'MEDIUM' },
  });
  const demandMutation = useUpdateNGODemand(ngoId);

  // Profile form
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      organisation_name: profile?.organisation_name ?? '',
      address: profile?.address ?? '',
      latitude: profile?.location?.latitude ?? undefined,
      longitude: profile?.location?.longitude ?? undefined,
      operating_start: profile?.operating_hours?.start ?? '08:00',
      operating_end: profile?.operating_hours?.end ?? '20:00',
      accepted_categories: profile?.accepted_categories ?? [],
    },
  });
  const profileMutation = useUpdateNGOProfile(ngoId);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  if (isLoading) {
    return (
      <NGOLayout>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-48 w-full max-w-2xl rounded-md" />)}
        </div>
      </NGOLayout>
    );
  }

  return (
    <NGOLayout>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title">Node Configuration</h1>
          <p className="page-subtitle">Adjust operational parameters and capacity constraints.</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* ── Capacity ── */}
        <SectionCard title="Active Storage Capacity" icon={<Weight size={14} />}>
          <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
            Specify current available volume. The dispatch algorithm relies on this metric to route appropriate payloads. Maximum facility capacity: <strong className="text-[var(--text-primary)] font-mono-data bg-[var(--bg-panel)] px-2 py-0.5 rounded-sm border border-[var(--border-subtle)]">{profile?.storage_capacity_kg} kg</strong>.
          </p>

          {/* Spatial Capacity Indicator */}
          <div className="mb-8 p-4 border border-[var(--border-strong)] bg-[var(--bg-panel)] rounded-sm relative overflow-hidden">
             <div className="flex justify-between items-end mb-3 relative z-10">
               <div>
                 <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">Available Bandwidth</p>
                 <p className="text-2xl font-bold font-mono-data text-[var(--brand)]">{profile?.available_capacity_kg} <span className="text-sm text-[var(--text-muted)] font-normal">kg</span></p>
               </div>
               <div className="text-right">
                 <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">Utilization</p>
                 <p className="text-sm font-mono-data text-[var(--text-primary)]">
                   {profile?.storage_capacity_kg ? (((profile.storage_capacity_kg - profile.available_capacity_kg) / profile.storage_capacity_kg) * 100).toFixed(1) : 0}%
                 </p>
               </div>
             </div>
             
             {/* Visual Bar */}
             <div className="h-4 w-full bg-[var(--bg-page)] rounded-none overflow-hidden flex border border-[var(--border-subtle)] relative z-10">
               {/* Used capacity (gray) */}
               <div 
                 className="h-full bg-[var(--border-strong)] transition-all duration-500" 
                 style={{ width: `${profile?.storage_capacity_kg ? ((profile.storage_capacity_kg - profile.available_capacity_kg) / profile.storage_capacity_kg) * 100 : 0}%` }} 
               />
               {/* Available capacity (brand) */}
               <div 
                 className="h-full bg-[var(--brand)] transition-all duration-500 relative overflow-hidden" 
                 style={{ width: `${profile?.storage_capacity_kg ? (profile.available_capacity_kg / profile.storage_capacity_kg) * 100 : 0}%` }}
               >
                 <div className="absolute inset-0 w-full h-full opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 20px)' }}></div>
               </div>
             </div>
          </div>

          <form onSubmit={capForm.handleSubmit(async (d) => {
            try {
              await capMutation.mutateAsync(d.available_capacity_kg);
              showToast('Capacity constraints updated.', 'success');
            } catch (e: any) {
              showToast(e.response?.data?.error?.message || 'Failed to update capacity.', 'error');
            }
          })} className="flex flex-col sm:flex-row gap-4 items-start sm:items-end p-4 border border-[var(--brand)]/30 bg-[var(--brand)]/5 rounded-sm">
            <div className="flex-1 w-full">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 block">
                Update Available Mass (kg)
              </label>
              <input
                {...capForm.register('available_capacity_kg', { valueAsNumber: true })}
                type="number" step="1" min="0" max={profile?.storage_capacity_kg}
                className="input-base font-mono-data text-lg border-[var(--border-strong)] focus:border-[var(--brand)]"
                placeholder="e.g. 250"
              />
              {capForm.formState.errors.available_capacity_kg && (
                <p className="form-error mt-2">{capForm.formState.errors.available_capacity_kg.message}</p>
              )}
            </div>
            <button type="submit" className="btn-primary flex-shrink-0 w-full sm:w-auto px-6 py-3 flex items-center justify-center gap-2 bg-[var(--brand)] text-black" disabled={capMutation.isPending}>
              {capMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> COMMIT</>}
            </button>
          </form>
        </SectionCard>

        {/* ── Accepted food categories ── */}
        <SectionCard title="Payload Classifications" icon={<TrendingUp size={14} />}>
          <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
            Toggle accepted categories. Mismatched payloads will not be routed to your node.
          </p>
          <div className="flex flex-wrap gap-2 mb-6 p-4 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-sm">
            {FOOD_CATEGORIES.map((cat) => {
              const sel = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-4 py-2 rounded-sm text-xs font-semibold tracking-wide uppercase border transition-all ${sel ? 'bg-[var(--brand)]/10 border-[var(--brand)] text-[var(--brand)] shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-[var(--bg-page)] border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--text-secondary)] hover:text-[var(--text-secondary)]'}`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              );
            })}
          </div>
          <button
            className="px-6 py-2.5 rounded-sm text-sm font-semibold tracking-wide flex items-center justify-center gap-2 bg-[var(--bg-panel)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--brand)] transition-colors"
            disabled={profileMutation.isPending}
            onClick={async () => {
              try {
                await profileMutation.mutateAsync({ accepted_categories: selectedCategories });
                showToast('Classifications updated.', 'success');
              } catch (e: any) {
                showToast(e.response?.data?.error?.message || 'Failed to update.', 'error');
              }
            }}>
            {profileMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Update Filters</>}
          </button>
        </SectionCard>

        {/* ── Add demand entry ── */}
        <SectionCard title="Urgent Demand Request" icon={<Plus size={14} />}>
          <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
            Broadcast urgent requirements to the network. The matching algorithm heavily prioritizes explicit demands.
          </p>
          <form onSubmit={demandForm.handleSubmit(async (d) => {
            try {
              await demandMutation.mutateAsync({
                ...d,
                valid_until: new Date(d.valid_until).toISOString(),
              });
              showToast('Demand broadcasted.', 'success');
              demandForm.reset({ food_category: 'COOKED', required_quantity_kg: 50, priority: 'MEDIUM' });
            } catch (e: any) {
              showToast(e.response?.data?.error?.message || 'Failed to broadcast demand.', 'error');
            }
          })} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 block">Classification</label>
                <select {...demandForm.register('food_category')} className="select-base">
                  {FOOD_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 block">Required Mass (kg)</label>
                <input {...demandForm.register('required_quantity_kg', { valueAsNumber: true })}
                  type="number" step="1" className="input-base font-mono-data" />
                {demandForm.formState.errors.required_quantity_kg && (
                  <p className="form-error mt-1">{demandForm.formState.errors.required_quantity_kg.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[var(--border-subtle)] pt-6">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 block flex items-center justify-between">
                   <span>Priority Level</span>
                </label>
                <select {...demandForm.register('priority')} className="select-base">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 block">Expiration Window</label>
                <input {...demandForm.register('valid_until')} type="datetime-local" className="input-base font-mono-data text-sm" />
                {demandForm.formState.errors.valid_until && (
                  <p className="form-error mt-1">{demandForm.formState.errors.valid_until.message}</p>
                )}
              </div>
            </div>
            <button type="submit" className="px-6 py-2.5 rounded-sm text-sm font-semibold tracking-wide flex items-center justify-center gap-2 bg-[var(--bg-panel)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--brand)] transition-colors w-full sm:w-auto" disabled={demandMutation.isPending}>
              {demandMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Broadcast Request</>}
            </button>
          </form>
        </SectionCard>

        {/* ── Profile info ── */}
        <SectionCard title="Node Telemetry" icon={<Settings size={14} />}>
          <form onSubmit={profileForm.handleSubmit(async (d) => {
            try {
              await profileMutation.mutateAsync({
                organisation_name: d.organisation_name,
                address: d.address,
                latitude: d.latitude,
                longitude: d.longitude,
                operating_start: d.operating_start,
                operating_end: d.operating_end,
              });
              showToast('Telemetry updated.', 'success');
            } catch (e: any) {
              showToast(e.response?.data?.error?.message || 'Failed to update telemetry.', 'error');
            }
          })} className="space-y-6">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 block">Node Designation</label>
              <input {...profileForm.register('organisation_name')} className="input-base font-semibold" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 block">Facility Coordinates</label>
              <LocationAutocomplete
                value={profileForm.watch('address') || ''}
                onChange={(val) => profileForm.setValue('address', val)}
                onSelect={(addr, lat, lng) => {
                  profileForm.setValue('address', addr);
                  profileForm.setValue('latitude', lat);
                  profileForm.setValue('longitude', lng);
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-subtle)] pt-6">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 block">Operational Start</label>
                <input {...profileForm.register('operating_start')} type="time" className="input-base font-mono-data" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 block">Operational End</label>
                <input {...profileForm.register('operating_end')} type="time" className="input-base font-mono-data" />
              </div>
            </div>
            <button type="submit" className="px-6 py-2.5 rounded-sm text-sm font-semibold tracking-wide flex items-center justify-center gap-2 bg-[var(--bg-panel)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--brand)] transition-colors" disabled={profileMutation.isPending}>
              {profileMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Sync Telemetry</>}
            </button>
          </form>
        </SectionCard>
      </div>
    </NGOLayout>
  );
}
