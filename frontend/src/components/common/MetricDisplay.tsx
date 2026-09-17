/**
 * MetricDisplay — Fraunces tabular numeral + hairline rule + small-caps label.
 * No card box. Sits directly on a surface.
 * Optional delta prop (δ) rendered as an inline absolute element on the rule.
 * Optional accent prop: colors the rule fill to a normalized percentage.
 */

import { type ReactNode } from 'react';

interface MetricDisplayProps {
  /** The number or string to render in large serif */
  value: string | number;
  /** Small-caps label beneath the rule */
  label: string;
  /** Optional: +/− delta string, e.g. "+12%" */
  delta?: string;
  /** Optional: 0–100 fill percentage for accent line on the rule */
  accentFill?: number;
  /** Size variant: 'lg' (default 4.5rem) | 'md' (2.5rem) | 'sm' (1.75rem) */
  size?: 'lg' | 'md' | 'sm';
  /** Optional unit suffix displayed inline at smaller size */
  unit?: string;
  /** Additional class on the container */
  className?: string;
  /** Optional slot for sparkline or additional content below label */
  children?: ReactNode;
}

const SIZE_STYLES: Record<string, { fontSize: string; opsz: number }> = {
  lg: { fontSize: '4.5rem',  opsz: 72 },
  md: { fontSize: '2.75rem', opsz: 48 },
  sm: { fontSize: '1.75rem', opsz: 24 },
};

export function MetricDisplay({
  value,
  label,
  delta,
  accentFill,
  size = 'lg',
  unit,
  className = '',
  children,
}: MetricDisplayProps) {
  const { fontSize, opsz } = SIZE_STYLES[size];

  const isDeltaPositive = delta?.startsWith('+');
  const isDeltaNegative = delta?.startsWith('-');
  const deltaColor = isDeltaPositive
    ? 'var(--moss-light)'
    : isDeltaNegative
    ? 'var(--terracotta)'
    : 'var(--text-muted)';

  return (
    <div className={`metric-display ${className}`}>
      {/* Numeral */}
      <div className="flex items-baseline gap-2">
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize,
            fontWeight: 300,
            lineHeight: 1,
            letterSpacing: '-0.025em',
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
            fontVariationSettings: `'opsz' ${opsz}`,
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 400,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
              letterSpacing: 0,
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {/* Hairline rule with optional accent fill and delta */}
      <div className="metric-rule" style={{ marginTop: '8px', marginBottom: '6px' }}>
        {accentFill !== undefined && (
          <div
            className="metric-rule-accent"
            style={{ width: `${Math.min(Math.max(accentFill, 0), 100)}%` }}
          />
        )}
        {delta && (
          <span
            className="metric-delta"
            style={{ color: deltaColor }}
          >
            {delta}
          </span>
        )}
      </div>

      {/* Label */}
      <span className="metric-label">{label}</span>

      {/* Optional slot (sparkline, etc.) */}
      {children}
    </div>
  );
}
