import { AdminLayout } from '../../components/layout/AdminLayout';
import { HardHat } from 'lucide-react';

export function AdminTraceability() {
  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface mb-1">Traceability</h1>
          <p className="text-[0.8125rem] font-medium text-on-surface-variant">Immutable ledger of all completed food rescue operations.</p>
        </div>
      </div>
      <div className="border border-outline-variant/50 rounded-sm bg-surface-container-lowest overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
        <HardHat size={32} className="text-on-surface-variant mb-4 opacity-50" />
        <span className="text-sm font-semibold text-on-surface">Module Under Construction</span>
        <span className="text-xs text-on-surface-variant mt-1">This operational view is currently being implemented.</span>
      </div>
    </AdminLayout>
  );
}
