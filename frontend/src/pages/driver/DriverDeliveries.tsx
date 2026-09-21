import { DriverLayout } from '../../components/layout/DriverLayout';
import { useDriverDeliveries } from '../../hooks/useDriver';
import { Loader2, MapPin, Package, Clock } from 'lucide-react';

export function DriverDeliveries() {
  const { data: deliveries, isLoading } = useDriverDeliveries('active');

  return (
    <DriverLayout>
      <div className="p-6 md:p-10 max-w-[1200px] mx-auto">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-on-surface mb-8">Active Deliveries</h1>
        
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : deliveries && deliveries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deliveries.map((delivery) => (
              <div key={delivery.delivery_id} className="bg-surface-container-lowest border border-outline-variant/50 rounded p-6 shadow-sm flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-[1.125rem] font-semibold text-on-surface">{delivery.food_name}</h3>
                    <p className="text-[0.875rem] text-on-surface-variant font-mono-data mt-1">{delivery.quantity_kg} kg • {delivery.food_category}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-primary/10 text-primary text-[0.75rem] font-bold tracking-wide rounded-full uppercase">
                    {delivery.status.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="space-y-4 flex-grow">
                  <div className="flex gap-3">
                    <MapPin size={18} className="text-on-surface-variant shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[0.75rem] font-semibold text-on-surface uppercase tracking-wider mb-0.5">Pickup</p>
                      <p className="text-[0.875rem] text-on-surface-variant">{delivery.pickup_address || 'Address pending'}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Package size={18} className="text-on-surface-variant shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[0.75rem] font-semibold text-on-surface uppercase tracking-wider mb-0.5">Dropoff</p>
                      <p className="text-[0.875rem] text-on-surface-variant">{delivery.ngo_name || 'Pending NGO'}</p>
                      <p className="text-[0.875rem] text-on-surface-variant">{delivery.dropoff_address || 'Address pending'}</p>
                    </div>
                  </div>
                  
                  {delivery.estimated_delivery_time && (
                    <div className="flex gap-3">
                      <Clock size={18} className="text-on-surface-variant shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[0.75rem] font-semibold text-on-surface uppercase tracking-wider mb-0.5">Estimated Dropoff</p>
                        <p className="text-[0.875rem] text-on-surface-variant">
                          {new Date(delivery.estimated_delivery_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 bg-surface-container-lowest border border-outline-variant/50 rounded flex flex-col items-center justify-center text-center">
            <p className="text-[0.9375rem] font-medium text-on-surface mb-1">No active deliveries</p>
            <p className="text-[0.875rem] text-on-surface-variant max-w-md">
              When you go on duty, any deliveries assigned to you will appear here and on your dashboard.
            </p>
          </div>
        )}
      </div>
    </DriverLayout>
  );
}
