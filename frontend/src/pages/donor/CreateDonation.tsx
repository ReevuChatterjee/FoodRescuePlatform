/**
 * CreateDonation — multi-step donation form with allergen chips and validation.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, MapPin, Shield, ArrowLeft, ArrowRight, Loader2, X } from 'lucide-react';
import { apiClient } from '../../api/client';
import { AppLayout } from '../../components/layout/AppLayout';

const ALLERGENS = ['Gluten', 'Dairy', 'Eggs', 'Nuts', 'Soy', 'Fish', 'Shellfish', 'Sesame'];

const schema = z.object({
  food_name: z.string().min(1, 'Food name is required'),
  food_category: z.enum(['RAW_PRODUCE', 'COOKED', 'PACKAGED', 'BAKED_GOODS', 'DAIRY', 'MIXED']),
  quantity_kg: z.number().positive('Must be greater than 0'),
  prepared_at: z.string().min(1, 'Required'),
  available_from: z.string().min(1, 'Required'),
  expiry_time: z.string().min(1, 'Required'),
  pickup_location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().min(1, 'Address is required'),
  }),
  special_handling: z.string().nullable().optional(),
  food_safety_info: z.object({
    storage_temp_required: z.enum(['ROOM_TEMP', 'COLD', 'HOT', 'FROZEN']),
    allergen_tags: z.array(z.string()),
    packaging_type: z.string(),
  }).nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

const STEPS = [
  { id: 1, label: 'Food Details', icon: <Package size={16} /> },
  { id: 2, label: 'Pickup Location', icon: <MapPin size={16} /> },
  { id: 3, label: 'Safety & Handling', icon: <Shield size={16} /> },
];

const CATEGORY_OPTIONS = [
  { value: 'COOKED', label: 'Cooked Food' },
  { value: 'RAW_PRODUCE', label: 'Raw Produce' },
  { value: 'PACKAGED', label: 'Packaged / Sealed' },
  { value: 'BAKED_GOODS', label: 'Baked Goods' },
  { value: 'DAIRY', label: 'Dairy Products' },
  { value: 'MIXED', label: 'Mixed / Other' },
];

const TEMP_OPTIONS = [
  { value: 'ROOM_TEMP', label: 'Room Temperature' },
  { value: 'COLD', label: 'Cold (Refrigerated)' },
  { value: 'HOT', label: 'Hot (Keep warm)' },
  { value: 'FROZEN', label: 'Frozen' },
];

export function CreateDonation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [allergens, setAllergens] = useState<string[]>([]);

  const { register, handleSubmit, formState: { errors }, trigger } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      food_category: 'COOKED',
      quantity_kg: 1,
      pickup_location: { latitude: 28.7041, longitude: 77.1025, address: '' },
      food_safety_info: { storage_temp_required: 'ROOM_TEMP', allergen_tags: [], packaging_type: 'Box' },
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        prepared_at: new Date(data.prepared_at).toISOString(),
        available_from: new Date(data.available_from).toISOString(),
        expiry_time: new Date(data.expiry_time).toISOString(),
        food_safety_info: data.food_safety_info
          ? { ...data.food_safety_info, allergen_tags: allergens }
          : null,
      };
      const res = await apiClient.post('/api/v1/donations', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      navigate('/donor');
    },
  });

  const nextStep = async () => {
    const fields: (keyof FormValues)[][] = [
      ['food_name', 'food_category', 'quantity_kg', 'prepared_at', 'available_from', 'expiry_time'],
      ['pickup_location'],
      [],
    ];
    const ok = await trigger(fields[step - 1] as any);
    if (ok) setStep((s) => Math.min(s + 1, 3));
  };

  const onSubmit = (data: FormValues) => mutation.mutate(data);

  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Create Donation</h1>
          <p className="page-subtitle">List your surplus food for NGOs to receive</p>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/donor')}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <div className="max-w-2xl">
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-8">
          {STEPS.map((s, i) => {
            const isCompleted = step > s.id;
            const isCurrent = step === s.id;
            const isActive = isCompleted || isCurrent;
            return (
              <div key={s.id} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-sm flex items-center justify-center text-xs font-mono font-medium transition-colors ${isActive ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                    {s.id}
                  </div>
                  <span className={`text-xs font-medium uppercase tracking-wide hidden sm:block ${isActive ? 'text-zinc-100' : 'text-zinc-600'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px w-8 sm:w-12 transition-colors ${isCompleted ? 'bg-emerald-600' : 'bg-zinc-800'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Error banner */}
        {mutation.isError && (
          <div className="mb-6 px-4 py-3 rounded-sm border border-red-900 bg-red-950 text-red-400 text-sm font-medium">
            Failed to create donation. Please check your inputs.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="panel p-6">
            {/* ── Step 1: Food Details ── */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="form-label">Food name</label>
                  <input {...register('food_name')} className="input-base" placeholder="e.g. Assorted Sandwiches" />
                  {errors.food_name && <p className="form-error">{errors.food_name.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Category</label>
                    <select {...register('food_category')} className="select-base">
                      {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Quantity (kg)</label>
                    <input {...register('quantity_kg', { valueAsNumber: true })} type="number" step="0.1" min="0.1"
                      className="input-base tabular-nums" placeholder="e.g. 15.5" />
                    {errors.quantity_kg && <p className="form-error">{errors.quantity_kg.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">Prepared at</label>
                    <input {...register('prepared_at')} type="datetime-local" className="input-base tabular-nums" />
                    {errors.prepared_at && <p className="form-error">{errors.prepared_at.message}</p>}
                  </div>
                  <div>
                    <label className="form-label">Available from</label>
                    <input {...register('available_from')} type="datetime-local" className="input-base tabular-nums" />
                    {errors.available_from && <p className="form-error">{errors.available_from.message}</p>}
                  </div>
                  <div>
                    <label className="form-label">Expires at</label>
                    <input {...register('expiry_time')} type="datetime-local" className="input-base tabular-nums" />
                    {errors.expiry_time && <p className="form-error">{errors.expiry_time.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Pickup Location ── */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="form-label">Full pickup address</label>
                  <input {...register('pickup_location.address')} className="input-base"
                    placeholder="e.g. 42, MG Road, Bengaluru 560001" />
                  {errors.pickup_location?.address && <p className="form-error">{errors.pickup_location.address.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Latitude</label>
                    <input {...register('pickup_location.latitude', { valueAsNumber: true })} type="number" step="0.0001"
                      className="input-base tabular-nums" placeholder="e.g. 28.7041" />
                  </div>
                  <div>
                    <label className="form-label">Longitude</label>
                    <input {...register('pickup_location.longitude', { valueAsNumber: true })} type="number" step="0.0001"
                      className="input-base tabular-nums" placeholder="e.g. 77.1025" />
                  </div>
                </div>
                <div className="p-4 rounded-sm border border-zinc-800 bg-zinc-950 flex items-start gap-3">
                  <MapPin size={16} className="text-zinc-500 mt-0.5" />
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Ensure these coordinates are precise. Drivers rely on this for routing and ETAs.
                  </p>
                </div>
              </div>
            )}

            {/* ── Step 3: Safety & Handling ── */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="form-label">Special handling instructions</label>
                  <input {...register('special_handling')} className="input-base"
                    placeholder="e.g. Keep upright, refrigerate on arrival" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Storage temperature</label>
                    <select {...register('food_safety_info.storage_temp_required')} className="select-base">
                      {TEMP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Packaging type</label>
                    <input {...register('food_safety_info.packaging_type')} className="input-base"
                      placeholder="e.g. Sealed containers" />
                  </div>
                </div>

                {/* Allergen chips */}
                <div>
                  <label className="form-label">Allergen tags</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ALLERGENS.map((a) => {
                      const selected = allergens.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setAllergens((prev) => selected ? prev.filter((x) => x !== a) : [...prev, a])}
                          className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors flex items-center gap-1.5
                            ${selected ? 'bg-red-950 border-red-900 text-red-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
                        >
                          {selected && <X size={12} />}
                          {a}
                        </button>
                      );
                    })}
                  </div>
                  {allergens.length > 0 && (
                    <p className="text-xs font-medium text-amber-500 mt-3 flex items-center gap-2">
                      <Shield size={14} /> Contains: {allergens.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => step === 1 ? navigate('/donor') : setStep((s) => s - 1)}
            >
              <ArrowLeft size={16} /> {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step < 3 ? (
              <button type="button" className="btn-primary" onClick={nextStep}>
                Next <ArrowRight size={16} />
              </button>
            ) : (
              <button type="submit" className="btn-primary" disabled={mutation.isPending}>
                {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <>Submit Payload <ArrowRight size={16} /></>}
              </button>
            )}
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
