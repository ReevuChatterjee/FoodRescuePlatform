import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { Donation, SuccessEnvelope } from '../../types/api';
import { useDonationWebSocket } from '../../hooks/useDonationWebSocket';
import { DonorLayout } from '../../components/layout/DonorLayout';
import { format } from 'date-fns';

const CATEGORY_LABELS: Record<string, string> = {
  RAW_PRODUCE: 'Raw Produce',
  COOKED:      'Cooked',
  PACKAGED:    'Packaged',
  BAKED_GOODS: 'Baked Goods',
  DAIRY:       'Dairy',
  MIXED:       'Mixed',
};

// Semantic status mapping
function getStatusIndicator(status: string) {
  switch (status) {
    case 'DELIVERED':
      return { color: 'bg-primary', label: 'Delivered' };
    case 'EXPIRED':
    case 'CANCELLED':
    case 'NO_MATCH_FOUND':
      return { color: 'bg-error', label: status === 'NO_MATCH_FOUND' ? 'No match' : status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() };
    case 'AVAILABLE':
    case 'MATCHING':
    case 'MATCHED':
    case 'ACCEPTED':
    case 'DRIVER_ASSIGNED':
    case 'PICKUP_STARTED':
    case 'PICKED_UP':
    case 'IN_TRANSIT':
      return { color: 'bg-warning', label: 'Active' };
    default:
      return { color: 'bg-outline-variant', label: status };
  }
}

export function DonorDashboard() {
  useDonationWebSocket();

  const { data, isLoading, error } = useQuery({
    queryKey: ['donations'],
    queryFn: async () => {
      const response = await apiClient.get<SuccessEnvelope<Donation[]>>('/api/v1/donations');
      return response.data.data;
    },
  });

  const donations = data || [];
  const totalKg   = donations.reduce((s, d) => s + d.quantity_kg, 0);
  
  const activeDonations = donations.filter((d) =>
    ['AVAILABLE','MATCHING','MATCHED','ACCEPTED','DRIVER_ASSIGNED','PICKUP_STARTED','PICKED_UP','IN_TRANSIT'].includes(d.status)
  );
  
  const historyDonations = donations.filter((d) =>
    ['DELIVERED', 'EXPIRED', 'CANCELLED', 'NO_MATCH_FOUND'].includes(d.status)
  );

  const activeCount = activeDonations.length;
  const deliveredCount = historyDonations.filter(d => d.status === 'DELIVERED').length;

  if (error) {
    return (
      <DonorLayout>
        <div className="bg-surface-container rounded-lg p-12 text-center border border-outline-variant/30">
          <p className="text-[0.875rem] font-medium text-error">
            Failed to load donations. Please try refreshing.
          </p>
        </div>
      </DonorLayout>
    );
  }

  const subtitle = isLoading
    ? 'Loading…'
    : donations.length === 0
    ? 'No donations yet.'
    : `${activeCount} active · ${deliveredCount} delivered`;

  return (
    <DonorLayout>
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-on-surface mb-2">My donations</h1>
          <p className="text-[0.9375rem] text-on-surface-variant">{subtitle}</p>
        </div>
        <Link to="/donor/donate" className="h-10 px-5 inline-flex items-center justify-center bg-primary text-on-primary rounded text-[0.875rem] font-medium hover:bg-primary/90 transition-colors">
          New donation
        </Link>
      </div>

      {/* ── Metric Strip ── */}
      {!isLoading && donations.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-12 gap-y-6 mb-16 pb-8 border-b border-outline-variant/30">
          <div className="flex flex-col gap-1">
            <span className="text-[1.5rem] font-semibold text-on-surface">{donations.length}</span>
            <span className="text-[0.8125rem] font-medium text-on-surface-variant uppercase tracking-widest">Donations</span>
          </div>
          <div className="hidden sm:block w-px h-10 bg-outline-variant/30"></div>
          <div className="flex flex-col gap-1">
            <span className="text-[1.5rem] font-semibold text-on-surface">{activeCount}</span>
            <span className="text-[0.8125rem] font-medium text-on-surface-variant uppercase tracking-widest">Active</span>
          </div>
          <div className="hidden sm:block w-px h-10 bg-outline-variant/30"></div>
          <div className="flex flex-col gap-1">
            <span className="text-[1.5rem] font-semibold text-on-surface">{deliveredCount}</span>
            <span className="text-[0.8125rem] font-medium text-on-surface-variant uppercase tracking-widest">Delivered</span>
          </div>
          <div className="hidden sm:block w-px h-10 bg-outline-variant/30"></div>
          <div className="flex flex-col gap-1">
            <span className="text-[1.5rem] font-semibold text-on-surface">{totalKg.toFixed(0)} kg</span>
            <span className="text-[0.8125rem] font-medium text-on-surface-variant uppercase tracking-widest">Food donated</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="animate-pulse space-y-4 mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-surface-container rounded-sm border border-outline-variant/30" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && donations.length === 0 && (
        <div className="pt-12">
          <p className="text-[1.25rem] font-medium text-on-surface mb-3">
            Your first donation starts here.
          </p>
          <p className="text-[0.9375rem] text-on-surface-variant max-w-xl leading-relaxed mb-6">
            Log surplus food to make it visible to NGOs and drivers in your area. Every listing creates a traceable handoff record.
          </p>
        </div>
      )}

      {/* ── Active Donations ── */}
      {!isLoading && activeDonations.length > 0 && (
        <div className="mb-16">
          <h2 className="text-[1rem] font-semibold text-on-surface mb-4">Active donations</h2>
          <div className="border border-outline-variant/50 rounded overflow-hidden">
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b border-outline-variant/50 bg-surface-container-lowest text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest">
              <span>Donation</span>
              <span>Status</span>
              <span>Match</span>
              <span className="text-right">Details</span>
            </div>
            <div className="divide-y divide-outline-variant/30 bg-white">
              {activeDonations.map((donation) => {
                const isExpiringSoon = new Date(donation.expiry_time) < new Date(Date.now() + 2 * 3600 * 1000);
                const indicator = getStatusIndicator(donation.status);
                
                return (
                  <Link
                    key={donation.id}
                    to={`/donor/donation/${donation.id}`}
                    className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-4 hover:bg-surface-container transition-colors items-center"
                  >
                    <div>
                      <p className="text-[0.9375rem] font-semibold text-on-surface mb-1 truncate">
                        {donation.food_name}
                      </p>
                      <p className="text-[0.8125rem] text-on-surface-variant">
                        {CATEGORY_LABELS[donation.food_category] ?? donation.food_category} · {donation.quantity_kg} kg
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${indicator.color}`} />
                      <span className="text-[0.875rem] font-medium text-on-surface">{indicator.label}</span>
                    </div>

                    <div className="text-[0.8125rem] text-on-surface-variant">
                      {donation.matched_ngo_id ? (
                        <span className="font-semibold text-primary">NGO Matched</span>
                      ) : (
                        <span>Searching</span>
                      )}
                    </div>
                    
                    <div className="text-left md:text-right text-[0.8125rem] text-on-surface-variant">
                      {donation.eta_minutes !== null ? (
                        <p className="font-semibold text-warning">ETA {donation.eta_minutes} min</p>
                      ) : (
                        <p className={isExpiringSoon ? 'text-warning font-semibold' : ''}>
                          Expires {format(new Date(donation.expiry_time), 'MMM d · HH:mm')}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Donation History ── */}
      {!isLoading && (historyDonations.length > 0 || (donations.length > 0 && activeDonations.length === 0)) && (
        <div>
          <h2 className="text-[1rem] font-semibold text-on-surface mb-4">Donation history</h2>
          {historyDonations.length === 0 ? (
            <p className="text-[0.875rem] text-on-surface-variant italic">No completed donations yet.</p>
          ) : (
            <div className="border border-outline-variant/50 rounded overflow-hidden">
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b border-outline-variant/50 bg-surface-container-lowest text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-widest">
                <span>Donation</span>
                <span>Status</span>
                <span>Match</span>
                <span className="text-right">Date</span>
              </div>
              <div className="divide-y divide-outline-variant/30 bg-white">
                {historyDonations.map((donation) => {
                  const indicator = getStatusIndicator(donation.status);
                  
                  return (
                    <Link
                      key={donation.id}
                      to={`/donor/donation/${donation.id}`}
                      className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-4 hover:bg-surface-container transition-colors items-center"
                    >
                      <div>
                        <p className="text-[0.9375rem] font-semibold text-on-surface mb-1 truncate">
                          {donation.food_name}
                        </p>
                        <p className="text-[0.8125rem] text-on-surface-variant">
                          {CATEGORY_LABELS[donation.food_category] ?? donation.food_category} · {donation.quantity_kg} kg
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${indicator.color}`} />
                        <span className="text-[0.875rem] font-medium text-on-surface">{indicator.label}</span>
                      </div>

                      <div className="text-[0.8125rem] text-on-surface-variant">
                        {donation.matched_ngo_id ? (
                          <span>Matched</span>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      
                      <div className="text-left md:text-right text-[0.8125rem] text-on-surface-variant font-mono-data">
                        {format(new Date(donation.created_at), 'MMM d')}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

    </DonorLayout>
  );
}
