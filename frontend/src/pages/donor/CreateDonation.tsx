/**
 * CreateDonation — multi-step donation form with allergen chips and validation.
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Package, MapPin, Shield, ArrowLeft, ArrowRight, Loader2, X, Info } from 'lucide-react';
import { apiClient } from '../../api/client';
import { DonorLayout } from '../../components/layout/DonorLayout';
import { LocationAutocomplete } from '../../components/common/LocationAutocomplete';

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
}).refine(
  (data) => new Date(data.expiry_time) > new Date(data.available_from),
  {
    message: "Expiry time must be after ready time",
    path: ["expiry_time"],
  }
);

type FormValues = z.infer<typeof schema>;

const STEPS = [
  { id: 1, label: 'Payload Manifest', icon: <Package size={16} /> },
  { id: 2, label: 'Origin Coordinates', icon: <MapPin size={16} /> },
  { id: 3, label: 'Handling & Safety', icon: <Shield size={16} /> },
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
  { value: 'ROOM_TEMP', label: 'Ambient (Room Temp)' },
  { value: 'COLD', label: 'Cold Storage (Refrigerated)' },
  { value: 'HOT', label: 'Thermal Retention (Keep Hot)' },
  { value: 'FROZEN', label: 'Deep Freeze' },
];

export function CreateDonation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [allergens, setAllergens] = useState<string[]>([]);

  const { data: userProfile } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/auth/me');
      return res.data.data;
    },
    staleTime: Infinity,
  });

  const { register, handleSubmit, formState: { errors }, trigger, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      food_category: 'COOKED',
      quantity_kg: 10,
      prepared_at: new Date(Date.now() - 3600000).toISOString().slice(0, 16),
      available_from: new Date().toISOString().slice(0, 16),
      expiry_time: new Date(Date.now() + 10800000).toISOString().slice(0, 16),
      pickup_location: { latitude: undefined as unknown as number, longitude: undefined as unknown as number, address: '' },
      food_safety_info: { storage_temp_required: 'ROOM_TEMP', allergen_tags: [], packaging_type: 'Box' },
    },
  });

  useEffect(() => {
    if (userProfile?.donor_address && userProfile?.donor_location) {
      const parts = userProfile.donor_location.split(',');
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        if (!watch('pickup_location.address')) {
          setValue('pickup_location.address', userProfile.donor_address);
          setValue('pickup_location.latitude', lat);
          setValue('pickup_location.longitude', lon);
        }
      }
    }
  }, [userProfile, setValue, watch]);

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
    <DonorLayout>
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title">Generate Dispatch Payload</h1>
          <p className="page-subtitle">Submit surplus food specifications to the routing network.</p>
        </div>
        <button className="btn-secondary px-4 py-2" onClick={() => navigate('/donor')}>
          <ArrowLeft size={16} /> Abort Entry
        </button>
      </div>

      <div className="max-w-3xl mx-auto w-full mt-6">
        {/* Tracker */}
        <div className="mb-10 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-md p-4 flex items-center justify-between relative shadow-sm">
          {/* Connecting line */}
          <div className="absolute top-1/2 left-8 right-8 h-px bg-[var(--border-strong)] -translate-y-1/2 z-0 hidden sm:block"></div>
          
          {STEPS.map((s) => {
            const isCompleted = step > s.id;
            const isCurrent = step === s.id;
            
            return (
              <div key={s.id} className="relative z-10 flex flex-col items-center gap-2 bg-[var(--bg-panel)] px-2">
                <div 
                  className={`w-8 h-8 rounded-sm flex items-center justify-center transition-colors border ${
                    isCurrent ? 'bg-[var(--brand)] text-black border-[var(--brand)]' 
                    : isCompleted ? 'bg-[var(--success)] text-white border-[var(--success)]' 
                    : 'bg-[var(--bg-page)] text-[var(--text-muted)] border-[var(--border-strong)]'
                  }`}
                >
                  {s.icon}
                </div>
                <div className="flex flex-col items-center">
                   <span className="text-[10px] font-mono-data text-[var(--text-muted)]">STEP 0{s.id}</span>
                   <span className={`text-xs font-semibold tracking-wide uppercase mt-0.5 ${isCurrent ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                     {s.label}
                   </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error banner */}
        {mutation.isError && (
          <div className="mb-6 px-4 py-3 rounded-md border border-[var(--error)]/20 bg-[var(--error)]/10 text-[var(--error)] text-sm font-semibold tracking-wide flex items-center gap-2">
             <Info size={16} /> Transaction failed. Review input constraints.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="panel p-6 border-[var(--border-strong)] bg-[var(--bg-page)] shadow-sm">
            {/* ── Step 1: Food Details ── */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="form-label">Payload Designation</label>
                  <input {...register('food_name')} className="input-base" placeholder="e.g. 50x Assorted Sandwiches" />
                  {errors.food_name && <p className="form-error">{errors.food_name.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Classification</label>
                    <select {...register('food_category')} className="select-base">
                      {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Net Mass (kg)</label>
                    <input {...register('quantity_kg', { valueAsNumber: true })} type="number" step="0.1" min="0.1"
                      className="input-base font-mono-data" placeholder="e.g. 15.5" />
                    {errors.quantity_kg && <p className="form-error">{errors.quantity_kg.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[var(--border-subtle)] pt-6 mt-2">
                  <div>
                    <label className="form-label">Preparation Time</label>
                    <input {...register('prepared_at')} type="datetime-local" className="input-base font-mono-data text-sm" />
                    {errors.prepared_at && <p className="form-error">{errors.prepared_at.message}</p>}
                  </div>
                  <div>
                    <label className="form-label">Ready for Transit</label>
                    <input {...register('available_from')} type="datetime-local" className="input-base font-mono-data text-sm" />
                    {errors.available_from && <p className="form-error">{errors.available_from.message}</p>}
                  </div>
                  <div>
                    <label className="form-label">Critical Expiration</label>
                    <input {...register('expiry_time')} type="datetime-local" className="input-base font-mono-data text-sm text-[var(--warning)]" />
                    {errors.expiry_time && <p className="form-error">{errors.expiry_time.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Pickup Location ── */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="form-label">Facility Address</label>
                  <LocationAutocomplete
                    value={watch('pickup_location.address')}
                    onChange={(val) => setValue('pickup_location.address', val)}
                    onSelect={(addr, lat, lng) => {
                      setValue('pickup_location.address', addr);
                      setValue('pickup_location.latitude', lat);
                      setValue('pickup_location.longitude', lng);
                      trigger('pickup_location');
                    }}
                    placeholder="e.g. Loading Bay 3, 42 MG Road, Bengaluru"
                  />
                  {errors.pickup_location?.address && <p className="form-error">{errors.pickup_location.address.message}</p>}
                </div>
                <div className="p-4 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-panel)] flex items-start gap-3 mt-4">
                  <MapPin size={16} className="text-[var(--brand)] mt-0.5" />
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                     Provide exact geographic coordinates. The algorithmic dispatch engine relies on this precision to minimize transit times.
                  </p>
                </div>
              </div>
            )}

            {/* ── Step 3: Safety & Handling ── */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Thermal Constraints</label>
                    <select {...register('food_safety_info.storage_temp_required')} className="select-base">
                      {TEMP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Enclosure Specs</label>
                    <input {...register('food_safety_info.packaging_type')} className="input-base"
                      placeholder="e.g. Vacuum-sealed GN pans" />
                  </div>
                </div>

                <div className="border-t border-[var(--border-subtle)] pt-6 mt-2">
                  <label className="form-label">Handling Directives (Optional)</label>
                  <input {...register('special_handling')} className="input-base"
                    placeholder="e.g. DO NOT STACK. Keep horizontal." />
                </div>

                {/* Allergen chips */}
                <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-4 rounded-sm mt-4">
                  <label className="form-label mb-3 block">Identify Contaminants / Allergens</label>
                  <div className="flex flex-wrap gap-2">
                    {ALLERGENS.map((a) => {
                      const selected = allergens.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setAllergens((prev) => selected ? prev.filter((x) => x !== a) : [...prev, a])}
                          className={`px-3 py-1.5 rounded-sm text-xs font-semibold tracking-wide border transition-all flex items-center gap-1.5
                            ${selected ? 'bg-[var(--error)] text-black border-[var(--error)] shadow-sm' : 'bg-[var(--bg-page)] border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'}`}
                        >
                          {selected && <X size={12} />}
                          {a}
                        </button>
                      );
                    })}
                  </div>
                  {allergens.length > 0 && (
                    <div className="mt-4 p-2 bg-[var(--error)]/10 border border-[var(--error)]/20 rounded-sm">
                       <p className="text-xs font-semibold tracking-wide text-[var(--error)] flex items-center gap-2">
                         <Shield size={14} /> IDENTIFIED: {allergens.join(', ')}
                       </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between items-center mt-6">
            <button
              type="button"
              className="px-6 py-2.5 rounded-sm text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-2"
              onClick={() => step === 1 ? navigate('/donor') : setStep((s) => s - 1)}
            >
              <ArrowLeft size={16} /> {step === 1 ? 'Cancel Entry' : 'Previous Step'}
            </button>

            {step < 3 ? (
              <button type="button" className="btn-primary px-8 py-2.5 flex items-center gap-2" onClick={nextStep}>
                Next Phase <ArrowRight size={16} />
              </button>
            ) : (
              <button type="submit" className="btn-primary px-8 py-2.5 flex items-center gap-2 bg-[var(--brand)] text-black shadow-sm" disabled={mutation.isPending}>
                {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <>Transmit Payload <Package size={16} /></>}
              </button>
            )}
          </div>
        </form>
      </div>
    </DonorLayout>
  );
}

