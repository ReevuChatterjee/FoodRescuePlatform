/**
 * AdminLayout — 3-panel command layout.
 * Structure: narrow icon rail (48px) | main content | optional collapsible detail drawer
 * Topbar: inline live ticker showing active delivery count.
 * Skeleton is unmistakably a multi-panel ops tool, not a generic dashboard.
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart2, CheckSquare, Users, LogOut, Menu, X, Activity, ChevronRight,
  Building2, Truck, Radio, MapPin, FileText, Settings
} from 'lucide-react';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useAnalyticsOverview } from '../../hooks/useAnalytics';
import { ThemeToggle } from '../common/ThemeToggle';

const NAV_GROUPS = [
  {
    group: 'OPERATIONS',
    items: [
      { label: 'Network Overview', href: '/admin', icon: <BarChart2 size={16} />, short: 'Overview' },
      { label: 'Verification Queue', href: '/admin/ngos/verify', icon: <CheckSquare size={16} />, short: 'Verify' },
      { label: 'NGO Registry', href: '/admin/ngos', icon: <Building2 size={16} />, short: 'NGOs' },
      { label: 'Donor Registry', href: '/admin/donors', icon: <Users size={16} />, short: 'Donors' },
      { label: 'Driver Registry', href: '/admin/drivers', icon: <Truck size={16} />, short: 'Drivers' },
    ]
  },
  {
    group: 'NETWORK',
    items: [
      { label: 'Active Deliveries', href: '/admin/deliveries', icon: <Activity size={16} />, short: 'Deliveries' },
      { label: 'Live Network', href: '/admin/network', icon: <Radio size={16} />, short: 'Live' },
      { label: 'Traceability', href: '/admin/traceability', icon: <MapPin size={16} />, short: 'Trace' },
    ]
  },
  {
    group: 'SYSTEM',
    items: [
      { label: 'Reports', href: '/admin/reports', icon: <FileText size={16} />, short: 'Reports' },
      { label: 'Settings', href: '/admin/settings', icon: <Settings size={16} />, short: 'Settings' },
    ]
  }
];

const ALL_NAV = NAV_GROUPS.flatMap(g => g.items);

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const { user, clearAuth } = useAuthStore();
  const { data: overview } = useAnalyticsOverview();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => { clearAuth(); navigate('/login'); };

  const isActive = (href: string) => {
    if (href === '/admin' || href === '/admin/ngos') return location.pathname === href;
    return location.pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface">

      {/* ── Desktop Sidebar: icon rail (expands on hover) ── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 h-full transition-all duration-200 border-r border-outline-variant bg-surface-container-lowest overflow-hidden z-20"
        style={{ width: sidebarExpanded ? '220px' : '52px' }}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        {/* Logo mark */}
        <div className="flex items-center h-16 flex-shrink-0 border-b border-outline-variant px-3.5">
          <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center bg-primary rounded-lg">
            <Activity size={14} className="text-on-primary" />
          </div>
          {sidebarExpanded && (
            <span className="ml-3 text-[0.6875rem] font-bold whitespace-nowrap text-on-surface-variant tracking-wider uppercase">
              Admin Node
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto flex flex-col p-2 pt-6 no-scrollbar">
          {NAV_GROUPS.map((g) => (
            <div key={g.group} className="flex flex-col gap-1 mb-6 last:mb-0">
              {sidebarExpanded && (
                <div className="px-3 pb-2 text-[0.65rem] font-bold text-on-surface-variant/60 tracking-widest uppercase">
                  {g.group}
                </div>
              )}
              {g.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    title={!sidebarExpanded ? item.label : undefined}
                    className={`flex items-center rounded-r-lg transition-colors overflow-hidden ${
                      active 
                        ? 'bg-primary-container border-l-[3px] border-primary text-on-primary-container' 
                        : 'border-l-[3px] border-transparent text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                    style={{ height: '36px' }}
                  >
                    <div className="w-9 h-full flex items-center justify-center flex-shrink-0 ml-[1px]">
                      {/* Enforce consistent icon rendering via cloning or standard props. Since we pass the element, we can clone it to ensure consistent stroke width, but lucide already uses consistent defaults. */}
                      {item.icon}
                    </div>
                    {sidebarExpanded && (
                      <span className="text-[0.875rem] font-medium whitespace-nowrap pl-1 pr-3">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-outline-variant p-2">
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex items-center w-full rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container transition-colors overflow-hidden"
            style={{ height: '40px' }}
          >
            <div className="w-9 h-full flex items-center justify-center flex-shrink-0">
              <LogOut size={16} />
            </div>
            {sidebarExpanded && (
              <span className="text-sm font-semibold whitespace-nowrap pl-1 pr-3 text-error">Sign out</span>
            )}
          </button>
        </div>
      </aside>

      {/* ── Mobile Overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] flex flex-col border-r border-outline-variant bg-surface-container-lowest">
            <div className="flex items-center justify-between h-14 px-4 border-b border-outline-variant">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center bg-primary rounded-lg">
                  <Activity size={14} className="text-on-primary" />
                </div>
                <span className="text-sm font-bold text-on-surface tracking-tight">Admin Node</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-md"><X size={20} /></button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
              {NAV_GROUPS.map((g) => (
                <div key={g.group} className="flex flex-col gap-0.5">
                  <div className="px-3 pb-1 text-[0.65rem] font-bold text-on-surface-variant/70 tracking-widest uppercase">
                    {g.group}
                  </div>
                  {g.items.map((item) => (
                    <Link key={item.href} to={item.href} 
                      className={`flex items-center gap-3 px-3 py-2 rounded-r-lg text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? 'bg-primary-container border-l-[3px] border-primary text-on-primary-container'
                          : 'border-l-[3px] border-transparent text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`}
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.icon}{item.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
            <div className="p-4 border-t border-outline-variant">
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-error hover:bg-error-container rounded-lg transition-colors">
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Topbar with live ticker */}
        <header className="flex items-center flex-shrink-0 border-b border-outline-variant h-14 px-4 lg:px-6 bg-surface-container-lowest">
          <button className="p-1.5 lg:hidden mr-3 text-on-surface-variant hover:bg-surface-container rounded-md" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[0.6875rem] font-bold text-on-surface-variant tracking-wider uppercase hidden sm:inline">Admin Node</span>
            <ChevronRight size={12} className="text-outline hidden sm:block" />
            <span className="text-sm font-bold text-on-surface tracking-tight">
              {ALL_NAV.find((n) => isActive(n.href))?.short ?? 'Dashboard'}
            </span>
          </div>

          {/* Live ticker strip */}
          {overview && (
            <div className="hidden md:flex items-center gap-6 mr-6 pr-6 border-r border-outline-variant">
              {[
                { label: 'Active Deliveries', value: overview.active_deliveries },
                { label: 'Pending Donations', value: overview.active_donations },
                { label: 'Available Drivers', value: overview.available_drivers },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-2">
                  <span className="text-[0.6875rem] font-bold text-on-surface-variant tracking-wider uppercase">{t.label}</span>
                  <span className="text-sm font-bold font-mono-data text-primary">
                    {t.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Theme toggle + user chip */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2 border-l border-outline-variant pl-4 ml-1">
              <span className="hidden lg:block text-xs font-semibold text-on-surface-variant pr-1">Platform Admin</span>
              <div className="w-6 h-6 flex items-center justify-center text-[10px] font-bold bg-primary rounded-full text-on-primary shadow-sm">
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
            </div>
          </div>
        </header>


        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-surface">
          <div className="max-w-[1280px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
