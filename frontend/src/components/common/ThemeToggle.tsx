/**
 * ThemeToggle — sun/moon icon button.
 * Drop-in: renders a ghost button, calls useTheme().toggle.
 * Accepts a className for positioning.
 */

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  className?: string;
  style?: React.CSSProperties;
}

export function ThemeToggle({ className = '', style }: ThemeToggleProps) {
  const { isDark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`nav-item-icon ${className}`}
      style={{
        width: '32px',
        height: '32px',
        flexShrink: 0,
        color: 'var(--text-muted)',
        transition: 'color 0.15s var(--ease-micro)',
        ...style,
      }}
    >
      {isDark
        ? <Sun size={14} />
        : <Moon size={14} />
      }
    </button>
  );
}
