/**
 * NGOLayout — no topbar. Full sidebar with persistent capacity gauge widget at bottom.
 * Feed + right rail layout for main content.
 * Sidebar width: 220px. Right rail: used by NGODashboard (passed as prop).
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Settings, LogOut, Menu, X } from 'lucide-react';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useMyNGOProfile } from '../../hooks/useNGO';
import { ThemeToggle } from '../common/ThemeToggle';

const NAV = [
  { label: 'Distribution Desk', href: '/ngo', icon: <LayoutDashboard size={15} /> },
  { label: 'Incoming Supply', href: '/ngo/incoming', icon: <Package size={15} /> },
  { label: 'Settings', href: '/ngo/settings', icon: <Settings size={15} /> },
];

interface NGOLayoutProps {
  children: React.ReactNode;
}

export function NGOLayout({ children }: NGOLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, clearAuth } = useAuthStore();
  const { data: profile } = useMyNGOProfile();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => { clearAuth(); navigate('/login'); };

  const isActive = (href: string) =>
    href === '/ngo' ? location.pathname === href : location.pathname.startsWith(href);

  // Capacity derived values for sidebar gauge
  const capacityUsedPct = profile?.storage_capacity_kg && profile.storage_capacity_kg > 0
    ? ((profile.storage_capacity_kg - profile.available_capacity_kg) / profile.storage_capacity_kg) * 100
    : 0;
  const gaugeClass = capacityUsedPct > 90 ? 'critical' : capacityUsedPct > 70 ? 'warning' : '';

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-panel)' }}>
      {/* Logo / org name */}
      <div
        className="px-4 pt-5 pb-4 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-hair)' }}
      >
        <p
          className="text-xs font-semibold truncate"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
        >
          NGO Portal
        </p>
        {profile && (
          <p
            className="text-sm font-semibold mt-1 truncate"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
          >
            {profile.organisation_name}
          </p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 pt-3 flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Persistent Capacity Gauge */}
      {profile && (
        <div
          className="mx-3 mb-3 p-3 border"
          style={{ borderColor: 'var(--border-hair)', borderRadius: '2px', background: 'var(--bg-inset)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="section-label">Capacity</span>
            <span
              className="text-xs font-medium"
              style={{ fontVariantNumeric: 'tabular-nums', color: capacityUsedPct > 90 ? 'var(--terracotta)' : capacityUsedPct > 70 ? 'var(--amber-dim)' : 'var(--moss-light)' }}
            >
              {capacityUsedPct.toFixed(0)}%
            </span>
          </div>
          {/* Horizontal bar gauge */}
          <div className="capacity-bar" style={{ height: '3px' }}>
            <div
              className={`capacity-fill ${gaugeClass}`}
              style={{ width: `${Math.min(capacityUsedPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="section-label" style={{ color: 'var(--text-secondary)' }}>
              {profile.available_capacity_kg} kg free
            </span>
            <span className="section-label">
              {profile.storage_capacity_kg} kg total
            </span>
          </div>
        </div>
      )}

      {/* User + logout */}
      <div
        className="p-3 border-t flex items-center gap-2 flex-shrink-0"
        style={{ borderColor: 'var(--border-hair)' }}
      >
        <div
          className="w-7 h-7 flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
          style={{ background: 'var(--bg-hover)', borderRadius: '1px', color: 'var(--text-primary)' }}
        >
          {user?.name?.charAt(0)?.toUpperCase() || 'N'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user?.name}</p>
        </div>
        <ThemeToggle style={{ width: '28px', height: '28px' }} />
        <button
          onClick={handleLogout}
          title="Sign out"
          className="btn-ghost p-1 flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}
        >
          <LogOut size={13} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 h-full border-r"
        style={{ width: '220px', borderColor: 'var(--border-hair)' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 border-r" style={{ borderColor: 'var(--border-hair)' }}>
            <div className="absolute top-3 right-3 z-10">
              <button onClick={() => setMobileOpen(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main — no topbar, content starts immediately */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile burger only */}
        <div
          className="lg:hidden flex items-center px-4 border-b flex-shrink-0"
          style={{ height: '48px', borderColor: 'var(--border-hair)', background: 'var(--bg-panel)' }}
        >
          <button onClick={() => setMobileOpen(true)} className="btn-ghost p-1.5">
            <Menu size={16} />
          </button>
          <span className="ml-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {profile?.organisation_name ?? 'NGO Portal'}
          </span>
        </div>

        <main className="flex-1 overflow-y-auto" style={{ padding: 'var(--sp-5)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
