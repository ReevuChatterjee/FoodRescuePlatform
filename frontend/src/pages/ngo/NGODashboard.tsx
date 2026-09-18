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
import { CheckCircle, Clock, XCircle, Package, Settings, ArrowUpRight, ShieldAlert } from 'lucide-react';
import { useMyNGOProfile } from '../../hooks/useNGO';
import { NGOLayout } from '../../components/layout/NGOLayout';
import { MetricDisplay } from '../../components/common/MetricDisplay';

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-on-surface mb-1">{profile.organisation_name}</h1>
          <p className="text-sm font-medium text-on-surface-variant max-w-[60ch]">{profile.address}</p>
        </div>
        <div className="flex items-center gap-2">
          {isVerified && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-success/30 bg-success/5 text-success rounded-sm font-ui text-[0.625rem] font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <CheckCircle size={10} /> Verified
            </span>
          )}
          {isPending && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-warning/30 bg-warning/5 text-warning rounded-sm font-ui text-[0.625rem] font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-warning" />
              <Clock size={10} /> Verification Pending
            </span>
          )}
          {!isVerified && !isPending && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-error/30 bg-error/5 text-error rounded-sm font-ui text-[0.625rem] font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-error" />
              <XCircle size={10} /> Not Verified
            </span>
          )}
        </div>
      </div>

      {/* Pending notice */}
      {isPending && (
        <div className="mb-10 px-4 py-3 border-l-4 border-warning bg-warning/5 flex items-start gap-3">
          <ShieldAlert size={16} className="text-warning mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[0.8125rem] font-bold text-warning mb-1">
              Verification Pending
            </p>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Your NGO is awaiting admin review. You can still view your profile and incoming offers.
            </p>
          </div>
        </div>
      )}

      {/* Two-column layout: feed (left 2/3) + actions rail (right 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
        {/* ── Left feed column ── */}
        <div className="flex flex-col gap-10">

          {/* Capacity section — inline MetricDisplay, not a card */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="section-label text-on-surface">Storage Capacity</p>
              <Link
                to="/ngo/settings"
                className="font-ui text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant hover:text-primary transition-colors"
              >
                Update →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-8 mb-5">
              <MetricDisplay
                value={profile.available_capacity_kg}
                label="Available Now"
                unit="kg"
                size="md"
              />
              <MetricDisplay
                value={profile.storage_capacity_kg}
                label="Total Capacity"
                unit="kg"
                size="sm"
              />
            </div>
          </div>

          {/* Accepted categories — comma-separated, no chips */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="section-label text-on-surface">Accepted Categories</p>
              <Link
                to="/ngo/settings"
                className="font-ui text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant hover:text-primary transition-colors"
              >
                Edit →
              </Link>
            </div>
            {profile.accepted_categories.length === 0 ? (
              <p className="text-[0.8125rem] text-on-surface-variant">
                No categories configured.{' '}
                <Link to="/ngo/settings" className="text-primary hover:underline">
                  Set preferences →
                </Link>
              </p>
            ) : (
              <p className="text-sm font-medium text-on-surface-variant leading-relaxed font-mono-data">
                {profile.accepted_categories
                  .map((c) => CATEGORY_DISPLAY[c] ?? c.replace(/_/g, ' '))
                  .join(' · ')}
              </p>
            )}
          </div>

          {/* Current demand — hairline feed list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="section-label text-on-surface">Current Demand</p>
              <Link
                to="/ngo/settings"
                className="font-ui text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant hover:text-primary transition-colors"
              >
                Add →
              </Link>
            </div>
            {profile.demand.length === 0 ? (
              <p className="text-[0.8125rem] text-on-surface-variant">
                No demand entries.{' '}
                <Link to="/ngo/settings" className="text-primary hover:underline">
                  Add them to improve matching →
                </Link>
              </p>
            ) : (
              <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-[0_2px_4px_rgba(24,29,26,0.04)]">
                {profile.demand.map((d, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-4 ${i < profile.demand.length - 1 ? 'border-b border-b-outline-variant' : ''}`}
                  >
                    <div>
                      <p className="text-[0.8125rem] font-semibold text-on-surface mb-1">
                        {CATEGORY_DISPLAY[d.food_category] ?? d.food_category.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[0.6875rem] text-on-surface-variant font-mono-data">
                        Priority {d.priority} <span className="text-outline-variant px-1">·</span> Valid until {new Date(d.valid_until).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="font-display text-lg font-bold text-on-surface tracking-tight font-mono-data">
                      {d.required_quantity_kg} kg
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right rail: actions + operating hours ── */}
        <div className="flex flex-col gap-6">
          {/* Quick actions */}
          <div>
            <p className="section-label text-on-surface mb-3">Actions</p>
            <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-[0_2px_4px_rgba(24,29,26,0.04)]">
              {[
                { label: 'Incoming Offers', href: '/ngo/incoming', icon: <Package size={14} />, desc: 'Review matched donations' },
                { label: 'Settings',        href: '/ngo/settings', icon: <Settings size={14} />, desc: 'Capacity, demand & profile' },
              ].map((a, i, arr) => (
                <Link
                  key={a.href}
                  to={a.href}
                  className={`flex items-center gap-3 p-3.5 hover:bg-surface-container transition-colors group ${
                    i < arr.length - 1 ? 'border-b border-b-outline-variant' : ''
                  }`}
                >
                  <div className="text-on-surface-variant flex-shrink-0 group-hover:text-primary transition-colors">{a.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8125rem] font-semibold text-on-surface mb-0.5">{a.label}</p>
                    <p className="text-[0.6875rem] text-on-surface-variant">{a.desc}</p>
                  </div>
                  <ArrowUpRight size={14} className="text-on-surface-variant flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>

          {/* Operating hours — two inline MetricDisplays */}
          <div>
            <p className="section-label text-on-surface mb-3">Operating Hours</p>
            <div className="grid grid-cols-2 gap-4">
              <MetricDisplay value={profile.operating_hours.start} label="Opens"  size="sm" />
              <MetricDisplay value={profile.operating_hours.end}   label="Closes" size="sm" />
            </div>
            <Link
              to="/ngo/settings"
              className="font-ui text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant hover:text-primary transition-colors mt-3 block"
            >
              Edit hours →
            </Link>
          </div>

          {/* NGO ID */}
          <div>
            <p className="section-label text-on-surface mb-1.5">NGO ID</p>
            <p className="font-mono-data text-[0.6875rem] text-on-surface-variant break-all">
              {profile.ngo_id}
            </p>
          </div>
        </div>
      </div>
    </NGOLayout>
  );
}
