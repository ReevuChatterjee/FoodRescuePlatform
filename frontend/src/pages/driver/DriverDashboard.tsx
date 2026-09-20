import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Navigation, Radio, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '../../api/client';
import { DriverLayout } from '../../components/layout/DriverLayout';
import { DriverRouteMap } from '../../components/driver/DriverRouteMap';
import { JobActions } from '../../components/driver/JobActions';
import { JobCard } from '../../components/driver/JobCard';
import { apiErrorMessage, useCurrentJob, useSetAvailability } from '../../hooks/useDriver';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { useDriverWebSocket } from '../../hooks/useDriverWebSocket';
import { useAuthStore } from '../../hooks/useAuthStore';
import { LocationAutocomplete } from '../../components/common/LocationAutocomplete';

const SOPS = [
  'Confirm payload and quantity before pickup.',
  'Check pickup location and confirm packaging.',
  'Confirm recipient and record handoff at destination.',
  'Upload verification if required by the NGO.',
];

export function DriverDashboard() {
  const { user } = useAuthStore();
  const { data, isLoading, isError, error, refetch } = useCurrentJob();
  const driver = data?.driver;
  const job = data?.job ?? null;

  const streaming = !!job || driver?.availability_status === 'AVAILABLE';
  const location = useDriverLocation(streaming);
  useDriverWebSocket(job?.delivery_id);
  const setAvailability = useSetAvailability();

  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [address, setAddress] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const [sopOpen, setSopOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const locationMutation = useMutation({
    mutationFn: async ({ latitude, longitude }: { latitude: number; longitude: number }) => {
      const res = await apiClient.post('/api/v1/drivers/location', { latitude, longitude });
      return res.data;
    },
    onSuccess: () => {
      showToast('Location transmitted.', 'success');
      setBroadcastSuccess(true);
      setTimeout(() => setBroadcastSuccess(false), 4000);
    },
    onError: (e: any) =>
      showToast(e.response?.data?.error?.message || 'Transmission failed.', 'error'),
  });

  const useGPS = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported.', 'error');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setAddress('Current GPS Location');
        setGpsLoading(false);
        showToast('GPS lock acquired', 'success');
        locationMutation.mutate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        showToast('Could not acquire GPS fix. Enter manually.', 'error');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const latitude  = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      showToast('Enter valid coordinates.', 'error');
      return;
    }
    locationMutation.mutate({ latitude, longitude });
  };

  const toggleDuty = () => {
    if (!driver || !!job || setAvailability.isPending) return;
    const online = driver.availability_status !== 'OFFLINE';
    setAvailability.mutate({
      availability_status: online ? 'OFFLINE' : 'AVAILABLE',
      location: online ? null : driver.current_location,
    });
  };

  return (
    <DriverLayout>
      <div className="p-6 md:p-10 max-w-[1200px] mx-auto">
        
        {/* Header */}
        <div className="mb-10 pb-6 border-b border-outline-variant/30 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-on-surface mb-2">Driver dashboard</h1>
            <div className="flex items-center gap-3 text-[0.8125rem] text-on-surface-variant font-mono-data">
              <span>{user?.email}</span>
              <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
              <span>{user?.id?.substring(0, 8).toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Toasts / Errors */}
        {toast && (
          <div className={`mb-6 p-4 rounded text-[0.875rem] font-medium border flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-success/10 border-success/30 text-success' : 'bg-error/10 border-error/30 text-error'
          }`}>
            {toast.msg}
          </div>
        )}
        
        {location.permission === 'denied' && (
          <div className="mb-6 p-4 rounded border border-error/30 bg-error/10 text-error text-[0.875rem] font-medium">
            <span className="block font-bold mb-1">Location is off</span>
            You can't be dispatched without location. Allow location access for this site in your browser settings.
          </div>
        )}
        {location.permission === 'unsupported' && (
          <div className="mb-6 p-4 rounded border border-error/30 bg-error/10 text-error text-[0.875rem] font-medium">
            <span className="block font-bold mb-1">No location on this device</span>
            This browser can't share your location, so dispatch can't find you.
          </div>
        )}
        
        {isLoading && (
          <div className="p-8 flex items-center gap-3 text-[0.875rem] text-on-surface-variant">
            <Loader2 className="animate-spin" size={16} /> Loading your assignment...
          </div>
        )}
        
        {isError && (
          <div className="mb-6 p-4 rounded border border-error/30 bg-error/10 text-error text-[0.875rem] font-medium">
            <span className="block font-bold mb-1">Couldn't load your job</span>
            {apiErrorMessage(error)}
            <button type="button" className="underline ml-2" onClick={() => void refetch()}>Retry</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 items-start">
          
          {/* ── Left Column: Operations ── */}
          <div className="space-y-12">
            
            {/* Current Delivery */}
            <section>
              <h2 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-widest mb-4 pb-2 border-b border-outline-variant/30">Current delivery</h2>
              
              {driver && job ? (
                <div className="space-y-6">
                  <JobCard job={job} />
                  <div className="border border-outline-variant/50 rounded overflow-hidden">
                     <DriverRouteMap job={job} driverPosition={location.position ?? driver.current_location} />
                  </div>
                  <JobActions job={job} vehicleCapacityKg={driver.capacity_kg} />
                </div>
              ) : (
                driver ? (
                  <div className="p-6 border border-outline-variant/50 rounded">
                    <p className="text-[1.125rem] font-semibold text-on-surface mb-2">
                      {driver.availability_status === 'AVAILABLE' ? 'Waiting for assignment' : 'No active delivery'}
                    </p>
                    <p className="text-[0.875rem] text-on-surface-variant">
                      {driver.availability_status === 'AVAILABLE' 
                        ? 'No delivery has been assigned yet.' 
                        : 'No delivery has been assigned.'}
                    </p>
                  </div>
                ) : null
              )}
            </section>

            {/* Current Location (Moved from bottom bar) */}
            <section>
              <h2 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-widest mb-4 pb-2 border-b border-outline-variant/30">Current location</h2>
              
              {!streaming ? (
                <div className="mb-5">
                   <p className="text-[0.875rem] font-semibold text-on-surface mb-1">Location not shared</p>
                   <p className="text-[0.8125rem] text-on-surface-variant">Location sharing is paused while you're off duty.</p>
                </div>
              ) : (
                <div className="mb-5">
                   <p className="text-[0.8125rem] text-on-surface-variant">
                     Your location is shared with dispatch while you are on duty so delivery routes can be assigned accurately.
                   </p>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex-1 w-full bg-surface-container-lowest border border-outline-variant rounded overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                  <LocationAutocomplete
                    value={address}
                    onChange={setAddress}
                    onSelect={(addr, latVal, lngVal) => {
                      setAddress(addr);
                      setLat(latVal.toFixed(6));
                      setLng(lngVal.toFixed(6));
                      locationMutation.mutate({ latitude: latVal, longitude: lngVal });
                    }}
                    placeholder="Search address or enter coordinates"
                  />
                </div>
                
                <div className="flex w-full sm:w-auto gap-3">
                  <button type="button" onClick={useGPS} disabled={gpsLoading} className="h-10 px-4 bg-surface-container border border-outline-variant text-[0.875rem] text-on-surface rounded hover:bg-surface-container-high transition-colors flex items-center justify-center">
                    {gpsLoading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                  </button>
                  <button type="submit" disabled={locationMutation.isPending || !lat || !lng} className="flex-1 sm:flex-none h-10 px-6 bg-primary text-on-primary text-[0.875rem] font-medium rounded hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 min-w-[160px] disabled:opacity-50">
                    {locationMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Transmitting</>
                     : broadcastSuccess ? <><CheckCircle size={14} /> Transmitted</>
                     : 'Broadcast location'}
                  </button>
                </div>
              </form>

              {/* Status footer */}
              {driver && streaming && (
                <div className="mt-4 flex items-center gap-4 text-[0.75rem]">
                   <div>
                     <span className="font-semibold text-on-surface-variant uppercase tracking-widest block mb-1">Last broadcast</span>
                     <span className="text-on-surface font-mono-data">
                       {location.lastSentAt ? new Date(location.lastSentAt).toLocaleTimeString() : '—'}
                     </span>
                   </div>
                   <div>
                     <span className="font-semibold text-on-surface-variant uppercase tracking-widest block mb-1">Location sharing</span>
                     <span className="text-on-surface flex items-center gap-1">
                       <Radio size={12} className={location.lastSentAt ? 'text-primary' : 'text-on-surface-variant'} />
                       {location.lastError ? 'Error' : location.lastSentAt ? 'Active' : 'Waiting'}
                     </span>
                   </div>
                </div>
              )}
            </section>
          </div>

          {/* ── Right Column: Status & Dispatch ── */}
          <div className="space-y-12">
            
            {/* Driver Status */}
            <section>
              <h2 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-widest mb-4 pb-2 border-b border-outline-variant/30">Driver status</h2>
              {driver ? (
                <div>
                  <p className={`text-[1.125rem] font-semibold mb-1 ${driver.availability_status === 'AVAILABLE' ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {driver.availability_status === 'AVAILABLE' ? 'On duty' : 'Offline'}
                  </p>
                  <p className="text-[0.8125rem] text-on-surface-variant mb-5">
                    {driver.availability_status === 'AVAILABLE' 
                      ? 'Accepting delivery assignments.' 
                      : 'Not currently accepting assignments.'}
                  </p>
                  <button
                    onClick={toggleDuty}
                    disabled={!!job || setAvailability.isPending}
                    className="h-10 px-5 bg-surface-container border border-outline-variant text-[0.875rem] font-medium rounded hover:bg-surface-container-high transition-colors w-full disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {setAvailability.isPending && <Loader2 size={14} className="animate-spin" />}
                    {driver.availability_status === 'AVAILABLE' ? 'Go off duty' : 'Go on duty'}
                  </button>
                  {!!job && <p className="text-[0.75rem] text-warning mt-2 text-center">Complete active job to change status.</p>}
                </div>
              ) : (
                 <p className="text-[0.8125rem] text-on-surface-variant">Loading...</p>
              )}
            </section>

            {/* Dispatch */}
            <section>
              <h2 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-widest mb-4 pb-2 border-b border-outline-variant/30">Dispatch</h2>
              
              {!streaming ? (
                <div>
                  <p className="text-[0.8125rem] text-on-surface-variant">
                    Not receiving assignments.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-4 mb-4">
                     <div>
                       <span className="font-semibold text-on-surface-variant uppercase tracking-widest block mb-1">Connection</span>
                       <span className="text-on-surface flex items-center gap-1.5 text-[0.875rem]">
                         <span className="w-2 h-2 rounded-full bg-success"></span>
                         Connected
                       </span>
                     </div>
                     <div>
                       <span className="font-semibold text-on-surface-variant uppercase tracking-widest block mb-1">Last update</span>
                       <span className="text-[0.875rem] font-mono-data text-on-surface">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </span>
                     </div>
                  </div>
                  <p className="text-[0.8125rem] text-on-surface-variant">
                    Assignments are sent automatically while you're on duty.
                  </p>
                </div>
              )}
            </section>

            {/* Operating Procedures */}
            <section>
              <h2 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-widest mb-4 pb-2 border-b border-outline-variant/30">Operating procedures</h2>
              <button
                onClick={() => setSopOpen((v) => !v)}
                className="w-full flex items-center justify-between py-2 text-[0.875rem] font-medium text-on-surface hover:text-primary transition-colors"
              >
                <span>Pickup and handoff requirements</span>
                {sopOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {sopOpen && (
                <ul className="mt-4 space-y-3 pl-1 border-l-2 border-outline-variant/30">
                  {SOPS.map((tip, i) => (
                    <li key={i} className="text-[0.8125rem] text-on-surface-variant leading-relaxed pl-3">
                      <span className="font-semibold text-on-surface mr-1">{i + 1}.</span> {tip}
                    </li>
                  ))}
                </ul>
              )}
            </section>

          </div>
        </div>
      </div>
    </DriverLayout>
  );
}
