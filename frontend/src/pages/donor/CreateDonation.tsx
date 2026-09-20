import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { apiClient } from '../../api/client';
import { DonorLayout } from '../../components/layout/DonorLayout';
import { LocationAutocomplete } from '../../components/common/LocationAutocomplete';

const ALLERGENS = ['Gluten', 'Dairy', 'Eggs', 'Nuts', 'Soy', 'Fish', 'Shellfish', 'Sesame'];

const schema = z.object({
  food_name: z.string().min(1, 'Food description is required'),
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
    message: "Use by time must be after ready time",
    path: ["expiry_time"],
  }
);

type FormValues = z.infer<typeof schema>;

const STEPS = [
  { id: 1, label: 'Payload' },
  { id: 2, label: 'Origin' },
  { id: 3, label: 'Handling & safety' },
];

const CATEGORY_OPTIONS = [
  { value: 'COOKED', label: 'Cooked food' },
  { value: 'RAW_PRODUCE', label: 'Raw produce' },
  { value: 'PACKAGED', label: 'Packaged / Sealed' },
  { value: 'BAKED_GOODS', label: 'Baked goods' },
  { value: 'DAIRY', label: 'Dairy products' },
  { value: 'MIXED', label: 'Mixed / Other' },
];

const TEMP_OPTIONS = [
  { value: 'ROOM_TEMP', label: 'Ambient (Room temp)' },
  { value: 'COLD', label: 'Cold storage (Refrigerated)' },
  { value: 'HOT', label: 'Thermal retention (Keep hot)' },
  { value: 'FROZEN', label: 'Deep freeze' },
];

const getLocalISOString = (ms: number) => {
  const date = new Date(ms);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

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
      prepared_at: getLocalISOString(Date.now() - 3600000),
      available_from: getLocalISOString(Date.now()),
      expiry_time: getLocalISOString(Date.now() + 10800000),
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
      <div className="max-w-[640px] mx-auto w-full">
        {/* Header */}
        <div className="mb-10 pb-6 border-b border-outline-variant/30">
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-on-surface mb-2">Create donation</h1>
          <p className="text-[0.9375rem] text-on-surface-variant">Add the food details, pickup location and handling information needed for matching.</p>
        </div>

        {/* Stepper */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 mb-12">
          {STEPS.map((s, idx) => {
            const isCompleted = step > s.id;
            const isCurrent = step === s.id;
            
            return (
              <div key={s.id} className="flex items-center gap-2">
                <span className={`text-[0.875rem] font-mono-data font-semibold ${isCompleted ? 'text-primary' : isCurrent ? 'text-primary underline underline-offset-4' : 'text-on-surface-variant'}`}>
                  0{s.id} — {s.label}
                </span>
                {idx < STEPS.length - 1 && (
                  <span className="text-outline-variant/30 ml-4 hidden sm:inline-block">/</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Error banner */}
        {mutation.isError && (
          <div className="mb-8 px-4 py-3 rounded border border-error/30 bg-error/10 text-error text-[0.875rem] font-medium">
             Failed to create donation. Please check your inputs.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-12">
            
            {/* ── Step 1: Payload ── */}
            {step === 1 && (
              <>
                <div>
                  <h3 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-widest mb-6 pb-2 border-b border-outline-variant/30">Donation details</h3>
                  <div className="space-y-5">
                    <div>
                      <label className="text-[0.8125rem] font-semibold text-on-surface mb-1.5 block">Food description</label>
                      <input {...register('food_name')} className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded text-[0.875rem] text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" placeholder="e.g. 50x Assorted sandwiches" />
                      {errors.food_name && <p className="text-[0.75rem] font-medium text-error mt-1.5">{errors.food_name.message}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="text-[0.8125rem] font-semibold text-on-surface mb-1.5 block">Food type</label>
                        <select {...register('food_category')} className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded text-[0.875rem] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                          {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[0.8125rem] font-semibold text-on-surface mb-1.5 block">Quantity (kg)</label>
                        <input {...register('quantity_kg', { valueAsNumber: true })} type="number" step="0.1" min="0.1"
                          className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded text-[0.875rem] font-mono-data font-medium text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="e.g. 15.5" />
                        {errors.quantity_kg && <p className="text-[0.75rem] font-medium text-error mt-1.5">{errors.quantity_kg.message}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-widest mb-6 pb-2 border-b border-outline-variant/30">Timing</h3>
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="text-[0.8125rem] font-semibold text-on-surface mb-1.5 block">Prepared</label>
                        <input {...register('prepared_at')} type="datetime-local" className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded text-[0.875rem] font-mono-data text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                        {errors.prepared_at && <p className="text-[0.75rem] font-medium text-error mt-1.5">{errors.prepared_at.message}</p>}
                      </div>
                      <div>
                        <label className="text-[0.8125rem] font-semibold text-on-surface mb-1.5 block">Ready for pickup</label>
                        <input {...register('available_from')} type="datetime-local" className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded text-[0.875rem] font-mono-data text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                        {errors.available_from && <p className="text-[0.75rem] font-medium text-error mt-1.5">{errors.available_from.message}</p>}
                      </div>
                    </div>
                    <div>
                      <label className="text-[0.8125rem] font-semibold text-on-surface mb-1.5 block">Use by</label>
                      <input {...register('expiry_time')} type="datetime-local" className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded text-[0.875rem] font-mono-data text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                      {errors.expiry_time && <p className="text-[0.75rem] font-medium text-error mt-1.5">{errors.expiry_time.message}</p>}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Step 2: Pickup Location ── */}
            {step === 2 && (
              <div>
                <h3 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-widest mb-6 pb-2 border-b border-outline-variant/30">Pickup location</h3>
                <div className="space-y-3">
                  <label className="text-[0.8125rem] font-semibold text-on-surface mb-1.5 block">Facility address</label>
                  <div className="bg-surface-container-lowest border border-outline-variant rounded focus-within:border-primary focus-within:ring-1 focus-within:ring-primary overflow-hidden">
                    <LocationAutocomplete
                      value={watch('pickup_location.address')}
                      onChange={(val) => setValue('pickup_location.address', val)}
                      onSelect={(addr, lat, lng) => {
                        setValue('pickup_location.address', addr);
                        setValue('pickup_location.latitude', lat);
                        setValue('pickup_location.longitude', lng);
                        trigger('pickup_location');
                      }}
                      placeholder="e.g. Loading bay 3, 42 MG Road, Bengaluru"
                    />
                  </div>
                  {errors.pickup_location?.address && <p className="text-[0.75rem] font-medium text-error mt-1.5">{errors.pickup_location.address.message}</p>}
                  
                  <p className="text-[0.8125rem] text-on-surface-variant mt-2">
                    Exact coordinates improve route matching and transit-time estimates.
                  </p>
                </div>
              </div>
            )}

            {/* ── Step 3: Safety & Handling ── */}
            {step === 3 && (
              <div>
                <h3 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-widest mb-6 pb-2 border-b border-outline-variant/30">Handling requirements</h3>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-[0.8125rem] font-semibold text-on-surface mb-1.5 block">Storage condition</label>
                      <select {...register('food_safety_info.storage_temp_required')} className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded text-[0.875rem] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                        {TEMP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[0.8125rem] font-semibold text-on-surface mb-1.5 block">Packaging</label>
                      <input {...register('food_safety_info.packaging_type')} className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded text-[0.875rem] text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        placeholder="e.g. Vacuum-sealed GN pans" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[0.8125rem] font-semibold text-on-surface mb-1.5 block">Special handling (Optional)</label>
                    <input {...register('special_handling')} className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded text-[0.875rem] text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      placeholder="e.g. Keep horizontal, do not stack" />
                  </div>

                  {/* Allergen chips */}
                  <div className="pt-4 border-t border-outline-variant/30">
                    <label className="text-[0.8125rem] font-semibold text-on-surface mb-3 block">Safety / allergen information</label>
                    <div className="flex flex-wrap gap-2">
                      {ALLERGENS.map((a) => {
                        const selected = allergens.includes(a);
                        return (
                          <button
                            key={a}
                            type="button"
                            onClick={() => setAllergens((prev) => selected ? prev.filter((x) => x !== a) : [...prev, a])}
                            className={`px-3 py-1.5 rounded-full text-[0.8125rem] font-medium border transition-colors
                              ${selected ? 'bg-error text-white border-error' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/50 hover:border-outline-variant hover:text-on-surface'}`}
                          >
                            {a}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between items-center mt-12 pt-6 border-t border-outline-variant/30">
            <button
              type="button"
              className="px-4 py-2 text-[0.875rem] font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded transition-colors"
              onClick={() => step === 1 ? navigate('/donor') : setStep((s) => s - 1)}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step < 3 ? (
              <button type="button" className="h-10 px-6 bg-primary text-on-primary rounded text-[0.875rem] font-medium hover:bg-primary/90 transition-colors" onClick={nextStep}>
                Continue
              </button>
            ) : (
              <button type="submit" className="h-10 px-6 bg-primary text-on-primary rounded text-[0.875rem] font-medium hover:bg-primary/90 transition-colors flex items-center justify-center min-w-[140px]" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Create donation'}
              </button>
            )}
          </div>
        </form>
      </div>
    </DonorLayout>
  );
}
