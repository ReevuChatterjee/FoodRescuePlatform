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
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface">

      {/* ── Desktop: thin icon sidebar ── */}
      <aside className="hidden lg:flex flex-col flex-shrink-0 h-full border-r border-outline-variant w-[60px] bg-surface-container-lowest">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 border-b border-outline-variant flex-shrink-0">
          <Leaf size={20} className="text-[var(--moss)]" />
        </div>

        {/* Nav icons */}
        <nav className="flex-1 flex flex-col items-center gap-2 pt-4 px-2">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                title={item.label}
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                  active 
                    ? 'bg-primary-container text-on-primary-container' 
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                {item.icon}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="flex flex-col items-center pb-4 gap-3">
          <div className="w-8 h-8 flex items-center justify-center text-xs font-bold bg-surface-container-high rounded-full text-on-surface">
            {user?.name?.charAt(0)?.toUpperCase() || 'D'}
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ── Mobile Overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col border-r border-outline-variant bg-surface-container-lowest">
            <div className="flex items-center justify-between h-16 px-4 border-b border-outline-variant">
              <div className="flex items-center gap-2">
                <Leaf size={20} className="text-[var(--moss)]" />
                <span className="font-display font-bold text-on-surface">RePlate Ops</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-md"><X size={20} /></button>
            </div>
            <nav className="flex-1 p-3 flex flex-col gap-1">
              {NAV.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link key={item.href} to={item.href} 
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-primary-container text-on-primary-container'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.icon}{item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-outline-variant">
              <div className="text-xs font-medium text-on-surface-variant mb-3 px-2">{user?.email}</div>
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-error hover:bg-error-container rounded-lg transition-colors">
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center flex-shrink-0 border-b border-outline-variant h-16 px-4 lg:px-8 bg-surface">
          <button className="p-2 lg:hidden mr-3 text-on-surface-variant hover:bg-surface-container rounded-md" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <ThemeToggle />
          <div className="flex items-center gap-4 ml-4 pl-4 border-l border-outline-variant">
            <span className="hidden sm:block text-sm font-medium text-on-surface-variant">
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="hidden lg:flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant hover:text-error transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-[1000px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
