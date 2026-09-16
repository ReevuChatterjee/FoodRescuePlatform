/**
 * NGOSettings — lets NGO update capacity, demand entries, and profile info.
 * PATCH /api/v1/ngos/{id}/capacity, /demand, and /
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Settings, Weight, TrendingUp, Save, Loader2, Plus } from 'lucide-react';
import { useMyNGOProfile, useUpdateNGOCapacity, useUpdateNGODemand, useUpdateNGOProfile } from '../../hooks/useNGO';
import { AppLayout } from '../../components/layout/AppLayout';

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
  priority: z.number().int().min(1).max(10),
  valid_until: z.string().min(1, 'Required'),
});
const profileSchema = z.object({
  organisation_name: z.string().min(1),
  address: z.string().min(1),
  operating_start: z.string().min(1),
  operating_end: z.string().min(1),
  accepted_categories: z.array(z.string()),
});

type CapacityForm = z.infer<typeof capacitySchema>;
type DemandForm = z.infer<typeof demandSchema>;
type ProfileForm = z.infer<typeof profileSchema>;

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="panel p-6">
      <h2 className="section-title flex items-center gap-2">{icon} {title}</h2>
      {children}
    </div>
  );
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-sm text-sm font-medium shadow-lg border ${type === 'success' ? 'bg-emerald-950 border-emerald-900 text-emerald-400' : 'bg-red-950 border-red-900 text-red-400'}`}>
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
    defaultValues: { food_category: 'COOKED', required_quantity_kg: 50, priority: 5 },
  });
  const demandMutation = useUpdateNGODemand(ngoId);

  // Profile form
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      organisation_name: profile?.organisation_name ?? '',
      address: profile?.address ?? '',
      operating_start: profile?.operating_hours.start ?? '08:00',
      operating_end: profile?.operating_hours.end ?? '20:00',
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
      <AppLayout>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-40 w-full" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">NGO Settings</h1>
          <p className="page-subtitle">Update your capacity, demand preferences, and profile</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* ── Capacity ── */}
        <SectionCard title="Available Capacity" icon={<Weight size={16} className="text-zinc-400" />}>
          <p className="text-sm text-zinc-400 mb-5">
            Update how much food you can currently receive. Total capacity: <strong className="text-zinc-100 font-semibold">{profile?.storage_capacity_kg} kg</strong>.
          </p>
          <form onSubmit={capForm.handleSubmit(async (d) => {
            try {
              await capMutation.mutateAsync(d.available_capacity_kg);
              showToast('Capacity updated successfully.', 'success');
            } catch (e: any) {
              showToast(e.response?.data?.error?.message || 'Failed to update capacity.', 'error');
            }
          })} className="flex gap-3">
            <div className="flex-1">
              <input
                {...capForm.register('available_capacity_kg', { valueAsNumber: true })}
                type="number" step="1" min="0" max={profile?.storage_capacity_kg}
                className="input-base tabular-nums"
                placeholder="e.g. 250"
              />
              {capForm.formState.errors.available_capacity_kg && (
                <p className="form-error">{capForm.formState.errors.available_capacity_kg.message}</p>
              )}
            </div>
            <button type="submit" className="btn-primary flex-shrink-0" disabled={capMutation.isPending}>
              {capMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Save</>}
            </button>
          </form>
        </SectionCard>

        {/* ── Accepted food categories ── */}
        <SectionCard title="Accepted Food Categories" icon={<TrendingUp size={16} className="text-zinc-400" />}>
          <p className="text-sm text-zinc-400 mb-5">
            Select which food types your NGO can accept. The matching engine filters by this.
          </p>
          <div className="flex flex-wrap gap-2 mb-5">
            {FOOD_CATEGORIES.map((cat) => {
              const sel = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-sm text-sm font-medium border transition-colors ${sel ? 'bg-emerald-950 border-emerald-900 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              );
            })}
          </div>
          <button
            className="btn-primary"
            disabled={profileMutation.isPending}
            onClick={async () => {
              try {
                await profileMutation.mutateAsync({ accepted_categories: selectedCategories });
                showToast('Categories updated.', 'success');
              } catch (e: any) {
                showToast(e.response?.data?.error?.message || 'Failed to update.', 'error');
              }
            }}>
            {profileMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Save Categories</>}
          </button>
        </SectionCard>

        {/* ── Add demand entry ── */}
        <SectionCard title="Add Demand Entry" icon={<Plus size={16} className="text-zinc-400" />}>
          <p className="text-sm text-zinc-400 mb-5">
            Declare what food you urgently need. The matching algorithm prioritises these.
          </p>
          <form onSubmit={demandForm.handleSubmit(async (d) => {
            try {
              await demandMutation.mutateAsync({
                ...d,
                valid_until: new Date(d.valid_until).toISOString(),
              });
              showToast('Demand entry added.', 'success');
              demandForm.reset({ food_category: 'COOKED', required_quantity_kg: 50, priority: 5 });
            } catch (e: any) {
              showToast(e.response?.data?.error?.message || 'Failed to add demand.', 'error');
            }
          })} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Food Category</label>
                <select {...demandForm.register('food_category')} className="select-base">
                  {FOOD_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Required Quantity (kg)</label>
                <input {...demandForm.register('required_quantity_kg', { valueAsNumber: true })}
                  type="number" step="1" className="input-base tabular-nums" />
                {demandForm.formState.errors.required_quantity_kg && (
                  <p className="form-error">{demandForm.formState.errors.required_quantity_kg.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Priority (1–10)</label>
                <input {...demandForm.register('priority', { valueAsNumber: true })}
                  type="number" min="1" max="10" className="input-base tabular-nums" />
              </div>
              <div>
                <label className="form-label">Valid Until</label>
                <input {...demandForm.register('valid_until')} type="datetime-local" className="input-base tabular-nums" />
                {demandForm.formState.errors.valid_until && (
                  <p className="form-error">{demandForm.formState.errors.valid_until.message}</p>
                )}
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={demandMutation.isPending}>
              {demandMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Add Demand Entry</>}
            </button>
          </form>
        </SectionCard>

        {/* ── Profile info ── */}
        <SectionCard title="Organisation Profile" icon={<Settings size={16} className="text-zinc-400" />}>
          <form onSubmit={profileForm.handleSubmit(async (d) => {
            try {
              await profileMutation.mutateAsync({
                organisation_name: d.organisation_name,
                address: d.address,
                operating_start: d.operating_start,
                operating_end: d.operating_end,
              });
              showToast('Profile updated.', 'success');
            } catch (e: any) {
              showToast(e.response?.data?.error?.message || 'Failed to update profile.', 'error');
            }
          })} className="space-y-4">
            <div>
              <label className="form-label">Organisation name</label>
              <input {...profileForm.register('organisation_name')} className="input-base" />
            </div>
            <div>
              <label className="form-label">Address</label>
              <input {...profileForm.register('address')} className="input-base" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Opening time</label>
                <input {...profileForm.register('operating_start')} type="time" className="input-base tabular-nums" />
              </div>
              <div>
                <label className="form-label">Closing time</label>
                <input {...profileForm.register('operating_end')} type="time" className="input-base tabular-nums" />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={profileMutation.isPending}>
              {profileMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Save Profile</>}
            </button>
          </form>
        </SectionCard>
      </div>
    </AppLayout>
  );
}
