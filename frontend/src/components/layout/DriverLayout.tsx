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
    <div
      className="flex flex-col min-h-screen"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Minimal status strip — not a full topbar */}
      <div
        className="flex items-center justify-between flex-shrink-0 border-b"
        style={{
          height: '44px',
          padding: '0 20px',
          background: 'var(--bg-base)',
          borderColor: 'var(--border-hair)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1.5 px-2 py-1 border"
            style={{ borderColor: 'var(--amber-dim)', background: 'var(--amber-dim-bg)', borderRadius: '2px' }}
          >
            <Radio size={10} style={{ color: 'var(--amber-dim)' }} />
            <span
              className="section-label"
              style={{ color: 'var(--amber-dim)', letterSpacing: '0.1em' }}
            >
              On Duty
            </span>
          </div>

          <span
            className="hidden sm:block text-xs font-semibold"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
          >
            {user?.name}
          </span>
          <span
            className="hidden sm:block font-mono-data text-[10px]"
            style={{ color: 'var(--text-muted)' }}
          >
            {user?.id?.substring(0, 8).toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setConfirmLogout((v) => !v)}
            className="section-label flex items-center gap-1.5 hover:text-[var(--terracotta)] transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <LogOut size={11} /> Off Duty
          </button>
        </div>
      </div>

      {/* Logout confirm bar */}
      {confirmLogout && (
        <div
          className="flex items-center justify-between px-5 py-2 border-b flex-shrink-0"
          style={{ background: 'var(--terracotta-dim)', borderColor: 'rgba(184,90,58,0.2)' }}
        >
          <span className="text-sm" style={{ color: 'var(--terracotta)' }}>
            End duty and sign out?
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setConfirmLogout(false)}
              className="text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
            <button onClick={handleLogout} className="btn-danger" style={{ padding: '4px 12px', fontSize: '0.75rem' }}>
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Full-bleed content — pad bottom for action bar */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: actionBar ? '96px' : 'var(--sp-5)' }}
      >
        {children}
      </main>

      {/* Fixed bottom action bar */}
      {actionBar && (
        <div className="driver-action-bar">
          {actionBar}
        </div>
      )}
    </div>
  );
}
