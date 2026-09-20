import { DriverLayout } from '../../components/layout/DriverLayout';

export function DriverHistory() {
  return (
    <DriverLayout>
      <div className="p-6 md:p-10 max-w-[1200px] mx-auto">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-on-surface mb-8">Delivery History</h1>
        
        <div className="p-8 bg-surface-container-lowest border border-outline-variant/50 rounded flex flex-col items-center justify-center text-center">
          <p className="text-[0.9375rem] font-medium text-on-surface mb-1">No past deliveries</p>
          <p className="text-[0.875rem] text-on-surface-variant max-w-md">
            Once you complete a pickup and handoff, the delivery record will appear in this ledger.
          </p>
        </div>
      </div>
    </DriverLayout>
  );
}
