import { DriverLayout } from '../../components/layout/DriverLayout';
import { useDriverDeliveries } from '../../hooks/useDriver';
import { Loader2, Calendar, CheckCircle2, XCircle } from 'lucide-react';

export function DriverHistory() {
  const { data: deliveries, isLoading } = useDriverDeliveries('history');

  return (
    <DriverLayout>
      <div className="p-6 md:p-10 max-w-[1200px] mx-auto">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-on-surface mb-8">Delivery History</h1>
        
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : deliveries && deliveries.length > 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant/50 rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/30 bg-surface-container-lowest/50">
                    <th className="py-4 px-6 text-[0.8125rem] font-semibold text-on-surface-variant uppercase tracking-wider">Date</th>
                    <th className="py-4 px-6 text-[0.8125rem] font-semibold text-on-surface-variant uppercase tracking-wider">Food Item</th>
                    <th className="py-4 px-6 text-[0.8125rem] font-semibold text-on-surface-variant uppercase tracking-wider">Quantity</th>
                    <th className="py-4 px-6 text-[0.8125rem] font-semibold text-on-surface-variant uppercase tracking-wider">Recipient NGO</th>
                    <th className="py-4 px-6 text-[0.8125rem] font-semibold text-on-surface-variant uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {deliveries.map((delivery) => {
                    const isSuccess = delivery.status === 'DELIVERED' || delivery.status === 'PARTIALLY_DELIVERED';
                    return (
                      <tr key={delivery.delivery_id} className="hover:bg-surface-container-lowest/80 transition-colors">
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-[0.875rem] text-on-surface">
                            <Calendar size={16} className="text-on-surface-variant shrink-0" />
                            {delivery.actual_delivery_time 
                              ? new Date(delivery.actual_delivery_time).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                              : 'Unknown'}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-[0.875rem] font-medium text-on-surface">{delivery.food_name}</p>
                          <p className="text-[0.75rem] text-on-surface-variant">{delivery.food_category}</p>
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="font-mono-data text-[0.875rem] text-on-surface">{delivery.quantity_kg} kg</span>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-[0.875rem] text-on-surface">{delivery.ngo_name || 'N/A'}</p>
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.75rem] font-bold tracking-wide uppercase ${
                            isSuccess ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'
                          }`}>
                            {isSuccess ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                            {delivery.status.replace('_', ' ')}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-8 bg-surface-container-lowest border border-outline-variant/50 rounded flex flex-col items-center justify-center text-center">
            <p className="text-[0.9375rem] font-medium text-on-surface mb-1">No past deliveries</p>
            <p className="text-[0.875rem] text-on-surface-variant max-w-md">
              Once you complete a pickup and handoff, the delivery record will appear in this ledger.
            </p>
          </div>
        )}
      </div>
    </DriverLayout>
  );
}
