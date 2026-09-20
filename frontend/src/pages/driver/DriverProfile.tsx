import { DriverLayout } from '../../components/layout/DriverLayout';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useCurrentJob } from '../../hooks/useDriver';

export function DriverProfile() {
  const { user } = useAuthStore();
  const { data } = useCurrentJob();
  const driver = data?.driver;

  return (
    <DriverLayout>
      <div className="p-6 md:p-10 max-w-[1200px] mx-auto">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-on-surface mb-8">Driver Profile</h1>
        
        <div className="max-w-2xl bg-surface-container-lowest border border-outline-variant/50 rounded overflow-hidden">
           <div className="p-6 border-b border-outline-variant/30">
              <h2 className="text-[1.125rem] font-semibold text-on-surface mb-1">Unit Identity</h2>
              <p className="text-[0.875rem] text-on-surface-variant">Account details and vehicle specifications.</p>
           </div>
           
           <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div>
                    <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Name</span>
                    <span className="text-[1rem] font-medium text-on-surface">{user?.name}</span>
                 </div>
                 <div>
                    <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Email</span>
                    <span className="text-[1rem] font-medium text-on-surface">{user?.email}</span>
                 </div>
                 <div>
                    <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Driver ID</span>
                    <span className="text-[0.875rem] font-mono-data text-on-surface">{user?.id}</span>
                 </div>
              </div>

              <div className="pt-6 border-t border-outline-variant/30">
                 <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Vehicle Capacity</span>
                 <span className="text-[1rem] font-medium text-on-surface">
                   {driver ? `${driver.capacity_kg.toFixed(1)} kg` : 'Loading...'}
                 </span>
              </div>
           </div>
        </div>
      </div>
    </DriverLayout>
  );
}
