/**
 * DonorLayout — thin icon rail + single-column editorial content.
 * Feels like a personal ledger/history app, not a SaaS dashboard.
 * Content max-width: 800px. Airy spacing. Sidebar is icon-only on desktop.
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Plus, LogOut, Menu, X, Leaf } from 'lucide-react';
import { useAuthStore } from '../../hooks/useAuthStore';
import { ThemeToggle } from '../common/ThemeToggle';

const NAV = [
  { label: 'My Donations', href: '/donor', icon: <LayoutDashboard size={16} /> },
  { label: 'New Donation', href: '/donor/donate', icon: <Plus size={16} /> },
];

interface DonorLayoutProps {
  children: React.ReactNode;
}

export function DonorLayout({ children }: DonorLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, clearAuth } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => { clearAuth(); navigate('/login'); };

  const isActive = (href: string) =>
    href === '/donor' ? location.pathname === href : location.pathname.startsWith(href);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* ── Desktop: thin icon sidebar ── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 h-full border-r"
        style={{
          width: '52px',
          background: 'var(--bg-panel)',
          borderColor: 'var(--border-hair)',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-center h-14 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-hair)' }}
        >
          <div
            style={{
              width: '24px', height: '24px',
              background: 'var(--moss)',
              borderRadius: '1px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Leaf size={12} style={{ color: '#C8DFC9' }} />
          </div>
        </div>

        {/* Nav icons */}
        <nav className="flex-1 flex flex-col items-center gap-1 pt-3">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                title={item.label}
                className={`nav-item-icon ${active ? 'active' : ''}`}
              >
                {item.icon}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="flex flex-col items-center pb-4 gap-2">
          <div
            className="w-7 h-7 flex items-center justify-center text-[10px] font-semibold"
            style={{ background: 'var(--bg-hover)', borderRadius: '1px', color: 'var(--text-primary)' }}
          >
            {user?.name?.charAt(0)?.toUpperCase() || 'D'}
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="nav-item-icon hover:text-[var(--terracotta)]"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* ── Mobile Overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setMobileOpen(false)} />
          <aside
            className="absolute left-0 top-0 bottom-0 w-64 flex flex-col border-r"
            style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-hair)' }}
          >
            <div className="flex items-center justify-between h-14 px-4 border-b" style={{ borderColor: 'var(--border-hair)' }}>
              <div className="flex items-center gap-2">
                <Leaf size={14} style={{ color: 'var(--moss-light)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Donations</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            <nav className="flex-1 p-2 flex flex-col gap-1">
              {NAV.map((item) => (
                <Link key={item.href} to={item.href} className={`nav-item ${isActive(item.href) ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
                  {item.icon}{item.label}
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t" style={{ borderColor: 'var(--border-hair)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{user?.email}</div>
              <button onClick={handleLogout} className="text-sm flex items-center gap-2" style={{ color: 'var(--terracotta)' }}>
                <LogOut size={12} /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main area — narrow editorial column ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Minimal topbar — mobile only burger, desktop just a thin status bar */}
        <header
          className="flex items-center flex-shrink-0 border-b"
          style={{
            height: '52px',
            padding: '0 24px',
            background: 'var(--bg-base)',
            borderColor: 'var(--border-hair)',
          }}
        >
          <button className="btn-ghost p-1.5 lg:hidden mr-3" onClick={() => setMobileOpen(true)}>
            <Menu size={16} />
          </button>
          <div className="flex-1" />
          <ThemeToggle />
          <div className="flex items-center gap-3">
            <span className="section-label hidden sm:block" style={{ color: 'var(--text-muted)' }}>
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="hidden lg:flex section-label items-center gap-1.5 hover:text-[var(--terracotta)] transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <LogOut size={11} /> Sign out
            </button>
          </div>
        </header>

        {/* Content — single column, editorially narrow */}
        <main className="flex-1 overflow-y-auto" style={{ padding: 'var(--sp-6) var(--sp-5)' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
