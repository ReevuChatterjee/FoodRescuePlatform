/**
 * AppLayout — shared sidebar + topbar for all authenticated roles.
 * Renders role-specific nav items and provides content area.
 * Utilitarian, flat design system with operational colors.
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Plus, Settings, LogOut, Menu, X,
  CheckSquare, BarChart2, Users, Truck, Leaf, Bell, ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '../../hooks/useAuthStore';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  ADMIN: [
    { label: 'Network Overview', href: '/admin', icon: <BarChart2 size={16} /> },
    { label: 'Verification Queue', href: '/admin/ngos/verify', icon: <CheckSquare size={16} /> },
    { label: 'NGO Registry', href: '/admin/ngos', icon: <Users size={16} /> },
  ],
  DONOR: [
    { label: 'Donation Activity', href: '/donor', icon: <LayoutDashboard size={16} /> },
    { label: 'Create Donation', href: '/donor/donate', icon: <Plus size={16} /> },
  ],
  NGO: [
    { label: 'Distribution Desk', href: '/ngo', icon: <LayoutDashboard size={16} /> },
    { label: 'Incoming Supply', href: '/ngo/incoming', icon: <Package size={16} /> },
    { label: 'Settings', href: '/ngo/settings', icon: <Settings size={16} /> },
  ],
  DRIVER: [
    { label: 'Active Route', href: '/driver', icon: <Truck size={16} /> },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  DONOR: 'Donor',
  NGO: 'NGO',
  DRIVER: 'Driver',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'badge-blue',
  DONOR: 'badge-green',
  NGO: 'badge-orange',
  DRIVER: 'badge-yellow',
};

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, clearAuth } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = user ? NAV_ITEMS[user.role] || [] : [];

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={`flex flex-col h-full bg-[var(--bg-panel)] border-r border-[var(--border-subtle)] ${mobile ? '' : 'w-64'}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
        <div className="w-6 h-6 bg-[var(--brand)] rounded-sm flex items-center justify-center">
          <Leaf size={14} className="text-black" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">RePlate Ops</p>
        </div>
        {mobile && (
          <button className="ml-auto btn-ghost" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href ||
            (item.href !== '/admin' && item.href !== '/donor' && item.href !== '/ngo' && item.href !== '/driver' &&
              location.pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-[var(--border-subtle)]">
        <div className="bg-[var(--bg-page)] border border-[var(--border-subtle)] rounded-md p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-[var(--bg-panel-hover)] border border-[var(--border-strong)] flex items-center justify-center text-xs font-semibold text-[var(--text-primary)]">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-[var(--text-primary)] tracking-tight">
              {user?.name || 'User'}
            </p>
            <span className={`${ROLE_COLORS[user?.role || 'DONOR']} mt-1`}>
              {ROLE_LABELS[user?.role || 'DONOR']}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-page)]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[var(--bg-panel)] shadow-xl border-r border-[var(--border-subtle)]">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-4 px-6 py-4 flex-shrink-0 bg-[var(--bg-page)] border-b border-[var(--border-subtle)]">
          <button className="btn-ghost lg:hidden p-2" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          {/* Contextual Space */}
          <div className="flex-1" />

          {/* Topbar actions */}
          <button className="btn-ghost p-2 relative" title="Notifications">
            <Bell size={16} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-none bg-[var(--warning)]" />
          </button>

          {/* Profile dropdown */}
          <div className="relative">
            <button
              className="flex items-center gap-2 btn-ghost px-2 py-1.5 border border-transparent hover:border-[var(--border-strong)]"
              onClick={() => setProfileOpen(!profileOpen)}
            >
              <div className="w-6 h-6 rounded-sm bg-[var(--bg-panel-hover)] flex items-center justify-center text-xs font-mono text-[var(--text-primary)]">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <ChevronDown size={14} className="text-[var(--text-muted)]" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-48 elevated-layer z-50 py-1">
                <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                  <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{user?.name}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

