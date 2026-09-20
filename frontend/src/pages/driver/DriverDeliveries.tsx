import { DriverLayout } from '../../components/layout/DriverLayout';

export function DriverDeliveries() {
  return (
    <DriverLayout>
      <div className="p-6 md:p-10 max-w-[1200px] mx-auto">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-on-surface mb-8">Active Deliveries</h1>
        
        <div className="p-8 bg-surface-container-lowest border border-outline-variant/50 rounded flex flex-col items-center justify-center text-center">
          <p className="text-[0.9375rem] font-medium text-on-surface mb-1">No active deliveries</p>
          <p className="text-[0.875rem] text-on-surface-variant max-w-md">
            When you go on duty, any deliveries assigned to you will appear here and on your dashboard.
          </p>
        </div>
      </div>
    </DriverLayout>
  );
}
