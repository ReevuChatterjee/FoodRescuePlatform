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
} from 'lucide-react';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useAnalyticsOverview } from '../../hooks/useAnalytics';
import { ThemeToggle } from '../common/ThemeToggle';

const NAV = [
  { label: 'Network Overview', href: '/admin', icon: <BarChart2 size={16} />, short: 'Overview' },
  { label: 'Verification Queue', href: '/admin/ngos/verify', icon: <CheckSquare size={16} />, short: 'Verify' },
  { label: 'NGO Registry', href: '/admin/ngos', icon: <Users size={16} />, short: 'Registry' },
];

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
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* ── Desktop Sidebar: icon rail (expands on hover) ── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 h-full transition-all duration-200 border-r"
        style={{
          width: sidebarExpanded ? '220px' : '48px',
          background: 'var(--bg-panel)',
          borderColor: 'var(--border-hair)',
          overflow: 'hidden',
        }}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        {/* Logo mark */}
        <div
          className="flex items-center h-12 flex-shrink-0 border-b"
          style={{ borderColor: 'var(--border-hair)', padding: '0 12px' }}
        >
          <div
            className="w-6 h-6 flex-shrink-0 flex items-center justify-center"
            style={{ background: 'var(--moss)', borderRadius: '1px' }}
          >
            <Activity size={12} style={{ color: '#C8DFC9' }} />
          </div>
          {sidebarExpanded && (
            <span
              className="ml-3 text-xs font-semibold whitespace-nowrap"
              style={{ color: 'var(--text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              Admin
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-1 p-1.5 pt-2">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                title={!sidebarExpanded ? item.label : undefined}
                className={`nav-item-icon ${active ? 'active' : ''} ${sidebarExpanded ? 'w-full justify-start px-2.5 gap-3' : ''}`}
                style={{ width: sidebarExpanded ? '100%' : '36px', height: '36px', display: 'flex', alignItems: 'center' }}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {sidebarExpanded && (
                  <span className="text-sm whitespace-nowrap" style={{ fontWeight: 500, color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t p-1.5" style={{ borderColor: 'var(--border-hair)' }}>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="nav-item-icon w-full hover:text-[var(--terracotta)]"
            style={{ width: sidebarExpanded ? '100%' : '36px', display: 'flex', alignItems: 'center', gap: sidebarExpanded ? '10px' : 0, padding: '0 10px' }}
          >
            <LogOut size={14} className="flex-shrink-0" />
            {sidebarExpanded && (
              <span className="text-sm whitespace-nowrap" style={{ color: 'var(--terracotta)' }}>Sign out</span>
            )}
          </button>
        </div>
      </aside>

      {/* ── Mobile Overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="absolute left-0 top-0 bottom-0 w-64 flex flex-col border-r"
            style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-hair)' }}
          >
            <div className="flex items-center justify-between h-12 px-4 border-b" style={{ borderColor: 'var(--border-hair)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Admin</span>
              <button onClick={() => setMobileOpen(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            <nav className="flex-1 p-2 flex flex-col gap-1">
              {NAV.map((item) => (
                <Link key={item.href} to={item.href} className={`nav-item ${isActive(item.href) ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
                  {item.icon}{item.label}
                </Link>
              ))}
            </nav>
            <div className="p-2 border-t" style={{ borderColor: 'var(--border-hair)' }}>
              <button onClick={handleLogout} className="nav-item w-full" style={{ color: 'var(--terracotta)' }}>
                <LogOut size={14} /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Topbar with live ticker */}
        <header
          className="flex items-center flex-shrink-0 border-b"
          style={{
            height: '48px',
            padding: '0 20px',
            background: 'var(--bg-base)',
            borderColor: 'var(--border-hair)',
          }}
        >
          <button className="btn-ghost p-1.5 lg:hidden mr-2" onClick={() => setMobileOpen(true)}>
            <Menu size={16} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 flex-1">
            <span className="section-label">Admin</span>
            <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} />
            <span className="section-label" style={{ color: 'var(--text-primary)' }}>
              {NAV.find((n) => isActive(n.href))?.short ?? 'Dashboard'}
            </span>
          </div>

          {/* Live ticker strip */}
          {overview && (
            <div className="hidden sm:flex items-center gap-5">
              {[
                { label: 'Active Deliveries', value: overview.active_deliveries },
                { label: 'Pending Donations', value: overview.active_donations },
                { label: 'Available Drivers', value: overview.available_drivers },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-2">
                  <span className="section-label">{t.label}</span>
                  <span
                    className="font-display text-sm"
                    style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {t.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Theme toggle + user chip */}
          <div className="flex items-center gap-2 ml-5">
            <ThemeToggle />
            <div
              className="w-5 h-5 flex items-center justify-center text-[10px] font-semibold"
              style={{ background: 'var(--bg-hover)', borderRadius: '1px', color: 'var(--text-primary)' }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <span className="hidden sm:block text-xs" style={{ color: 'var(--text-secondary)' }}>{user?.name}</span>
          </div>
        </header>


        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ padding: '32px 28px' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
