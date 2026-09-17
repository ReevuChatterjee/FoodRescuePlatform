/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Named tokens mapped to CSS vars — use these instead of raw zinc/emerald
        ink:        'var(--ink)',
        moss:       'var(--moss)',
        'moss-light': 'var(--moss-light)',
        terracotta: 'var(--terracotta)',
        'amber-dim': 'var(--amber-dim)',
        'olive-grey': 'var(--olive-grey)',
        // Surfaces
        'bg-base':  'var(--bg-base)',
        'bg-panel': 'var(--bg-panel)',
        'bg-inset': 'var(--bg-inset)',
        'bg-hover': 'var(--bg-hover)',
        // Text
        'text-primary':   'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted':     'var(--text-muted)',
        // Borders
        'border-hair':   'var(--border-hair)',
        'border-med':    'var(--border-med)',
        'border-strong': 'var(--border-strong)',
        // Semantic
        success: 'var(--success)',
        warning: 'var(--warning)',
        error:   'var(--error)',
        // Legacy compat
        brand: {
          DEFAULT: 'var(--moss)',
          dark: 'var(--brand-dark)',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono:    ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      letterSpacing: {
        'tighter-display': '-0.03em',
        'tight-heading':   '-0.025em',
        'normal-ui':       '-0.01em',
        'wide-label':      '0.08em',
        'wider-caps':      '0.1em',
      },
    },
  },
  plugins: [],
}
