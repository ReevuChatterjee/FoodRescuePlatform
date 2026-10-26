/**
 * AdminDrivers — Admin view of all verified transport drivers and vehicle fleet.
 * Calls GET /api/v1/drivers
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, Search, ArrowRight, X, Mail, Navigation, Power } from 'lucide-react';
import { apiClient } from '../../api/client';
import { AdminLayout } from '../../components/layout/AdminLayout';
import type { DriverItem, SuccessEnvelope } from '../../types/api';

type StatusFilter = 'ALL' | 'AVAILABLE' | 'BUSY' | 'OFFLINE';
type CapacityFilter = 'ALL' | 'LIGHT' | 'MEDIUM' | 'HEAVY';

export function AdminDrivers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [capFilter, setCapFilter] = useState<CapacityFilter>('ALL');
  const [selectedDriver, setSelectedDriver] = useState<DriverItem | null>(null);

  const { data: allDrivers = [], isLoading } = useQuery({
    queryKey: ['admin', 'drivers'],
    queryFn: async () => {
      const { data } = await apiClient.get<SuccessEnvelope<DriverItem[]>>('/api/v1/drivers');
      return data.data;
    },
    refetchInterval: 5000, // refresh every 5s for live telemetry
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ driverId, status }: { driverId: string; status: string }) => {
      const { data } = await apiClient.patch(`/api/v1/drivers/${driverId}/status`, { status });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
      if (selectedDriver && selectedDriver.driver_id === variables.driverId) {
        setSelectedDriver((prev) => prev ? { ...prev, availability_status: variables.status as any } : null);
      }
    },
  });

  const stats = useMemo(() => {
    return allDrivers.reduce(
      (acc, d) => {
        acc.total++;
        if (d.availability_status === 'AVAILABLE') acc.available++;
        if (d.availability_status === 'BUSY') acc.busy++;
        if (d.availability_status === 'OFFLINE') acc.offline++;
        acc.totalCap += d.capacity_kg || 0;
        acc.totalRuns += d.completed_deliveries_count || 0;
        return acc;
      },
      { total: 0, available: 0, busy: 0, offline: 0, totalCap: 0, totalRuns: 0 }
    );
  }, [allDrivers]);

  const filtered = useMemo(() => {
    return allDrivers.filter((d) => {
      if (search) {
        const q = search.toLowerCase();
        const matchName = d.name?.toLowerCase().includes(q);
        const matchEmail = d.email?.toLowerCase().includes(q);
        const matchPhone = d.phone?.toLowerCase().includes(q);
        const matchVehicle = d.vehicle_id?.toLowerCase().includes(q);
        const matchDriverId = d.driver_id?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchVehicle && !matchDriverId) return false;
      }

      if (statusFilter !== 'ALL' && d.availability_status !== statusFilter) {
        return false;
      }

      const cap = d.capacity_kg || 0;
      if (capFilter === 'LIGHT' && cap > 100) return false;
      if (capFilter === 'MEDIUM' && (cap <= 100 || cap > 250)) return false;
      if (capFilter === 'HEAVY' && cap <= 250) return false;

      return true;
    });
  }, [allDrivers, search, statusFilter, capFilter]);

  return (
    <AdminLayout>
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface mb-1">Driver Registry</h1>
          <p className="text-[0.8125rem] font-medium text-on-surface-variant">
            Directory of verified fleet vehicles, telemetry, and transport capacity.
          </p>
        </div>
        <div className="flex gap-6 text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest font-mono-data border-l border-outline-variant pl-6">
          <span className="flex flex-col gap-0.5">
            <span>Total Fleet</span>
            <span className="text-sm text-on-surface">{stats.total.toString().padStart(2, '0')}</span>
          </span>
          <span className="flex flex-col gap-0.5">
            <span>Available</span>
            <span className="text-sm text-primary">{stats.available.toString().padStart(2, '0')}</span>
          </span>
          <span className="flex flex-col gap-0.5">
            <span>In Transit</span>
            <span className="text-sm text-warning">{stats.busy.toString().padStart(2, '0')}</span>
          </span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col xl:flex-row gap-4 mb-4">
        {/* Search */}
        <div className="relative w-full xl:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            className="w-full h-9 pl-9 pr-3 text-sm bg-surface-container-lowest border border-outline-variant/50 rounded-sm focus:outline-none focus:border-primary/50 text-on-surface placeholder:text-on-surface-variant/70"
            placeholder="Search driver / vehicle / phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Groups */}
        <div className="flex flex-wrap gap-4 flex-1">
          {/* Status */}
          <div className="flex items-center text-xs">
            <span className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-wider mr-3">Status</span>
            <div className="flex rounded-sm overflow-hidden border border-outline-variant/50">
              {(['ALL', 'AVAILABLE', 'BUSY', 'OFFLINE'] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 font-semibold transition-colors ${
                    statusFilter === f
                      ? 'bg-surface-container text-on-surface'
                      : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container/50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Capacity Tier */}
          <div className="flex items-center text-xs">
            <span className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-wider mr-3">Payload Tier</span>
            <div className="flex rounded-sm overflow-hidden border border-outline-variant/50">
              {(['ALL', 'LIGHT', 'MEDIUM', 'HEAVY'] as CapacityFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setCapFilter(f)}
                  className={`px-3 py-1.5 font-semibold transition-colors ${
                    capFilter === f
                      ? 'bg-surface-container text-on-surface'
                      : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container/50'
                  }`}
                >
                  {f === 'LIGHT' ? '<100kg' : f === 'MEDIUM' ? '100-250kg' : f === 'HEAVY' ? '>250kg' : 'ALL'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="border border-outline-variant/50 rounded-sm bg-surface-container-lowest overflow-hidden flex flex-col mb-4">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-[0.8125rem] min-w-[1000px]">
            <thead className="bg-surface-container-lowest border-b border-outline-variant/50 text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium">Vehicle ID</th>
                <th className="px-4 py-3 font-medium">Payload Capacity</th>
                <th className="px-4 py-3 font-medium">Telemetry Location</th>
                <th className="px-4 py-3 font-medium">Availability Status</th>
                <th className="px-4 py-3 font-medium">Completed Runs</th>
                <th className="px-4 py-3 font-medium">Active Assignment</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 font-mono-data text-[0.75rem]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-on-surface-variant">
                    <div className="flex justify-center">
                      <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <Truck size={24} className="text-on-surface-variant mb-3 opacity-50" />
                      <span className="text-sm font-semibold text-on-surface">No drivers found</span>
                      <span className="text-xs text-on-surface-variant mt-1">Adjust your filters to see more results.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((driver) => {
                  const isAvailable = driver.availability_status === 'AVAILABLE';
                  const isBusy = driver.availability_status === 'BUSY';

                  return (
                    <tr key={driver.driver_id} className="hover:bg-surface-container/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-on-surface font-sans">{driver.name || `Driver ${driver.driver_id.substring(0, 6)}`}</div>
                        <div className="text-[0.625rem] text-on-surface-variant opacity-70">
                          {driver.email || driver.phone || `ID: ${driver.driver_id.substring(0, 8)}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant font-mono-data">
                        <span className="px-2 py-0.5 rounded text-[0.6875rem] font-bold tracking-wide uppercase bg-surface-container text-on-surface">
                          {driver.vehicle_id || 'VEH-DEFAULT'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-on-surface">{driver.capacity_kg} kg</span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant truncate max-w-[180px]" title={driver.current_location}>
                        <div className="flex items-center gap-1.5">
                          <Navigation size={12} className={isAvailable ? 'text-primary' : 'text-on-surface-variant'} />
                          <span>{driver.current_location || '28.6273, 77.2190'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isAvailable ? (
                          <span className="text-primary font-bold text-[0.6875rem] uppercase tracking-wider flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" /> AVAILABLE
                          </span>
                        ) : isBusy ? (
                          <span className="text-warning font-bold text-[0.6875rem] uppercase tracking-wider flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" /> IN TRANSIT
                          </span>
                        ) : (
                          <span className="text-on-surface-variant font-bold text-[0.6875rem] uppercase tracking-wider flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-outline-variant" /> OFFLINE
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-on-surface">{driver.completed_deliveries_count || 0}</span>
                        <span className="text-on-surface-variant opacity-70 ml-1">runs</span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {driver.active_delivery_id ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.6875rem] font-bold bg-warning/10 text-warning">
                            Job: {driver.active_delivery_id.substring(0, 8)}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant opacity-50">Standing by</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedDriver(driver)}
                          className="text-primary font-bold text-xs hover:underline flex items-center justify-end gap-1 w-full opacity-70 group-hover:opacity-100 transition-opacity"
                        >
                          Manage <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Registry Summary ── */}
      <div className="flex flex-wrap items-center gap-8 bg-surface-container-lowest border border-outline-variant/50 p-4 rounded-sm text-xs font-mono-data text-on-surface-variant">
        <span><strong className="text-on-surface font-sans">{stats.total}</strong> registered fleet drivers</span>
        <span><strong className="text-on-surface font-sans">{stats.available}</strong> available for dispatch</span>
        <span><strong className="text-on-surface font-sans">{stats.totalCap} kg</strong> total transport capacity</span>
        <span><strong className="text-on-surface font-sans">{stats.totalRuns}</strong> completed delivery runs</span>
      </div>

      {/* ── Driver Telemetry / Details Modal ── */}
      {selectedDriver && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-md w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-outline-variant/40 bg-surface-container/20">
              <div>
                <h3 className="text-lg font-bold text-on-surface">
                  {selectedDriver.name || `Driver ${selectedDriver.driver_id.substring(0, 8)}`}
                </h3>
                <p className="text-xs text-on-surface-variant">Driver ID: {selectedDriver.driver_id}</p>
              </div>
              <button
                onClick={() => setSelectedDriver(null)}
                className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 flex flex-col gap-5 text-sm">
              <div className="grid grid-cols-2 gap-4 bg-surface-container/30 p-4 rounded border border-outline-variant/30">
                <div>
                  <span className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                    Vehicle Capacity
                  </span>
                  <span className="text-xl font-bold font-mono-data text-on-surface">
                    {selectedDriver.capacity_kg} kg
                  </span>
                  <span className="text-xs text-on-surface-variant block mt-0.5">
                    Vehicle: {selectedDriver.vehicle_id || 'Assigned default'}
                  </span>
                </div>
                <div>
                  <span className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                    Completed Runs
                  </span>
                  <span className="text-xl font-bold font-mono-data text-primary">
                    {selectedDriver.completed_deliveries_count || 0}
                  </span>
                  <span className="text-xs text-on-surface-variant block mt-0.5">
                    successful rescue deliveries
                  </span>
                </div>
              </div>

              {/* Information list */}
              <div className="flex flex-col gap-3 font-mono-data text-xs">
                <div className="flex items-start gap-2.5">
                  <Navigation size={14} className="text-on-surface-variant mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-on-surface-variant block text-[0.6875rem]">Latest GPS Coordinates</span>
                    <span className="text-on-surface font-sans font-medium">
                      {selectedDriver.current_location || '28.6273, 77.2190 (Janpath Hub)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Mail size={14} className="text-on-surface-variant mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-on-surface-variant block text-[0.6875rem]">Driver Contact</span>
                    <span className="text-on-surface font-sans font-medium">
                      {selectedDriver.email || 'Email not registered'} • {selectedDriver.phone || 'Phone not registered'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Truck size={14} className="text-on-surface-variant mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-on-surface-variant block text-[0.6875rem]">Current Assignment</span>
                    <span className="text-on-surface font-sans font-medium">
                      {selectedDriver.active_delivery_id
                        ? `Engaged in Delivery #${selectedDriver.active_delivery_id}`
                        : 'No active delivery job assigned (Available for dispatch)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Power size={14} className="text-on-surface-variant mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-on-surface-variant block text-[0.6875rem]">Dispatch Status</span>
                    <span className={`font-bold uppercase ${
                      selectedDriver.availability_status === 'AVAILABLE'
                        ? 'text-primary'
                        : selectedDriver.availability_status === 'BUSY'
                        ? 'text-warning'
                        : 'text-on-surface-variant'
                    }`}>
                      {selectedDriver.availability_status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex justify-between items-center border-t border-outline-variant/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant font-mono-data">Toggle Status:</span>
                  <button
                    onClick={() =>
                      toggleStatusMutation.mutate({
                        driverId: selectedDriver.driver_id,
                        status: selectedDriver.availability_status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE',
                      })
                    }
                    disabled={toggleStatusMutation.isPending || selectedDriver.availability_status === 'BUSY'}
                    className={`text-xs py-1.5 px-3 rounded font-bold border transition-colors ${
                      selectedDriver.availability_status === 'AVAILABLE'
                        ? 'bg-outline-variant/20 border-outline-variant text-on-surface hover:bg-outline-variant/40'
                        : 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/20'
                    }`}
                  >
                    {selectedDriver.availability_status === 'AVAILABLE' ? 'Set Offline' : 'Set Available'}
                  </button>
                </div>
                <button
                  onClick={() => setSelectedDriver(null)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
