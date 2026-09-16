/**
 * LandingPage — public-facing homepage.
 * Shows live platform stats from analytics endpoint.
 * Designed as a high-density, functional utility landing page.
 */

import { Link } from 'react-router-dom';
import { Package, Truck, Heart, ArrowRight, BarChart2 } from 'lucide-react';
import { useAnalyticsOverview } from '../hooks/useAnalytics';

export function LandingPage() {
  const { data: stats } = useAnalyticsOverview();

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Navbar ── */}
      <nav className="border-b border-zinc-800 bg-zinc-950 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-emerald-500 rounded-sm" />
          <span className="font-semibold tracking-tight text-zinc-100">RePlate</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost">Sign In</Link>
          <Link to="/login" className="btn-primary">Get Started</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col justify-center px-6 py-24 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-zinc-100 mb-6 leading-tight">
              Algorithmic Food-Waste Routing & Micro-Donations
            </h1>
            <p className="text-lg text-zinc-400 mb-8 max-w-lg leading-relaxed">
              A real-time logistics platform connecting surplus food from donors directly to NGOs with the highest demand and capacity, utilizing volunteer driver dispatch.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/login" className="btn-primary px-6 py-3">
                Access Platform <ArrowRight size={16} />
              </Link>
              <a href="#architecture" className="btn-secondary px-6 py-3">
                View Architecture
              </a>
            </div>
          </div>

          {/* Live Data Panel */}
          <div className="panel flex flex-col justify-center">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <BarChart2 size={16} className="text-emerald-500" /> Live System Metrics
              </h2>
              <span className="badge-green">Operational</span>
            </div>
            
            <div className="grid grid-cols-2 gap-y-8 gap-x-4">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Active Donations</p>
                <p className="text-3xl font-bold text-zinc-100 tabular-nums">
                  {stats?.active_donations ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Active Deliveries</p>
                <p className="text-3xl font-bold text-zinc-100 tabular-nums">
                  {stats?.active_deliveries ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Total Food Rescued</p>
                <p className="text-3xl font-bold text-zinc-100 tabular-nums">
                  {stats?.total_food_rescued_kg?.toFixed(0) ?? 0} <span className="text-sm font-normal text-zinc-500">kg</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Registered Nodes</p>
                <p className="text-3xl font-bold text-zinc-100 tabular-nums">
                  {(stats?.registered_ngos ?? 0) + (stats?.registered_donors ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Architecture / Workflow ── */}
      <section id="architecture" className="border-t border-zinc-800 bg-zinc-900 py-24 px-6">
        <div className="max-w-5xl mx-auto w-full">
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-zinc-100 mb-2">System Architecture</h2>
            <p className="text-zinc-400">Four-stage algorithmic routing pipeline.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: <Package size={20} />, step: '01', title: 'Data Ingestion', desc: 'Donors submit payload containing food category, quantity, location, and expiry timestamp.' },
              { icon: <ArrowRight size={20} />, step: '02', title: 'Algorithmic Matching', desc: 'Scoring engine ranks NGOs based on real-time storage capacity, proximity, and stated demand.' },
              { icon: <Truck size={20} />, step: '03', title: 'Driver Dispatch', desc: 'System broadcasts payload to available drivers for pickup and delivery routing.' },
              { icon: <Heart size={20} />, step: '04', title: 'Verification', desc: 'NGO validates receipt. System updates analytics, capacity thresholds, and donor logs.' },
            ].map((s) => (
              <div key={s.step} className="panel bg-zinc-950 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-zinc-500">{s.icon}</span>
                  <span className="text-xs font-mono text-zinc-600">{s.step}</span>
                </div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-2">{s.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800 py-8 px-6">
        <div className="max-w-5xl mx-auto w-full flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-500 rounded-sm" />
            <span className="text-sm font-medium text-zinc-300">RePlate</span>
          </div>
          <p className="text-xs text-zinc-500">© 2026 Core Platform Infrastructure</p>
        </div>
      </footer>
    </div>
  );
}
