/**
 * LandingPage — Civic Vitality design system.
 * Matches stitch_replate_food_rescue_redesign reference.
 * Warm parchment + forest green + terracotta.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, Leaf, CheckCircle, ShieldCheck, Thermometer, FileText, Download, Phone } from 'lucide-react';
import { useAnalyticsOverview } from '../hooks/useAnalytics';
import { ThemeToggle } from '../components/common/ThemeToggle';

const LIFECYCLE_STEPS = [
  {
    step: '01',
    icon: 'inventory_2',
    label: 'Donor Registers Surplus',
    desc: 'Donors log food type, quantity, preparation time, availability window, and expiry/use-by time directly into the real-time system.',
    tag: 'Real-time surplus registration',
  },
  {
    step: '02',
    icon: 'alt_route',
    label: 'Constraint-Based Matching',
    desc: 'The engine evaluates feasible NGOs by weighing storage capacity, shelf life, transit time, current demand, and route efficiency.',
    tag: 'Explainable 5-factor scoring',
  },
  {
    step: '03',
    icon: 'local_shipping',
    label: 'Live Routing & Dispatch',
    desc: 'Upon NGO acceptance, an available driver is assigned and routed using live traffic data, distance, and estimated travel time.',
    tag: 'WebSocket real-time updates',
  },
  {
    step: '04',
    icon: 'history_edu',
    label: 'Digital Handover & Audit',
    desc: 'Immutable digital sign-off from both parties at handover, ensuring documentation for FSSAI and Solid Waste Management Rules compliance.',
    tag: 'Immutable audit record',
  },
];



const TRUST_PILLARS = [
  {
    icon: <ShieldCheck size={26} />,
    iconColor: 'text-[#004527]',
    iconBg: 'bg-[#004527]/10',
    title: 'FSSAI Traceability Record',
    desc: 'Maintains documentation and traceability records required under the FSSAI Surplus Food Regulations, 2019 without granting unwarranted legal immunity.',
    badge: 'FSSAI Traceability Compliant',
    badgeColor: 'text-[#181d1a]',
  },
  {
    icon: <Thermometer size={26} />,
    iconColor: 'text-[#a23e18]',
    iconBg: 'bg-[#a23e18]/10',
    title: 'Time-Sensitive Optimisation',
    desc: 'Mandatory shelf-life and transit-time calculations. The system evaluates whether food can be securely delivered and consumed before the expiry window closes.',
    badge: 'Zero Tolerance Spoilage Protocol',
    badgeColor: 'text-[#a23e18]',
  },
  {
    icon: <FileText size={26} />,
    iconColor: 'text-[#004527]',
    iconBg: 'bg-[#004527]/10',
    title: 'SWM Rules 2026 Compliance',
    desc: 'Every step — intake scan, driver custody transfer, and recipient kitchen verification — is timestamped, geolocated, and digitally signed, ensuring bulk waste generator accountability.',
    badge: 'Automated Audit Export Ready',
    badgeColor: 'text-[#181d1a]',
  },
];

export function LandingPage() {
  const { data: stats } = useAnalyticsOverview();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* ── Navbar ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{ background: 'rgba(246, 251, 245, 0.92)', backdropFilter: 'blur(12px)', boxShadow: '0 1px 8px rgba(0,0,0,0.04)', borderBottom: '1px solid var(--border-hair)' }}
      >
        <div className="h-20 w-full max-w-7xl mx-auto px-4 lg:px-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <Leaf size={24} style={{ color: 'var(--moss)' }} />
            <div className="flex flex-col">
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1 }}>
                RePlate
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', lineHeight: 1.2 }}>
                Civic Food Logistics
              </span>
            </div>
          </div>

          <nav className="hidden xl:flex items-center gap-6">
            {['How It Works', 'Network Roles', 'Traceability & Trust', 'Municipal Hubs'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ & | /g, '-')}`}
                style={{ fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.15s' }}
                className="hover:!text-[var(--text-primary)]">
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <ThemeToggle />
            <Link to="/login"
              style={{ fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}
              className="hidden md:inline hover:!text-[var(--text-primary)] transition-colors px-2 py-1">
              Logistics Portal
            </Link>
            <Link to="/login" className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.875rem', borderRadius: 8 }}>
              Coordinate Surplus Food
            </Link>
          </div>
        </div>
      </header>

      <main className="w-full pt-20" style={{ background: 'var(--bg-base)' }}>

        {/* ── Civic Broadcast Ticker ── */}
        <div style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-hair)', padding: '6px 24px' }}>
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2"
            style={{ fontFamily: 'var(--font-ui)', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Metro Core Live Network:</span>
              {stats?.active_deliveries != null
                ? <span>{stats.active_deliveries} Active Deliveries</span>
                : <span>Loading network data…</span>}
              {stats?.total_food_rescued_kg != null && (
                <><span style={{ color: 'var(--border-med)' }}>•</span>
                <span>{stats.total_food_rescued_kg.toFixed(0)} kg Total Rescued</span></>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline">HACCP Telemetry Stream: Nominal (99.8% Compliance)</span>
              <span style={{ color: 'var(--moss)', fontWeight: 700 }} className="flex items-center gap-1">
                <ShieldCheck size={14} />
                FSSAI Traceability Compliant
              </span>
            </div>
          </div>
        </div>

        {/* ── Hero Section ── */}
        <section id="how-it-works" className="w-full py-10 lg:py-14 px-4 lg:px-8 overflow-hidden" style={{ background: 'var(--bg-base)' }}>
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">

            {/* Left: Narrative Copy */}
            <div className="lg:col-span-6 flex flex-col items-start">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-lg"
                style={{ background: 'rgba(27, 94, 59, 0.1)', border: '1px solid rgba(27, 94, 59, 0.2)' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss)' }}>
                  ⇄ Decentralized Perishable Cold-Chain
                </span>
              </div>

              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.25rem)', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 16 }}>
                Coordinate surplus food from kitchens to communities.
              </h1>

              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '1rem', lineHeight: 1.65, color: 'var(--text-secondary)', marginBottom: 28, maxWidth: '42ch' }}>
                A verified logistics network connecting commercial kitchens, community meal programs, and cold-chain transport in real time — safely, legally, and strictly within the perishable window.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mb-8">
                <Link to="/login" className="btn-primary flex items-center justify-center gap-2" style={{ padding: '12px 24px', borderRadius: 8 }}>
                  List Surplus Food <ArrowRight size={16} />
                </Link>
                <a href="#network-roles" className="btn-secondary flex items-center justify-center gap-2" style={{ padding: '12px 24px', borderRadius: 8 }}>
                  Explore Network Nodes
                </a>
              </div>

              {/* Right: Live Data Grid */}
            </div>
            <div className="lg:col-span-6 w-full">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                  <span className="section-label block mb-2 text-moss">Active Deliveries</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--moss)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {stats?.active_deliveries != null ? stats.active_deliveries : '—'}
                  </span>
                </div>
                <div className="p-6 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                  <span className="section-label block mb-2 text-terracotta">Active Donations</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--terracotta)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {stats?.active_donations != null ? stats.active_donations : '—'}
                  </span>
                </div>
                <div className="p-6 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                  <span className="section-label block mb-2 text-text-primary">Rescued (kg)</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {stats?.total_food_rescued_kg != null ? stats.total_food_rescued_kg.toFixed(0) : '—'}
                  </span>
                </div>
                <div className="p-6 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                  <span className="section-label block mb-2 text-text-secondary">Network Nodes</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-secondary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {stats?.registered_donors != null ? stats.registered_donors : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section A: Closed Loop Workflow ── */}
        <section id="logistical-sequence" className="w-full py-12 lg:py-16 px-4 lg:px-8" style={{ background: 'var(--bg-inset)', borderTop: '1px solid var(--border-hair)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
              <div>
                <span className="section-label block mb-2" style={{ color: 'var(--terracotta)' }}>Logistical Sequence</span>
                <h2 className="heading-section">The Closed Loop of Civic Food Recovery</h2>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '40ch', lineHeight: 1.65 }}>
                Unlike manual donation calls or unmonitored drop-offs, RePlate executes within a strict 45-minute safe window backed by core-temp verification.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {LIFECYCLE_STEPS.map((step) => (
                <div key={step.step} className="flex flex-col justify-between p-6 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--terracotta)' }}>{step.step}</span>
                    </div>
                    <h3 style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: 8 }}>{step.label}</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{step.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: 'var(--bg-hover)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    <CheckCircle size={14} style={{ color: 'var(--moss)', flexShrink: 0 }} />
                    {step.tag}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section B: Four Operational Roles ── */}
        <section id="network-roles" className="w-full py-12 lg:py-16 px-4 lg:px-8" style={{ background: 'var(--bg-base)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="max-w-2xl mb-10">
              <span className="section-label block mb-2" style={{ color: 'var(--terracotta)' }}>Operational Clarity</span>
              <h2 className="heading-section mb-2">Engineered for Four Operational Roles</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                Food logistics fails when software treats volunteer drivers, commercial executive chefs, and emergency food pantries with the same generic interface.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Role 1: Donors — 7 col */}
              <div className="lg:col-span-7 flex flex-col justify-between p-8 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded text-xs font-bold uppercase" style={{ color: 'var(--moss)' }}>Role 01</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hotels • Grocers • Convention Kitchens</span>
                    </div>
                                      </div>
                  <h3 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)', marginBottom: 8 }}>Commercial Food Donors</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 16 }}>
                    Designed for line cooks and banquet stewards wrapping up high-volume closing shifts. Zero endless forms — record full speed racks by tray count, attach quick thermal verification, and return to service.
                  </p>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[{ label: 'Avg Submission', val: '2.5 min' }, { label: 'Dock Protocol', val: 'Driver Geofenced' }, { label: 'Regulatory Compliance', val: 'SWM Rules 2026', green: true }].map((s) => (
                      <div key={s.label} className="p-3 rounded-lg" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hair)' }}>
                        <span className="section-label block">{s.label}</span>
                        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: s.green ? 'var(--moss)' : 'var(--text-primary)' }}>{s.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-inset)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  <span>Features: Auto-printed pallet thermal tags, HACCP audit log, and instant safe harbor waiver.</span>
                  <CheckCircle size={18} style={{ color: 'var(--moss)', flexShrink: 0 }} />
                </div>
              </div>

              {/* Role 2: NGO — 5 col */}
              <div className="lg:col-span-5 flex flex-col justify-between p-8 rounded-xl" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded text-xs font-bold uppercase" style={{ color: 'var(--terracotta)' }}>Role 02</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shelters & Dining Rooms</span>
                    </div>
                                      </div>
                  <h3 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)', marginBottom: 8 }}>NGO Meal Programs</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 12 }}>
                    Complete control over your intake docks. You specify daily cooler volume capacity and dietary requirements. Never receive a surprise pallet you cannot safely refrigerate.
                  </p>
                  <ul className="flex flex-col gap-2 mb-6">
                    {['Dynamic refrigeration capacity limits', 'Allergen and religious dietary filtering', 'Direct driver arrival phone-to-bay alert'].map((item) => (
                      <li key={item} className="flex items-center gap-2" style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        <CheckCircle size={16} style={{ color: 'var(--moss)', flexShrink: 0 }} /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 rounded-lg" style={{ background: '#ffffff', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Intake Guarantee: 100% pre-vetted perishable acceptance windows.
                </div>
              </div>

              {/* Role 3: Drivers — 5 col */}
              <div className="lg:col-span-5 flex flex-col justify-between p-8 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded text-xs font-bold uppercase" style={{ color: 'var(--moss)' }}>Role 03</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fleet & Dedicated Transit</span>
                    </div>
                                      </div>
                  <h3 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)', marginBottom: 8 }}>Certified Transport Drivers</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 12 }}>
                    Built for drivers on the road. High-contrast typography, large touch targets, automated dock access instructions, and continuous reefer temperature sync.
                  </p>
                  <div className="p-3 rounded-lg flex flex-col gap-1 mb-4" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hair)' }}>
                    <div className="flex justify-between" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Dispatch In-Cab Terminal</span>
                      <span style={{ color: 'var(--moss)', fontWeight: 700 }}>Active</span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Integrated digital thermometer probe sync & single-tap custodial transfer.</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-inset)', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                  <span>Automated loading bay passcode sharing</span>
                  
                </div>
              </div>

              {/* Role 4: Municipal — 7 col */}
              <div className="lg:col-span-7 flex flex-col justify-between p-8 rounded-xl" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded text-xs font-bold uppercase" style={{ color: 'var(--terracotta)' }}>Role 04</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>City Hall • Health Inspectors • Sustainability Dept</span>
                    </div>
                                      </div>
                  <h3 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)', marginBottom: 8 }}>Municipal Hubs & Civic Oversight</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 16 }}>
                    Macro-level urban visibility. City administrators track real-time tons diverted from landfill, cold-chain safety compliance across districts, and geographic neighborhood coverage equity.
                  </p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {[
                      { label: 'Landfill Diversion', val: 'Tracked', sub: 'Real-time municipal reporting', color: 'var(--terracotta)' },
                      { label: 'Health Code Compliance', val: 'Monitored', sub: 'FSSAI guidelines compliant', color: 'var(--moss)' },
                    ].map((m) => (
                      <div key={m.label} className="p-4 rounded-lg" style={{ background: '#ffffff', border: '1px solid var(--border-hair)' }}>
                        <span className="section-label block mb-1" style={{ color: m.color }}>{m.label}</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', display: 'block', fontVariantNumeric: 'tabular-nums' }}>{m.val}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.sub}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-inset)', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                  <span>Exportable municipal ESG and carbon reduction reporting ready for council presentation.</span>
                  <Download size={18} style={{ color: 'var(--moss)', flexShrink: 0 }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section D: Traceability & Legal Trust ── */}
        <section id="traceability-trust" className="w-full py-12 lg:py-16 px-4 lg:px-8" style={{ background: 'var(--bg-base)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="max-w-2xl mb-10">
              <span className="section-label block mb-2" style={{ color: 'var(--terracotta)' }}>Institutional Grade Safeguards</span>
              <h2 className="heading-section mb-2">Traceability & Legal Trust</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                Removing fear from food donation through strict digital documentation and traceability and automated sanitary telemetry.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
              {TRUST_PILLARS.map((p) => (
                <div key={p.title} className="flex flex-col justify-between p-8 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                  <div>
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-5 ${p.iconBg}`} style={{ color: p.iconColor.replace('text-[', '').replace(']', '') }}>
                      {p.icon}
                    </div>
                    <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 8 }}>{p.title}</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 16 }}>{p.desc}</p>
                  </div>
                  <div className="p-2 rounded" style={{ background: 'var(--bg-hover)', fontSize: '0.8125rem', fontWeight: 600 }}>
                    <span className={p.badgeColor}>{p.badge}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Trust banner */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-xl" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hair)' }}>
              <div className="flex items-center gap-4">
                <ShieldCheck size={28} style={{ color: 'var(--moss)', flexShrink: 0 }} />
                <div>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', display: 'block' }}>Health Department Recognized Protocol</span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Aligned with FSSAI Surplus Food Regulations for perishable food rescue diversion.</span>
                </div>
              </div>
              <button className="btn-secondary shrink-0" style={{ padding: '10px 20px', borderRadius: 8 }}>
                Review Legal Documentation
              </button>
            </div>
          </div>
        </section>

        {/* ── Section E: Dual CTA ── */}
        <section id="civic-deployment" className="w-full py-14 lg:py-20 px-4 lg:px-8" style={{ background: 'var(--bg-hover)', borderTop: '1px solid var(--border-hair)' }}>
          <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
            <span className="section-label mb-3" style={{ color: 'var(--moss)' }}>Civic Deployment</span>
            <h2 className="heading-major mb-4" style={{ maxWidth: '24ch', fontSize: 'clamp(1.75rem, 4vw, 2.25rem)' }}>
              Ready to activate food recovery at your facility?
            </h2>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '50ch', lineHeight: 1.65, marginBottom: 32 }}>
              Join commercial kitchens, transit networks, and social organizations transforming food surplus into civic resilience.
            </p>

            <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-5 text-left mb-10">
              <div className="flex flex-col justify-between p-8 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                                        <span className="px-2 py-1 rounded text-xs font-bold uppercase" style={{ background: 'rgba(27,94,59,0.1)', color: 'var(--moss)' }}>For Kitchens</span>
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)', marginBottom: 8 }}>Commercial & Hotel Donors</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 20 }}>
                    Set up your kitchen dock in under 10 minutes. Receive automatic Solid Waste Management Rules 2026 compliance documentation.
                  </p>
                </div>
                <Link to="/login" className="btn-primary flex items-center justify-center gap-2" style={{ padding: '12px 24px', borderRadius: 8 }}>
                  Register Kitchen Node <ArrowRight size={16} />
                </Link>
              </div>

              <div className="flex flex-col justify-between p-8 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                                        <span className="px-2 py-1 rounded text-xs font-bold uppercase" style={{ background: 'rgba(162,62,24,0.1)', color: 'var(--terracotta)' }}>For Non-Profits</span>
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)', marginBottom: 8 }}>Meal Programs & Pantries</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 20 }}>
                    Define your schedule and intake storage limits. Receive high-quality, hot or cold-stored nutritious food delivered directly to your loading zone.
                  </p>
                </div>
                <Link to="/login" className="btn-secondary flex items-center justify-center gap-2" style={{ padding: '12px 24px', borderRadius: 8 }}>
                  Apply as Verified Recipient <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <span>Need urgent perishable dispatch today?</span>
              <span className="flex items-center gap-1" style={{ color: 'var(--terracotta)', fontWeight: 700 }}>
                <Phone size={14} /> Hotline: 1-800-555-PLTE
              </span>
              <span style={{ color: 'var(--border-med)' }}>•</span>
              <span>Average Courier Response: &lt; 28 mins</span>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer style={{ background: 'var(--bg-inset)', borderTop: '1px solid var(--border-hair)', marginTop: 0 }}>
        <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-8" style={{ borderBottom: '1px solid var(--border-hair)' }}>
            {/* Brand */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Leaf size={20} style={{ color: 'var(--moss)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>RePlate Municipal Infrastructure</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '36ch', lineHeight: 1.65 }}>
                Decentralized municipal food logistics routing surplus commercial inventory to neighborhood social infrastructure under strict sanitary custody controls.
              </p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <CheckCircle size={14} style={{ color: 'var(--moss)' }} /> FSSAI Surplus Food Regulations 2019 Traceability
                </div>
                <div className="flex items-center gap-2" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <CheckCircle size={14} style={{ color: 'var(--moss)' }} /> Cold-Chain Telemetry & HACCP Hazard Analysis Standardized
                </div>
              </div>
            </div>

            {/* Municipal Nodes */}
            <div className="flex flex-col gap-3">
              <span className="section-label" style={{ color: 'var(--text-muted)' }}>Municipal Nodes</span>
              <ul className="flex flex-col gap-2">
                {['Metro Logistics Hub 01 (Central)', 'Bayside Cold Transit Warehouse', 'Midtown Community Cross-Dock', 'Industrial Valley Micro-Hub', 'Regional Depot Dispatch 04'].map((n) => (
                  <li key={n} style={{ fontSize: '0.875rem', color: 'var(--text-primary)', cursor: 'pointer' }}
                    className="hover:!text-[var(--moss)] transition-colors">{n}</li>
                ))}
              </ul>
            </div>

            {/* Network Roles */}
            <div className="flex flex-col gap-3">
              <span className="section-label" style={{ color: 'var(--text-muted)' }}>Network Roles</span>
              <ul className="flex flex-col gap-2">
                {['Commercial Food Donors', 'Certified Transit Drivers', 'NGO Relief Pantries & Kitchens', 'Cold-Chain Compliance Officers', 'Municipal Emergency Dispatchers'].map((r) => (
                  <li key={r} style={{ fontSize: '0.875rem', color: 'var(--text-primary)', cursor: 'pointer' }}
                    className="hover:!text-[var(--moss)] transition-colors">{r}</li>
                ))}
              </ul>
            </div>

            {/* Emergency */}
            <div className="flex flex-col gap-3">
              <span className="section-label" style={{ color: 'var(--text-muted)' }}>Emergency & Support</span>
              <div className="p-4 rounded-lg" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 1px 4px rgba(24,29,26,0.04)' }}>
                <span className="section-label block mb-1" style={{ color: 'var(--terracotta)' }}>Urgent Dispatch Hotline</span>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', display: 'block' }}>1-800-555-PLTE</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>24/7 Rapid Intake & Perishable Reroute</span>
              </div>
              <div>
                <span className="section-label block mb-1">Civic Operating Hours</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Mon – Sun: 04:00 – 23:30 Local Node Time</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            <div className="flex items-center gap-4">
              <span>© 2025 RePlate Civic Infrastructure Project. All rights reserved.</span>
              <span>Municipal Data License CC-BY 4.0</span>
            </div>
            <div className="flex items-center gap-4">
              {['Logistics Compliance', 'Cold Chain Protocol', 'Liability Terms', 'Privacy & Telemetry'].map((l) => (
                <a key={l} href="#" style={{ color: 'var(--text-muted)', textDecoration: 'none' }} className="hover:!text-[var(--text-primary)] transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
