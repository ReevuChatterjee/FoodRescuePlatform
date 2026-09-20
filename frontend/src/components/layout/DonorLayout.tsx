import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Leaf } from 'lucide-react';
import { useAuthStore } from '../../hooks/useAuthStore';
import { ThemeToggle } from '../common/ThemeToggle';

const NAV = [
  { label: 'Donations', href: '/donor' },
  { label: 'Create donation', href: '/donor/donate' },
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
    <div className="flex h-screen overflow-hidden bg-base text-on-surface">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col flex-shrink-0 h-full w-[260px] border-r border-outline-variant/30 bg-surface-container-lowest">
        {/* Branding */}
        <div className="flex items-center gap-3 h-16 px-6 border-b border-outline-variant/30 flex-shrink-0">
          <Leaf size={20} className="text-primary" />
          <span className="font-semibold text-[1.125rem] text-on-surface tracking-tight">RePlate</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col pt-8 px-4">
          <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-4 px-3">
            Donor
          </span>
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={`block px-3 py-2 rounded-md text-[0.875rem] font-medium transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* ── Mobile Overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] flex flex-col border-r border-outline-variant/30 bg-surface-container-lowest">
            <div className="flex items-center justify-between h-16 px-6 border-b border-outline-variant/30">
              <div className="flex items-center gap-3">
                <Leaf size={20} className="text-primary" />
                <span className="font-semibold text-[1.125rem] text-on-surface tracking-tight">RePlate</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 pt-8 px-4 flex flex-col gap-1">
              <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant mb-4 px-3">
                Donor
              </span>
              {NAV.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link key={item.href} to={item.href} 
                    className={`block px-3 py-2 rounded-md text-[0.875rem] font-medium transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-outline-variant/30 flex flex-col items-start gap-3">
              <span className="text-[0.8125rem] font-medium text-on-surface-variant px-3">{user?.name}</span>
              <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-[0.875rem] font-medium text-error hover:bg-error/10 rounded-md transition-colors">
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Quiet Topbar */}
        <header className="flex items-center justify-between flex-shrink-0 border-b border-outline-variant/30 h-16 px-6 lg:px-8 bg-surface-container-lowest lg:bg-transparent">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-on-surface-variant hover:text-on-surface" onClick={() => setMobileOpen(true)}>
              <Menu size={20} />
            </button>
          </div>
          
          <div className="flex items-center gap-6">
            <ThemeToggle />
            <div className="hidden sm:flex items-center gap-6 text-[0.875rem] font-medium text-on-surface-variant">
              <span>{user?.name}</span>
              <button onClick={handleLogout} className="hover:text-error transition-colors">
                Sign out
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-12">
          <div className="max-w-[1000px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
