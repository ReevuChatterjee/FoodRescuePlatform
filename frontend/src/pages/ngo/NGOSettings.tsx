/**
 * NGOSettings — lets NGO update capacity, demand entries, and profile info.
 * PATCH /api/v1/ngos/{id}/capacity, /demand, and /
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Check } from 'lucide-react';
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

function SectionCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant/50 rounded-md p-6">
      <div className="mb-6 pb-4 border-b border-outline-variant/30">
        <h2 className="text-[1rem] font-semibold text-on-surface mb-1">{title}</h2>
        <p className="text-[0.875rem] text-on-surface-variant leading-relaxed">{desc}</p>
      </div>
      <div>
         {children}
      </div>
    </section>
  );
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-md text-[0.875rem] font-medium shadow-lg border ${
      type === 'success' ? 'bg-success/10 border-success/20 text-success' : 'bg-error/10 border-error/20 text-error'
    }`}>
      {msg}
    </div>
  );
}

export function NGOSettings() {
  const { data: profile, isLoading } = useMyNGOProfile();
  const ngoId = profile?.ngo_id;

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    if (profile) {
      const cats = profile.accepted_categories ? [...profile.accepted_categories] : [];
      if (!cats.includes('COOKED')) cats.push('COOKED');
      setSelectedCategories(cats);
    }
  }, [profile]);

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
      <div className="mb-10 pb-6 border-b border-outline-variant/30 flex justify-between items-end">
        <div>
          <h1 className="text-[1.375rem] font-semibold text-on-surface mb-1.5 tracking-tight">Node Configuration</h1>
          <p className="text-[0.875rem] text-on-surface-variant max-w-[50ch] leading-relaxed">Adjust operational parameters and capacity constraints.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-none">
        {/* ── Capacity ── */}
        <SectionCard title="Storage capacity" desc="Specify current available volume. The dispatch algorithm relies on this metric to route appropriate payloads.">
          {/* Spatial Capacity Indicator */}
          <div className="mb-8">
             <div className="flex justify-between items-end mb-2">
               <div>
                 <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Current available capacity</p>
                 <p className="text-[2.5rem] font-medium font-mono-data text-on-surface leading-none tracking-tighter">{profile?.available_capacity_kg} <span className="text-[1rem] text-on-surface-variant font-sans font-normal tracking-normal lowercase">kg</span></p>
               </div>
               <div className="text-right">
                 <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Utilization</p>
                 <p className="text-[0.875rem] font-mono-data text-on-surface-variant">
                   {profile?.storage_capacity_kg ? (((profile.storage_capacity_kg - profile.available_capacity_kg) / profile.storage_capacity_kg) * 100).toFixed(0) : 0}%
                 </p>
               </div>
             </div>
             
             {/* Visual Bar */}
             <div className="h-[2px] w-full bg-outline-variant/30 rounded-none overflow-hidden flex relative z-10 mb-2">
               <div 
                 className="h-full bg-primary transition-all duration-300" 
                 style={{ width: `${profile?.storage_capacity_kg ? ((profile.storage_capacity_kg - profile.available_capacity_kg) / profile.storage_capacity_kg) * 100 : 0}%` }} 
               />
             </div>
             <div className="flex justify-between text-[0.8125rem]">
               <span className="text-on-surface-variant">Used</span>
               <span className="text-on-surface-variant font-mono-data">{profile?.storage_capacity_kg} kg capacity limit</span>
             </div>
          </div>

          <form onSubmit={capForm.handleSubmit(async (d) => {
            try {
              await capMutation.mutateAsync(d.available_capacity_kg);
              showToast('Capacity constraints updated.', 'success');
            } catch (e: any) {
              showToast(e.response?.data?.error?.message || 'Failed to update capacity.', 'error');
            }
          })} className="pt-6 border-t border-outline-variant/30 flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="w-full sm:w-[200px]">
              <label className="text-[0.8125rem] font-medium text-on-surface mb-2 block">
                Update available mass (kg)
              </label>
              <input
                {...capForm.register('available_capacity_kg', { valueAsNumber: true })}
                type="number" step="1" min="0" max={profile?.storage_capacity_kg}
                className="w-full h-10 px-3 bg-surface-container-low border border-outline-variant rounded-md text-[0.875rem] font-mono-data text-on-surface focus:outline-none focus:border-primary transition-colors"
              />
              {capForm.formState.errors.available_capacity_kg && (
                <p className="text-error text-[0.8125rem] mt-1">{capForm.formState.errors.available_capacity_kg.message}</p>
              )}
            </div>
            <button type="submit" className="h-10 px-5 rounded-md text-[0.875rem] font-medium flex items-center justify-center gap-2 bg-primary text-on-primary hover:bg-primary/90 transition-colors w-full sm:w-auto" disabled={capMutation.isPending}>
              {capMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
            </button>
          </form>
        </SectionCard>

        {/* ── Accepted food categories ── */}
        <SectionCard title="Payload classifications" desc="Select the food categories this node accepts. Mismatched payloads will not be routed here.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {FOOD_CATEGORIES.map((cat) => {
              const sel = selectedCategories.includes(cat);
              return (
                <label
                  key={cat}
                  className={`flex items-center gap-3 p-3 rounded-md border transition-all cursor-pointer select-none ${sel ? 'bg-primary/5 border-primary text-primary' : 'bg-surface-container-low border-outline-variant text-on-surface hover:border-outline hover:bg-surface-container'}`}
                >
                  <input
                    type="checkbox"
                    checked={sel}
                    onChange={() => toggleCategory(cat)}
                    className="hidden"
                  />
                  <div className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors flex-shrink-0 ${sel ? 'bg-primary border-primary' : 'border-outline-variant bg-surface'}`}>
                     {sel && <Check size={12} className="text-on-primary" strokeWidth={3} />}
                  </div>
                  <span className={`text-[0.875rem] font-medium ${sel ? 'text-on-surface' : 'text-on-surface-variant'}`}>{CATEGORY_LABELS[cat]}</span>
                </label>
              );
            })}
          </div>
          <button
            className="h-10 px-5 rounded-md text-[0.875rem] font-medium flex items-center justify-center gap-2 bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors"
            disabled={profileMutation.isPending}
            onClick={async () => {
              try {
                await profileMutation.mutateAsync({ accepted_categories: selectedCategories });
                showToast('Classifications updated.', 'success');
              } catch (e: any) {
                showToast(e.response?.data?.error?.message || 'Failed to update.', 'error');
              }
            }}>
            {profileMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Save categories'}
          </button>
        </SectionCard>

        {/* ── Add demand entry ── */}
        <SectionCard title="Urgent demand request" desc="Broadcast urgent requirements to the network. The matching algorithm heavily prioritizes explicit demands.">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-[0.8125rem] font-medium text-on-surface mb-2 block">Classification</label>
                <select {...demandForm.register('food_category')} className="w-full h-10 px-3 bg-surface-container-low border border-outline-variant rounded-md text-[0.875rem] text-on-surface focus:outline-none focus:border-primary transition-colors">
                  {FOOD_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[0.8125rem] font-medium text-on-surface mb-2 block">Required mass (kg)</label>
                <input {...demandForm.register('required_quantity_kg', { valueAsNumber: true })}
                  type="number" step="1" className="w-full h-10 px-3 bg-surface-container-low border border-outline-variant rounded-md text-[0.875rem] font-mono-data text-on-surface focus:outline-none focus:border-primary transition-colors" />
                {demandForm.formState.errors.required_quantity_kg && (
                  <p className="text-error text-[0.8125rem] mt-1">{demandForm.formState.errors.required_quantity_kg.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div>
                <label className="text-[0.8125rem] font-medium text-on-surface mb-2 block">Priority level</label>
                <select {...demandForm.register('priority')} className="w-full h-10 px-3 bg-surface-container-low border border-outline-variant rounded-md text-[0.875rem] text-on-surface focus:outline-none focus:border-primary transition-colors">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="text-[0.8125rem] font-medium text-on-surface mb-2 block">Expiration window</label>
                <input {...demandForm.register('valid_until')} type="datetime-local" className="w-full h-10 px-3 bg-surface-container-low border border-outline-variant rounded-md text-[0.875rem] font-mono-data text-on-surface focus:outline-none focus:border-primary transition-colors" />
                {demandForm.formState.errors.valid_until && (
                  <p className="text-error text-[0.8125rem] mt-1">{demandForm.formState.errors.valid_until.message}</p>
                )}
              </div>
            </div>
            <div className="pt-4">
              <button type="submit" className="h-10 px-5 rounded-md text-[0.875rem] font-medium flex items-center justify-center gap-2 bg-primary text-on-primary hover:bg-primary/90 transition-colors w-full sm:w-auto" disabled={demandMutation.isPending}>
                {demandMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Broadcast request'}
              </button>
            </div>
          </form>
        </SectionCard>

        {/* ── Profile info ── */}
        <SectionCard title="Node information" desc="Configure facility designation and operational parameters.">
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
              showToast('Node information updated.', 'success');
            } catch (e: any) {
              showToast(e.response?.data?.error?.message || 'Failed to update information.', 'error');
            }
          })} className="space-y-5">
            <div>
              <label className="text-[0.8125rem] font-medium text-on-surface mb-2 block">Node designation</label>
              <input {...profileForm.register('organisation_name')} className="w-full h-10 px-3 bg-surface-container-low border border-outline-variant rounded-md text-[0.875rem] text-on-surface focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="text-[0.8125rem] font-medium text-on-surface mb-2 block">Facility location</label>
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
            <div className="grid grid-cols-2 gap-5 pt-2">
              <div>
                <label className="text-[0.8125rem] font-medium text-on-surface mb-2 block">Operational start</label>
                <input {...profileForm.register('operating_start')} type="time" className="w-full h-10 px-3 bg-surface-container-low border border-outline-variant rounded-md text-[0.875rem] font-mono-data text-on-surface focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="text-[0.8125rem] font-medium text-on-surface mb-2 block">Operational end</label>
                <input {...profileForm.register('operating_end')} type="time" className="w-full h-10 px-3 bg-surface-container-low border border-outline-variant rounded-md text-[0.875rem] font-mono-data text-on-surface focus:outline-none focus:border-primary transition-colors" />
              </div>
            </div>
            <div className="pt-4">
              <button type="submit" className="h-10 px-5 rounded-md text-[0.875rem] font-medium flex items-center justify-center gap-2 bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Save changes'}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>
    </NGOLayout>
  );
}
