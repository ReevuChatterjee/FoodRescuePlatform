/**
 * DriverLayout — full-bleed, no sidebar, fixed bottom action bar.
 * Content occupies 100% width. Driver's context is all about the current task.
 * Bottom bar (80px) holds the primary action — GPS broadcast.
 * No nav chrome visible during operation — minimal distraction.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Radio } from 'lucide-react';
import { useAuthStore } from '../../hooks/useAuthStore';
import { ThemeToggle } from '../common/ThemeToggle';

interface DriverLayoutProps {
  children: React.ReactNode;
  /** Primary action button rendered inside the bottom bar */
  actionBar?: React.ReactNode;
}

export function DriverLayout({ children, actionBar }: DriverLayoutProps) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleLogout = () => { clearAuth(); navigate('/login'); };

  return (
    <div className="flex flex-col min-h-screen bg-surface text-on-surface">
      {/* Minimal status strip — not a full topbar */}
      <div className="flex items-center justify-between flex-shrink-0 border-b border-outline-variant h-12 px-5 bg-surface-container-lowest">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 border border-warning rounded-sm bg-warning/10">
            <Radio size={10} className="text-warning" />
            <span className="text-[0.6875rem] font-bold text-warning tracking-wider uppercase">
              On Duty
            </span>
          </div>

          <span className="hidden sm:block text-sm font-bold text-on-surface tracking-tight">
            {user?.name}
          </span>
          <span className="hidden sm:block font-mono-data text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
            {user?.id?.substring(0, 8).toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => setConfirmLogout((v) => !v)}
            className="flex items-center gap-1.5 text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant hover:text-error transition-colors"
          >
            <LogOut size={12} /> Off Duty
          </button>
        </div>
      </div>

      {/* Logout confirm bar */}
      {confirmLogout && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-error/20 bg-error-container/30 flex-shrink-0">
          <span className="text-sm font-semibold text-error">
            End duty and sign out?
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setConfirmLogout(false)}
              className="text-sm font-medium text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
            <button onClick={handleLogout} className="px-3 py-1.5 text-sm font-semibold text-white bg-error rounded-md shadow-sm hover:bg-error/90">
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Full-bleed content — pad bottom for action bar */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: actionBar ? '96px' : '1.25rem' }}
      >
        {children}
      </main>

      {/* Fixed bottom action bar */}
      {actionBar && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-container-lowest border-t border-outline-variant shadow-lg z-40">
          <div className="max-w-[800px] mx-auto w-full">
            {actionBar}
          </div>
        </div>
      )}
    </div>
  );
}
