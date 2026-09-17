/**
 * LandingPage — public-facing homepage.
 * 7/5 asymmetric hero split (not 6/6).
 * Traceability section: horizontal proportional timeline (not equal-column cards).
 * Metrics: MetricDisplay components — no card boxes.
 * NetworkRadar: SVG behind the metrics panel at 35% opacity.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, Leaf } from 'lucide-react';
import { useAnalyticsOverview } from '../hooks/useAnalytics';
import { NetworkRadar } from '../components/visuals/NetworkRadar';
import { MetricDisplay } from '../components/common/MetricDisplay';
import { ThemeToggle } from '../components/common/ThemeToggle';

const LIFECYCLE_STEPS = [
  {
    step: '01',
    label: 'Surplus Identified',
    desc: 'Donor logs food details, quantity and pickup location.',
    accent: 'var(--olive-grey)',
  },
  {
    step: '02',
    label: 'Capacity Matched',
    desc: 'NGOs with available capacity accept based on proximity and category.',
    accent: 'var(--amber-dim)',
  },
  {
    step: '03',
    label: 'Route Dispatched',
    desc: 'Driver is assigned and navigates to the pickup location.',
    accent: 'var(--moss-light)',
  },
  {
    step: '04',
    label: 'Handoff Verified',
    desc: 'NGO confirms receipt. Network capacity and donor analytics update.',
    accent: 'var(--moss-light)',
  },
];

export function LandingPage() {
  const { data: stats } = useAnalyticsOverview();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* ── Navbar ── */}
      <nav
        className="border-b sticky top-0 z-50 flex items-center justify-between"
        style={{
          borderColor: 'var(--border-hair)',
          background: 'var(--bg-base)',
          padding: '0 32px',
          height: '52px',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            style={{
              width: '22px', height: '22px',
              background: 'var(--moss)',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Leaf size={12} style={{ color: '#C8DFC9' }} />
          </div>
          <span
            className="font-semibold"
            style={{ color: 'var(--text-primary)', fontSize: '0.875rem', letterSpacing: '-0.02em' }}
          >
            RePlate Ops
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            to="/login"
            className="section-label"
            style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            Sign In
          </Link>
          <Link to="/login" className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.8125rem' }}>
            Platform Access
          </Link>
        </div>
      </nav>

      {/* ── Hero: 7/5 asymmetric split ── */}
      <section style={{ padding: 'var(--sp-7) 32px var(--sp-6)', flex: 1 }}>
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '7fr 5fr',
            gap: '64px',
            alignItems: 'center',
          }}
          className="grid-cols-1 lg:!grid-cols-[7fr_5fr]"
        >
          {/* Left — editorial copy */}
          <div>
            <p
              className="section-label"
              style={{ color: 'var(--moss-light)', marginBottom: '24px' }}
            >
              Living Rescue Network
            </p>
            <h1 className="heading-major" style={{ marginBottom: '28px', maxWidth: '14ch' }}>
              Surplus food, coordinated before it is lost.
            </h1>
            <p
              className="prose-body"
              style={{ fontSize: '1.0625rem', marginBottom: '40px', lineHeight: 1.65 }}
            >
              Connect the people, places, and routes that move food where it is needed.
              A real-time logistics network turning available surplus into completed handoffs.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/login" className="btn-primary" style={{ padding: '10px 24px', fontSize: '0.9375rem' }}>
                Enter Network <ArrowRight size={16} />
              </Link>
              <a
                href="#traceability"
                className="btn-secondary"
                style={{ padding: '10px 24px', fontSize: '0.9375rem' }}
              >
                View Traceability
              </a>
            </div>
          </div>

          {/* Right — raw metric display, no card box */}
          <div
            style={{
              position: 'relative',
              padding: '32px',
              border: '1px solid var(--border-hair)',
              background: 'var(--bg-panel)',
              borderRadius: '2px',
              overflow: 'hidden',
              minHeight: '360px',
            }}
          >
            {/* NetworkRadar behind metrics */}
            <NetworkRadar />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <p className="section-label" style={{ marginBottom: '20px' }}>Network Activity</p>

              {/* Asymmetric metric layout: 2 large + 2 smaller */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px 20px' }}>
                <MetricDisplay
                  value={stats?.active_deliveries ?? 0}
                  label="Active Logistics"
                  size="lg"
                />
                <MetricDisplay
                  value={stats?.active_donations ?? 0}
                  label="Pending Surplus"
                  size="md"
                />
                <MetricDisplay
                  value={stats?.total_food_rescued_kg?.toFixed(0) ?? 0}
                  label="Rescued kg"
                  unit="kg"
                  size="md"
                />
                <MetricDisplay
                  value={(stats?.registered_ngos ?? 0) + (stats?.registered_donors ?? 0)}
                  label="Network Nodes"
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Traceability Lifecycle — horizontal timeline, not equal cards ── */}
      <section
        id="traceability"
        style={{
          borderTop: '1px solid var(--border-hair)',
          background: 'var(--bg-panel)',
          padding: 'var(--sp-6) 32px',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Section heading — left-aligned, not centered */}
          <div style={{ marginBottom: 'var(--sp-6)' }}>
            <p className="section-label" style={{ marginBottom: '12px' }}>Donation Lifecycle</p>
            <h2
              className="heading-section"
              style={{ marginBottom: '10px', maxWidth: '20ch' }}
            >
              A donation moves.
            </h2>
            <p
              className="prose-body"
              style={{ fontSize: '0.9375rem' }}
            >
              Every step is tracked, allocated, and verified from surplus to handoff.
            </p>
          </div>

          {/* Horizontal timeline — not equal-column cards */}
          <ol
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 0,
              listStyle: 'none',
              padding: 0,
              margin: 0,
              position: 'relative',
            }}
            className="grid-cols-1 sm:grid-cols-2 lg:!grid-cols-4"
          >
            {/* Connecting rule */}
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: '0',
                right: '0',
                height: '1px',
                background: 'var(--border-med)',
              }}
              aria-hidden="true"
            />

            {LIFECYCLE_STEPS.map((step, idx) => (
              <li
                key={step.step}
                style={{
                  paddingTop: '44px',
                  paddingRight: idx < 3 ? '24px' : 0,
                  position: 'relative',
                }}
              >
                {/* Step number — Fraunces serif, large */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.125rem',
                    fontWeight: 300,
                    color: step.accent,
                    fontVariationSettings: "'opsz' 18",
                    lineHeight: 1,
                  }}
                >
                  {step.step}
                </div>

                <p
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                    letterSpacing: '-0.015em',
                  }}
                >
                  {step.label}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    maxWidth: '28ch',
                  }}
                >
                  {step.desc}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: '1px solid var(--border-hair)',
          background: 'var(--bg-base)',
          padding: '20px 32px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div className="flex items-center gap-2">
            <div style={{ width: '16px', height: '16px', background: 'var(--moss)', borderRadius: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Leaf size={9} style={{ color: '#C8DFC9' }} />
            </div>
            <span className="section-label" style={{ color: 'var(--text-muted)' }}>RePlate Ops</span>
          </div>
          <span className="font-mono-data section-label" style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>
            System Build 2026.4
          </span>
        </div>
      </footer>
    </div>
  );
}
