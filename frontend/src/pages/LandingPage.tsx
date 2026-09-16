/**
 * LandingPage — public-facing homepage.
 * Shows live platform stats from analytics endpoint.
 * Designed as a high-density, functional utility landing page.
 */

import { Link } from 'react-router-dom';
import { Package, Truck, Heart, ArrowRight, MapPin, CheckCircle2 } from 'lucide-react';
import { useAnalyticsOverview } from '../hooks/useAnalytics';
import { NetworkRadar } from '../components/visuals/NetworkRadar';

export function LandingPage() {
  const { data: stats } = useAnalyticsOverview();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)]">
      {/* ── Navbar ── */}
      <nav className="border-b border-[var(--border-subtle)] bg-[var(--bg-page)] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-[var(--brand)] rounded-sm flex items-center justify-center" />
          <span className="font-semibold tracking-tight text-[var(--text-primary)]">RePlate Ops</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Sign In</Link>
          <Link to="/login" className="btn-primary">Platform Access</Link>
        </div>
      </nav>

      {/* ── Hero: The Living Rescue Network ── */}
      <section className="flex-1 flex flex-col justify-center px-6 py-24 max-w-6xl mx-auto w-full relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative z-10">
            <h1 className="heading-major mb-6 leading-tight">
              Surplus food, coordinated before it is lost.
            </h1>
            <p className="text-lg text-[var(--text-secondary)] mb-8 max-w-lg leading-relaxed">
              Connect the people, places, and routes that move food where it is needed. A real-time logistics network turning available surplus into completed handoffs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/login" className="btn-primary px-6 py-3 text-base">
                Enter Network <ArrowRight size={18} />
              </Link>
              <a href="#traceability" className="btn-secondary px-6 py-3 text-base">
                View Traceability
              </a>
            </div>
          </div>

          {/* Operational Metrics Panel */}
          <div className="panel flex flex-col justify-center border-[var(--border-strong)] relative overflow-hidden h-full min-h-[350px]">
            {/* Embedded SVG Visual */}
            <NetworkRadar />
            
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-[var(--border-subtle)] relative z-10">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <div className="w-2 h-2 rounded-none bg-[var(--success)] animate-pulse" /> Live Network Capacity
              </h2>
              <span className="badge-green">Operational</span>
            </div>
            
            <div className="grid grid-cols-2 gap-y-8 gap-x-4 relative z-10">
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1 uppercase tracking-widest font-semibold">Active Logistics</p>
                <p className="text-4xl font-bold text-[var(--text-primary)] font-mono-data">
                  {stats?.active_deliveries ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1 uppercase tracking-widest font-semibold">Pending Surplus</p>
                <p className="text-4xl font-bold text-[var(--text-primary)] font-mono-data">
                  {stats?.active_donations ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1 uppercase tracking-widest font-semibold">Rescued Volume</p>
                <p className="text-4xl font-bold text-[var(--text-primary)] font-mono-data">
                  {stats?.total_food_rescued_kg?.toFixed(0) ?? 0} <span className="text-sm font-normal text-[var(--text-muted)]">kg</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1 uppercase tracking-widest font-semibold">Network Nodes</p>
                <p className="text-4xl font-bold text-[var(--text-primary)] font-mono-data">
                  {(stats?.registered_ngos ?? 0) + (stats?.registered_donors ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Traceability Lifecycle ── */}
      <section id="traceability" className="border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] py-24 px-6">
        <div className="max-w-6xl mx-auto w-full">
          <div className="mb-16 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-4">A donation moves.</h2>
            <p className="text-lg text-[var(--text-secondary)]">From available surplus to a completed handoff, every step is tracked, allocated, and verified.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { icon: <MapPin size={24} />, step: 'Created', title: 'Surplus Identified', desc: 'Food details, quantity, and location are logged into the system by the donor.', status: 'badge-gray' },
              { icon: <Package size={24} />, step: 'Accepted', title: 'Capacity Matched', desc: 'NGOs with available capacity accept the donation based on geographic proximity.', status: 'badge-blue' },
              { icon: <Truck size={24} />, step: 'Pickup', title: 'Route Dispatched', desc: 'Driver is assigned and routes to the pickup location to collect the surplus.', status: 'badge-orange' },
              { icon: <CheckCircle2 size={24} />, step: 'Delivered', title: 'Handoff Verified', desc: 'NGO confirms receipt, updating network capacity and donor analytics.', status: 'badge-green' },
            ].map((s, idx) => (
              <div key={s.step} className="panel relative overflow-hidden bg-[var(--bg-page)] border-[var(--border-subtle)]">
                {idx !== 3 && (
                  <div className="hidden md:block absolute top-12 -right-3 text-[var(--border-strong)]">
                    <ArrowRight size={24} />
                  </div>
                )}
                <div className="mb-6 flex justify-between items-start">
                  <div className="p-3 bg-[var(--bg-panel-hover)] rounded-md inline-block text-[var(--text-primary)]">
                    {s.icon}
                  </div>
                  <span className={s.status}>{s.step}</span>
                </div>
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">{s.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-page)] py-8 px-6">
        <div className="max-w-6xl mx-auto w-full flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[var(--brand)] rounded-sm" />
            <span className="text-sm font-semibold tracking-tight text-[var(--text-secondary)]">RePlate Ops</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] font-mono-data">System Build 2026.4</p>
        </div>
      </footer>
    </div>
  );
}

