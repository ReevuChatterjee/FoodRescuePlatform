/**
 * NGODashboard — feed + persistent sidebar capacity gauge.
 * AI-tells removed:
 *   - 4-col stat card grid → capacity gauge lives in sidebar (NGOLayout),
 *     main area shows demand feed + categories inline
 *   - panel cards for every section → surface-dense feed items
 *   - badge-gray chip tags for categories → comma-separated inline olive-grey text
 *   - identical Quick Actions card → compact hairline list
 * Uses NGOLayout.
 */

import { Link } from 'react-router-dom';
import { useMyNGOProfile } from '../../hooks/useNGO';
import { NGOLayout } from '../../components/layout/NGOLayout';

const CATEGORY_DISPLAY: Record<string, string> = {
  RAW_PRODUCE: 'Raw Produce',
  COOKED:      'Cooked',
  PACKAGED:    'Packaged',
  BAKED_GOODS: 'Baked Goods',
  DAIRY:       'Dairy',
  MIXED:       'Mixed',
};

export function NGODashboard() {
  const { data: profile, isLoading, error } = useMyNGOProfile();

  if (isLoading) {
    return (
      <NGOLayout>
        <div className="flex flex-col gap-3">
          <div className="bg-surface-container-high rounded animate-pulse h-10 w-48" />
          <div className="bg-surface-container-high rounded animate-pulse h-[200px] w-full" />
          <div className="bg-surface-container-high rounded animate-pulse h-[140px] w-full" />
        </div>
      </NGOLayout>
    );
  }

  if (error || !profile) {
    return (
      <NGOLayout>
        <div className="bg-surface-container rounded-lg p-12 text-center border border-outline-variant">
          <p className="text-sm font-semibold text-error">
            Failed to load NGO profile. Please refresh.
          </p>
        </div>
      </NGOLayout>
    );
  }

  const isVerified = profile.verification_status === 'APPROVED';
  const isPending  = profile.verification_status === 'PENDING';

  return (
    <NGOLayout>
      {/* Page header */}
      <div className="mb-10 pb-6 border-b border-outline-variant/30 flex justify-between items-end">
        <div>
          <p className="text-[0.6875rem] font-bold text-primary tracking-widest uppercase mb-2">NGO Dashboard</p>
          <h1 className="text-[1.375rem] font-semibold text-on-surface mb-1.5 tracking-tight">{profile.organisation_name}</h1>
          <p className="text-[0.875rem] text-on-surface-variant max-w-[50ch] leading-relaxed">{profile.address}</p>
        </div>
        <div className="text-right">
          <p className="text-[0.6875rem] text-on-surface-variant uppercase tracking-wider mb-1">Verification</p>
          <p className={`text-[0.875rem] font-medium ${isVerified ? 'text-primary' : isPending ? 'text-warning' : 'text-error'}`}>
            {isVerified ? 'Verified' : isPending ? 'Pending review' : 'Not verified'}
          </p>
        </div>
      </div>

      {/* Pending notice */}
      {isPending && (
        <div className="mb-10 text-[0.875rem] text-warning border border-warning/30 px-4 py-3">
          <span className="font-bold">Verification Pending:</span> Your NGO is awaiting admin review. You can still view your profile and incoming offers.
        </div>
      )}

      {/* Two-column layout: feed (left 2/3) + actions rail (right 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
        {/* ── Left feed column ── */}
        <div className="flex flex-col gap-10">

          {/* Capacity section */}
          <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-wide">Storage</h2>
              <Link
                to="/ngo/settings"
                className="text-[0.8125rem] text-on-surface-variant hover:text-primary transition-colors"
              >
                Update
              </Link>
            </div>
            
            <div className="flex items-end gap-3 mb-3">
              <span className="text-[2.5rem] font-medium text-on-surface tracking-tighter leading-none font-mono-data">
                {profile.available_capacity_kg}
              </span>
              <span className="text-[1rem] text-on-surface-variant pb-1">kg available</span>
            </div>

            <div className="h-[2px] w-full bg-outline-variant/30 overflow-hidden rounded-none mb-3">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${profile.storage_capacity_kg > 0 ? Math.min(((profile.storage_capacity_kg - profile.available_capacity_kg) / profile.storage_capacity_kg) * 100, 100) : 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[0.8125rem]">
              <span className="text-on-surface-variant font-mono-data">{profile.storage_capacity_kg > 0 ? (((profile.storage_capacity_kg - profile.available_capacity_kg) / profile.storage_capacity_kg) * 100).toFixed(0) : 0}% utilized</span>
              <span className="text-on-surface-variant font-mono-data">{profile.storage_capacity_kg} kg capacity</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Accepted categories */}
            <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-wide">Accepted Categories</h2>
                <Link
                  to="/ngo/settings"
                  className="text-[0.8125rem] text-on-surface-variant hover:text-primary transition-colors"
                >
                  Edit
                </Link>
              </div>
              {profile.accepted_categories.length === 0 ? (
                <p className="text-[0.875rem] text-on-surface-variant">
                  No categories configured.{' '}
                  <Link to="/ngo/settings" className="text-on-surface hover:underline">
                    Set preferences
                  </Link>
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {profile.accepted_categories.map((c) => (
                    <div key={c} className="text-[0.875rem] text-on-surface pb-2 border-b border-outline-variant/30 last:border-0 last:pb-0">
                      {CATEGORY_DISPLAY[c] ?? c.replace(/_/g, ' ')}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Current demand */}
            <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[0.875rem] font-semibold text-on-surface uppercase tracking-wide">Current Demand</h2>
                <Link
                  to="/ngo/settings"
                  className="text-[0.8125rem] text-on-surface-variant hover:text-primary transition-colors"
                >
                  Add
                </Link>
              </div>
              {profile.demand.length === 0 ? (
                <div className="text-[0.875rem] text-on-surface-variant leading-relaxed">
                  <p className="mb-2 font-medium text-on-surface">No active demand</p>
                  <p className="mb-4">No food requests currently require matching.</p>
                  <Link to="/ngo/settings" className="text-primary hover:underline underline-offset-2">
                    Add demand →
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {profile.demand.map((d, i) => (
                    <div key={i} className="flex items-start justify-between pb-3 border-b border-outline-variant/30 last:border-0 last:pb-0">
                      <div>
                        <p className="text-[0.875rem] text-on-surface font-medium">
                          {CATEGORY_DISPLAY[d.food_category] ?? d.food_category.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[0.75rem] text-on-surface-variant mt-0.5">
                          Priority {d.priority} <span className="mx-1">·</span> Until {new Date(d.valid_until).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-[0.875rem] text-on-surface font-mono-data mt-0.5">
                        {d.required_quantity_kg} kg
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right rail: operations panel ── */}
        <div className="flex flex-col gap-6">
          {/* Operations Panel */}
          <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-md p-6">
            <h2 className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest mb-5">Operations</h2>
            
            <div className="flex flex-col gap-5">
              {[
                { label: 'Incoming offers', href: '/ngo/incoming', desc: 'Review matched donations' },
                { label: 'Settings',        href: '/ngo/settings', desc: 'Manage capacity, demand and profile' },
              ].map((a) => (
                <Link
                  key={a.href}
                  to={a.href}
                  className="group block"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[0.875rem] font-medium text-on-surface group-hover:text-primary transition-colors">{a.label}</p>
                    <span className="text-[0.875rem] text-outline-variant group-hover:text-primary transition-colors">→</span>
                  </div>
                  <p className="text-[0.8125rem] text-on-surface-variant mt-0.5">{a.desc}</p>
                </Link>
              ))}
            </div>

            <div className="mt-5 pt-5 border-t border-outline-variant/30">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[0.875rem] font-medium text-on-surface">Operating hours</p>
                <Link
                  to="/ngo/settings"
                  className="text-[0.8125rem] text-on-surface-variant hover:text-primary transition-colors"
                >
                  Edit
                </Link>
              </div>
              <p className="text-[0.8125rem] text-on-surface font-mono-data mb-1">
                {profile.operating_hours.start} – {profile.operating_hours.end}
              </p>
            </div>
          </div>

          {/* NGO ID */}
          <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-md p-6">
            <h2 className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest mb-2">NGO ID</h2>
            <p className="font-mono-data text-[0.8125rem] text-on-surface break-all">
              {profile.ngo_id}
            </p>
          </div>
        </div>
      </div>
    </NGOLayout>
  );
}
