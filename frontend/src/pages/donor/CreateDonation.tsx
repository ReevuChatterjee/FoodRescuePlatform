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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-on-surface mb-1">Generate Dispatch Payload</h1>
          <p className="text-sm font-medium text-on-surface-variant">Submit surplus food specifications to the routing network.</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-md font-semibold text-sm transition-colors border border-outline-variant" onClick={() => navigate('/donor')}>
          <ArrowLeft size={16} /> Abort Entry
        </button>
      </div>

      <div className="max-w-3xl mx-auto w-full mt-6">
        {/* Tracker */}
        <div className="mb-10 bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex items-center justify-between relative shadow-sm">
          {/* Connecting line */}
          <div className="absolute top-1/2 left-8 right-8 h-px bg-outline-variant -translate-y-1/2 z-0 hidden sm:block"></div>
          
          {STEPS.map((s) => {
            const isCompleted = step > s.id;
            const isCurrent = step === s.id;
            
            return (
              <div key={s.id} className="relative z-10 flex flex-col items-center gap-3 bg-surface-container-lowest px-4">
                <div 
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors border-2 ${
                    isCurrent ? 'bg-primary-container text-on-primary-container border-primary-container shadow-sm' 
                    : isCompleted ? 'bg-success text-on-primary border-success shadow-sm' 
                    : 'bg-surface text-outline-variant border-outline-variant'
                  }`}
                >
                  {s.icon}
                </div>
                <div className="flex flex-col items-center">
                   <span className="text-[0.625rem] font-bold tracking-wider uppercase font-mono-data text-outline">STEP 0{s.id}</span>
                   <span className={`text-xs font-bold tracking-tight mt-0.5 ${isCurrent ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                     {s.label}
                   </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error banner */}
        {mutation.isError && (
          <div className="mb-6 px-4 py-3 rounded-md border border-error/30 bg-error/5 text-error text-sm font-bold tracking-wide flex items-center gap-2">
             <Info size={16} /> Transaction failed. Review input constraints.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-surface-container-lowest p-8 border border-outline-variant rounded-xl shadow-sm">
            {/* ── Step 1: Food Details ── */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant mb-2">Payload Designation</label>
                  <input {...register('food_name')} className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-md text-sm font-medium text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary transition-shadow outline-none" placeholder="e.g. 50x Assorted Sandwiches" />
                  {errors.food_name && <p className="text-xs font-semibold text-error mt-1.5">{errors.food_name.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant mb-2">Classification</label>
                    <select {...register('food_category')} className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-md text-sm font-medium text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                      {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant mb-2">Net Mass (kg)</label>
                    <input {...register('quantity_kg', { valueAsNumber: true })} type="number" step="0.1" min="0.1"
                      className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-md text-sm font-bold font-mono-data text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="e.g. 15.5" />
                    {errors.quantity_kg && <p className="text-xs font-semibold text-error mt-1.5">{errors.quantity_kg.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 border-t border-outline-variant pt-6 mt-2">
                  <div>
                    <label className="block text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant mb-2">Preparation Time</label>
                    <input {...register('prepared_at')} type="datetime-local" className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-md text-[0.8125rem] font-bold font-mono-data text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                    {errors.prepared_at && <p className="text-xs font-semibold text-error mt-1.5">{errors.prepared_at.message}</p>}
                  </div>
                  <div>
                    <label className="block text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant mb-2">Ready for Transit</label>
                    <input {...register('available_from')} type="datetime-local" className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-md text-[0.8125rem] font-bold font-mono-data text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                    {errors.available_from && <p className="text-xs font-semibold text-error mt-1.5">{errors.available_from.message}</p>}
                  </div>
                  <div>
                    <label className="block text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant mb-2">Critical Expiration</label>
                    <input {...register('expiry_time')} type="datetime-local" className="w-full h-11 px-3 bg-error/5 border border-error/30 rounded-md text-[0.8125rem] font-bold font-mono-data text-error focus:border-error focus:ring-1 focus:ring-error outline-none" />
                    {errors.expiry_time && <p className="text-xs font-semibold text-error mt-1.5">{errors.expiry_time.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Pickup Location ── */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant mb-2">Facility Address</label>
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
                  {errors.pickup_location?.address && <p className="text-xs font-semibold text-error mt-1.5">{errors.pickup_location.address.message}</p>}
                </div>
                <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 flex items-start gap-3 mt-4">
                  <MapPin size={16} className="text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium text-primary leading-relaxed">
                     Provide exact geographic coordinates. The algorithmic dispatch engine relies on this precision to minimize transit times.
                  </p>
                </div>
              </div>
            )}

            {/* ── Step 3: Safety & Handling ── */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant mb-2">Thermal Constraints</label>
                    <select {...register('food_safety_info.storage_temp_required')} className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-md text-sm font-medium text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                      {TEMP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant mb-2">Enclosure Specs</label>
                    <input {...register('food_safety_info.packaging_type')} className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-md text-sm font-medium text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      placeholder="e.g. Vacuum-sealed GN pans" />
                  </div>
                </div>

                <div className="border-t border-outline-variant pt-6 mt-2">
                  <label className="block text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant mb-2">Handling Directives (Optional)</label>
                  <input {...register('special_handling')} className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-md text-sm font-medium text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. DO NOT STACK. Keep horizontal." />
                </div>

                {/* Allergen chips */}
                <div className="bg-surface-container border border-outline-variant p-5 rounded-lg mt-6 shadow-sm">
                  <label className="block text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant mb-4">Identify Contaminants / Allergens</label>
                  <div className="flex flex-wrap gap-2.5">
                    {ALLERGENS.map((a) => {
                      const selected = allergens.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setAllergens((prev) => selected ? prev.filter((x) => x !== a) : [...prev, a])}
                          className={`px-3.5 py-2 rounded-full text-[0.8125rem] font-bold tracking-tight border transition-all flex items-center gap-1.5 shadow-sm
                            ${selected ? 'bg-error text-white border-error' : 'bg-surface-container-lowest border-outline-variant text-on-surface hover:border-outline hover:bg-surface'}`}
                        >
                          {selected && <X size={14} />}
                          {a}
                        </button>
                      );
                    })}
                  </div>
                  {allergens.length > 0 && (
                    <div className="mt-5 p-3 bg-error/10 border border-error/20 rounded-md">
                       <p className="text-xs font-bold tracking-wider uppercase text-error flex items-center gap-2">
                         <Shield size={16} /> IDENTIFIED: {allergens.join(', ')}
                       </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between items-center mt-8">
            <button
              type="button"
              className="px-6 py-2.5 rounded-md text-sm font-bold text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-2 hover:bg-surface-container"
              onClick={() => step === 1 ? navigate('/donor') : setStep((s) => s - 1)}
            >
              <ArrowLeft size={16} /> {step === 1 ? 'Cancel Entry' : 'Previous Step'}
            </button>

            {step < 3 ? (
              <button type="button" className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-on-primary rounded-md font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm" onClick={nextStep}>
                Next Phase <ArrowRight size={16} />
              </button>
            ) : (
              <button type="submit" className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-on-primary rounded-md font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm" disabled={mutation.isPending}>
                {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <>Transmit Payload <Package size={16} /></>}
              </button>
            )}
          </div>
        </form>
      </div>
    </DonorLayout>
  );
}

