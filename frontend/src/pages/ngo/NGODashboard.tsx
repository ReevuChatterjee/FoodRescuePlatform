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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="skeleton" style={{ height: '40px', width: '200px' }} />
          <div className="skeleton" style={{ height: '200px', width: '100%' }} />
          <div className="skeleton" style={{ height: '140px', width: '100%' }} />
        </div>
      </NGOLayout>
    );
  }

  if (error || !profile) {
    return (
      <NGOLayout>
        <div className="surface" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--terracotta)', fontSize: '0.875rem', fontWeight: 500 }}>
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
      <div className="page-header">
        <div>
          <h1 className="page-title">{profile.organisation_name}</h1>
          <p className="page-subtitle" style={{ maxWidth: '60ch' }}>{profile.address}</p>
        </div>
        <div className="flex items-center gap-2">
          {isVerified && (
            <span className="status-pill-success">
              <span className="status-pill-dot dot-success" />
              <CheckCircle size={9} style={{ marginRight: '2px' }} /> Verified
            </span>
          )}
          {isPending && (
            <span className="status-pill-warning">
              <span className="status-pill-dot dot-amber" />
              <Clock size={9} style={{ marginRight: '2px' }} /> Verification Pending
            </span>
          )}
          {!isVerified && !isPending && (
            <span className="status-pill-error">
              <span className="status-pill-dot dot-error" />
              <XCircle size={9} style={{ marginRight: '2px' }} /> Not Verified
            </span>
          )}
        </div>
      </div>

      {/* Pending notice */}
      {isPending && (
        <div
          style={{
            marginBottom: 'var(--sp-5)',
            padding: '12px 16px',
            borderLeft: '3px solid var(--amber-dim)',
            background: 'var(--amber-dim-bg)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <ShieldAlert size={16} style={{ color: 'var(--amber-dim)', marginTop: '1px', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--amber-dim)', marginBottom: '4px' }}>
              Verification Pending
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Your NGO is awaiting admin review. You can still view your profile and incoming offers.
            </p>
          </div>
        </div>
      )}

      {/* Two-column layout: feed (left 2/3) + actions rail (right 1/3) */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}
        className="grid-cols-1 lg:!grid-cols-[2fr_1fr]"
      >
        {/* ── Left feed column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

          {/* Capacity section — inline MetricDisplay, not a card */}
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <p className="section-label">Storage Capacity</p>
              <Link
                to="/ngo/settings"
                className="section-label hover:text-[var(--moss-light)] transition-colors"
                style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
              >
                Update →
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginBottom: '20px' }}>
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
            <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
              <p className="section-label">Accepted Categories</p>
              <Link
                to="/ngo/settings"
                className="section-label hover:text-[var(--moss-light)] transition-colors"
                style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
              >
                Edit →
              </Link>
            </div>
            {profile.accepted_categories.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                No categories configured.{' '}
                <Link to="/ngo/settings" style={{ color: 'var(--moss-light)', textDecoration: 'none' }}>
                  Set preferences →
                </Link>
              </p>
            ) : (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {profile.accepted_categories
                  .map((c) => CATEGORY_DISPLAY[c] ?? c.replace(/_/g, ' '))
                  .join(' · ')}
              </p>
            )}
          </div>

          {/* Current demand — hairline feed list */}
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
              <p className="section-label">Current Demand</p>
              <Link
                to="/ngo/settings"
                className="section-label hover:text-[var(--moss-light)] transition-colors"
                style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
              >
                Add →
              </Link>
            </div>
            {profile.demand.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                No demand entries.{' '}
                <Link to="/ngo/settings" style={{ color: 'var(--moss-light)', textDecoration: 'none' }}>
                  Add them to improve matching →
                </Link>
              </p>
            ) : (
              <div className="surface-dense" style={{ overflow: 'hidden' }}>
                {profile.demand.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: i < profile.demand.length - 1 ? '1px solid var(--border-hair)' : 'none',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '3px' }}>
                        {CATEGORY_DISPLAY[d.food_category] ?? d.food_category.replace(/_/g, ' ')}
                      </p>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        Priority {d.priority} · Valid until {new Date(d.valid_until).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1rem',
                        fontWeight: 300,
                        color: 'var(--text-secondary)',
                        fontVariantNumeric: 'tabular-nums',
                        fontVariationSettings: "'opsz' 16",
                      }}
                    >
                      {d.required_quantity_kg} kg
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right rail: actions + operating hours ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {/* Quick actions */}
          <div>
            <p className="section-label" style={{ marginBottom: '12px' }}>Actions</p>
            <div className="surface-dense" style={{ overflow: 'hidden' }}>
              {[
                { label: 'Incoming Offers', href: '/ngo/incoming', icon: <Package size={13} />, desc: 'Review matched donations' },
                { label: 'Settings',        href: '/ngo/settings', icon: <Settings size={13} />, desc: 'Capacity, demand & profile' },
              ].map((a, i, arr) => (
                <Link
                  key={a.href}
                  to={a.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border-hair)' : 'none',
                    textDecoration: 'none',
                    transition: 'background 0.1s',
                  }}
                  className="hover:bg-hover"
                >
                  <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{a.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{a.label}</p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{a.desc}</p>
                  </div>
                  <ArrowUpRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          </div>

          {/* Operating hours — two inline MetricDisplays */}
          <div>
            <p className="section-label" style={{ marginBottom: '12px' }}>Operating Hours</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <MetricDisplay value={profile.operating_hours.start} label="Opens"  size="sm" />
              <MetricDisplay value={profile.operating_hours.end}   label="Closes" size="sm" />
            </div>
            <Link
              to="/ngo/settings"
              className="section-label hover:text-[var(--moss-light)] transition-colors"
              style={{ color: 'var(--text-muted)', textDecoration: 'none', marginTop: '8px', display: 'block' }}
            >
              Edit hours →
            </Link>
          </div>

          {/* NGO ID */}
          <div>
            <p className="section-label" style={{ marginBottom: '6px' }}>NGO ID</p>
            <p
              className="font-mono-data"
              style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}
            >
              {profile.ngo_id}
            </p>
          </div>
        </div>
      </div>
    </NGOLayout>
  );
}
