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
  const sizeStyles = {
    lg: 'text-6xl md:text-[4.5rem] tracking-tighter',
    md: 'text-4xl md:text-[2.75rem] tracking-tight',
    sm: 'text-2xl md:text-[1.75rem] tracking-tight',
  };

  const isDeltaPositive = delta?.startsWith('+');
  const isDeltaNegative = delta?.startsWith('-');
  const deltaColor = isDeltaPositive
    ? 'text-primary'
    : isDeltaNegative
    ? 'text-error'
    : 'text-on-surface-variant';

  return (
    <div className={`flex flex-col gap-0 ${className}`}>
      {/* Numeral */}
      <div className="flex items-baseline gap-2">
        <span
          className={`font-display font-bold leading-none text-on-surface font-mono-data ${sizeStyles[size]}`}
        >
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-on-surface-variant font-ui tracking-normal">
            {unit}
          </span>
        )}
      </div>

      {/* Hairline rule with optional accent fill and delta */}
      <div className="w-full h-px bg-outline-variant my-2 relative">
        {accentFill !== undefined && (
          <div
            className="absolute left-0 top-0 h-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${Math.min(Math.max(accentFill, 0), 100)}%` }}
          />
        )}
        {delta && (
          <span
            className={`absolute right-0 bottom-1 font-ui text-[0.6875rem] font-semibold bg-surface px-1 ${deltaColor}`}
          >
            {delta}
          </span>
        )}
      </div>

      {/* Label */}
      <span className="font-ui text-[0.6875rem] font-bold tracking-wider uppercase text-on-surface-variant">
        {label}
      </span>

      {/* Optional slot (sparkline, etc.) */}
      {children}
    </div>
  );
}
