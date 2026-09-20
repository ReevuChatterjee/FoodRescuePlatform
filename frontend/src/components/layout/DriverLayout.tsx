import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LogOut, Loader2, Menu, X } from 'lucide-react';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useCurrentJob, useSetAvailability } from '../../hooks/useDriver';
import { apiErrorMessage } from '../../hooks/useDriver';

interface DriverLayoutProps {
  children: React.ReactNode;
}

const NAV_LINKS = [
  { path: '/driver', label: 'Dashboard' },
  { path: '/driver/deliveries', label: 'Deliveries' },
  { path: '/driver/history', label: 'History' },
  { path: '/driver/profile', label: 'Profile' },
];

export function DriverLayout({ children }: DriverLayoutProps) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const { data } = useCurrentJob();
  const driver = data?.driver;
  const hasJob = !!data?.job;
  const setAvailability = useSetAvailability();

  const handleLogout = () => { clearAuth(); navigate('/login'); };

  const online = driver?.availability_status !== 'OFFLINE';

  const toggleDuty = () => {
    if (!driver || hasJob || setAvailability.isPending) return;
    setAvailability.mutate({
      availability_status: online ? 'OFFLINE' : 'AVAILABLE',
      location: online ? null : driver.current_location,
    });
  };

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 bg-surface-container-lowest border-r border-outline-variant/30 z-20">
        <div className="h-16 flex items-center px-6 border-b border-outline-variant/30">
          <Link to="/" className="text-xl font-display font-bold text-on-surface tracking-tight">RePlate</Link>
          <span className="ml-3 px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-[0.625rem] font-bold tracking-widest uppercase text-on-surface-variant">
            Driver
          </span>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {NAV_LINKS.map((link) => {
            const active = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-3 py-2 text-[0.9375rem] transition-colors rounded-sm ${
                  active 
                    ? 'text-primary font-medium bg-primary/10 border-l-[3px] border-primary' 
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container font-medium border-l-[3px] border-transparent'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-64 max-w-[80%] bg-surface-container-lowest border-r border-outline-variant h-full flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 border-b border-outline-variant/30">
              <span className="text-lg font-display font-bold text-on-surface tracking-tight">RePlate Driver</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-on-surface-variant">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
              {NAV_LINKS.map((link) => {
                const active = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-[0.9375rem] transition-colors rounded-sm ${
                      active 
                        ? 'text-primary font-medium bg-primary/10 border-l-[3px] border-primary' 
                        : 'text-on-surface-variant font-medium border-l-[3px] border-transparent'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        
        {/* Top bar */}
        <header className="h-16 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-on-surface-variant" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-[0.875rem] font-semibold text-on-surface tracking-tight">
                {user?.name}
              </span>
              <span className="font-mono-data text-[0.6875rem] font-semibold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">
                {user?.id?.substring(0, 8).toUpperCase()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Duty toggle */}
            {driver && (
              <button
                onClick={toggleDuty}
                disabled={hasJob || setAvailability.isPending}
                className={`text-[0.6875rem] font-bold tracking-widest uppercase transition-colors px-2.5 py-1 rounded-sm border ${
                  online
                    ? 'text-primary border-primary bg-primary/10 hover:bg-primary/20'
                    : 'text-on-surface-variant border-outline-variant/50 bg-surface-container-lowest hover:bg-surface-container'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {setAvailability.isPending ? <Loader2 size={12} className="inline animate-spin mr-1" /> : null}
                {online ? 'On Duty' : 'Off Duty'}
              </button>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Sign out <LogOut size={14} />
            </button>
          </div>
        </header>

        {/* Global Error Banner for Duty Toggle */}
        {setAvailability.isError && (
          <div className="bg-error/10 border-b border-error/20 px-6 py-2">
             <p className="text-[0.8125rem] text-error font-medium">{apiErrorMessage(setAvailability.error)}</p>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
