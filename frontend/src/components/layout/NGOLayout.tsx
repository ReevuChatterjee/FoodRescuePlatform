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
  const gaugeColor = capacityUsedPct > 90 ? 'bg-error' : capacityUsedPct > 70 ? 'bg-warning' : 'bg-primary-container';
  const textColor = capacityUsedPct > 90 ? 'text-error' : capacityUsedPct > 70 ? 'text-warning' : 'text-primary-container';

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-surface-container-lowest">
      {/* Logo / org name */}
      <div className="px-5 pt-6 pb-5 border-b border-outline-variant flex-shrink-0">
        <p className="text-[0.6875rem] font-bold text-on-surface-variant tracking-wider uppercase mb-1">
          Distributor Node
        </p>
        {profile && (
          <p className="text-[0.9375rem] font-bold text-on-surface tracking-tight truncate">
            {profile.organisation_name}
          </p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 pt-4 flex flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                active 
                  ? 'bg-primary-container text-on-primary-container' 
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
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
        <div className="mx-4 mb-4 p-4 border border-outline-variant rounded-lg bg-surface-container">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[0.6875rem] font-bold text-on-surface-variant tracking-wider uppercase">Capacity</span>
            <span className={`text-xs font-bold font-mono-data ${textColor}`}>
              {capacityUsedPct.toFixed(0)}%
            </span>
          </div>
          {/* Horizontal bar gauge */}
          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden mb-2">
            <div
              className={`h-full ${gaugeColor} transition-all duration-500 ease-out`}
              style={{ width: `${Math.min(capacityUsedPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[0.6875rem] font-medium text-on-surface-variant">
              {profile.available_capacity_kg} kg free
            </span>
            <span className="text-[0.6875rem] font-medium text-on-surface">
              {profile.storage_capacity_kg} kg total
            </span>
          </div>
        </div>
      )}

      {/* User + logout */}
      <div className="p-4 border-t border-outline-variant flex items-center gap-3 flex-shrink-0 bg-surface">
        <div className="w-8 h-8 flex items-center justify-center text-xs font-bold bg-surface-container-high rounded-full text-on-surface flex-shrink-0">
          {user?.name?.charAt(0)?.toUpperCase() || 'N'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">{user?.name}</p>
        </div>
        <ThemeToggle />
        <button
          onClick={handleLogout}
          title="Sign out"
          className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container rounded-md transition-colors flex-shrink-0"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col flex-shrink-0 h-full border-r border-outline-variant w-[260px]">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] border-r border-outline-variant bg-surface-container-lowest">
            <div className="absolute top-4 right-4 z-10">
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-md"><X size={20} /></button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main — no topbar, content starts immediately */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile burger only */}
        <div className="lg:hidden flex items-center px-4 border-b border-outline-variant h-14 flex-shrink-0 bg-surface-container-lowest">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-md">
            <Menu size={20} />
          </button>
          <span className="ml-3 text-sm font-bold text-on-surface tracking-tight">
            {profile?.organisation_name ?? 'NGO Portal'}
          </span>
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
