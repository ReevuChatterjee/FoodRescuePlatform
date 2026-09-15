import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

const createDonationSchema = z.object({
  food_name: z.string().min(1, 'Food name is required'),
  food_category: z.enum(['RAW_PRODUCE', 'COOKED', 'PACKAGED', 'BAKED_GOODS', 'DAIRY', 'MIXED']),
  quantity_kg: z.number().positive('Quantity must be greater than 0'),
  prepared_at: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  available_from: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  expiry_time: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  pickup_location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().min(1, 'Address is required')
  }),
  special_handling: z.string().nullable().optional(),
  food_safety_info: z.object({
    storage_temp_required: z.enum(['ROOM_TEMP', 'COLD', 'HOT', 'FROZEN']),
    allergen_tags: z.array(z.string()),
    packaging_type: z.string()
  }).nullable().optional()
});

type CreateDonationFormValues = z.infer<typeof createDonationSchema>;

export function CreateDonation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, formState: { errors } } = useForm<CreateDonationFormValues>({
    resolver: zodResolver(createDonationSchema),
    defaultValues: {
      food_category: 'COOKED',
      quantity_kg: 1,
      pickup_location: {
        latitude: 28.7041,
        longitude: 77.1025,
        address: ''
      },
      food_safety_info: {
        storage_temp_required: 'ROOM_TEMP',
        allergen_tags: [],
        packaging_type: 'BOX'
      }
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: CreateDonationFormValues) => {
      // Ensure timestamps are ISO-8601 UTC
      const payload = {
        ...data,
        prepared_at: new Date(data.prepared_at).toISOString(),
        available_from: new Date(data.available_from).toISOString(),
        expiry_time: new Date(data.expiry_time).toISOString(),
      };
      const response = await apiClient.post('/api/v1/donations', payload);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      navigate('/donor');
    }
  });

  const onSubmit = (data: CreateDonationFormValues) => {
    mutation.mutate(data);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow border border-gray-200">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Create New Donation</h2>
      
      {mutation.isError && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
          Failed to create donation. Please check your inputs.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Food Name</label>
          <input type="text" {...register('food_name')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" />
          {errors.food_name && <p className="text-red-500 text-xs mt-1">{errors.food_name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <select {...register('food_category')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2">
              <option value="RAW_PRODUCE">Raw Produce</option>
              <option value="COOKED">Cooked</option>
              <option value="PACKAGED">Packaged</option>
              <option value="BAKED_GOODS">Baked Goods</option>
              <option value="DAIRY">Dairy</option>
              <option value="MIXED">Mixed</option>
            </select>
            {errors.food_category && <p className="text-red-500 text-xs mt-1">{errors.food_category.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Quantity (kg)</label>
            <input type="number" step="0.1" {...register('quantity_kg', { valueAsNumber: true })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" />
            {errors.quantity_kg && <p className="text-red-500 text-xs mt-1">{errors.quantity_kg.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Prepared At</label>
            <input type="datetime-local" {...register('prepared_at')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" />
            {errors.prepared_at && <p className="text-red-500 text-xs mt-1">{errors.prepared_at.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Available From</label>
            <input type="datetime-local" {...register('available_from')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" />
            {errors.available_from && <p className="text-red-500 text-xs mt-1">{errors.available_from.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Expiry Time</label>
            <input type="datetime-local" {...register('expiry_time')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" />
            {errors.expiry_time && <p className="text-red-500 text-xs mt-1">{errors.expiry_time.message}</p>}
          </div>
        </div>

        <div className="space-y-4 border-t border-gray-200 pt-4">
          <h3 className="text-lg font-medium text-gray-900">Pickup Location</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <input type="text" {...register('pickup_location.address')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" />
            {errors.pickup_location?.address && <p className="text-red-500 text-xs mt-1">{errors.pickup_location.address.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4 hidden">
             {/* Hidden for simplicity, using defaults */}
            <input type="number" step="0.0001" {...register('pickup_location.latitude', { valueAsNumber: true })} />
            <input type="number" step="0.0001" {...register('pickup_location.longitude', { valueAsNumber: true })} />
          </div>
        </div>

        <div className="space-y-4 border-t border-gray-200 pt-4">
          <h3 className="text-lg font-medium text-gray-900">Food Safety & Handling</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700">Special Handling Instructions</label>
            <input type="text" {...register('special_handling')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Storage Temp</label>
              <select {...register('food_safety_info.storage_temp_required')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2">
                <option value="ROOM_TEMP">Room Temp</option>
                <option value="COLD">Cold</option>
                <option value="HOT">Hot</option>
                <option value="FROZEN">Frozen</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Packaging Type</label>
              <input type="text" {...register('food_safety_info.packaging_type')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={() => navigate('/donor')}
            className="mr-4 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating...' : 'Create Donation'}
          </button>
        </div>
      </form>
    </div>
  );
}
