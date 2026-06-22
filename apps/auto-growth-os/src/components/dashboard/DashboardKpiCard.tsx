// components/dashboard/DashboardKpiCard.tsx
import type { ReactNode } from 'react';

type Accent = 'gold' | 'cyan' | 'mint' | 'alert' | 'neutral';

const ACCENT: Record<Accent, { bar: string; chip: string; spark: string; delta: string }> = {
  gold: {
    bar: 'bg-gold-400',
    chip: 'bg-gold-400/12 text-gold-700',
    spark: 'bg-gold-400/70',
    delta: 'text-gold-700',
  },
  cyan: {
    bar: 'bg-cyan-400',
    chip: 'bg-cyan-400/12 text-cyan-700',
    spark: 'bg-cyan-400/70',
    delta: 'text-cyan-700',
  },
  mint: {
    bar: 'bg-mint-400',
    chip: 'bg-mint-400/14 text-mint-600',
    spark: 'bg-mint-500/70',
    delta: 'text-mint-600',
  },
  alert: {
    bar: 'bg-rose-400',
    chip: 'bg-rose-500/10 text-rose-600',
    spark: 'bg-rose-400/70',
    delta: 'text-rose-600',
  },
  neutral: {
    bar: 'bg-ink-400',
    chip: 'bg-surface-2 text-ink-300',
    spark: 'bg-ink-400/50',
    delta: 'text-ink-400',
  },
};

export function DashboardKpiCard({
  label,
  value,
  delta,
  accent = 'neutral',
  icon,
  trend = [],
}: {
  label: string;
  value: string | number;
  delta?: string;
  accent?: Accent;
  icon?: ReactNode;
  trend?: number[];
}) {
  const a = ACCENT[accent];
  const max = Math.max(1, ...trend);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(12,18,40,0.04)]">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</p>
        {icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.chip}`}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <p className="font-display text-3xl font-bold tracking-tight text-ink-100">{value}</p>
        {delta && <span className={`mb-1 text-xs font-semibold ${a.delta}`}>{delta}</span>}
      </div>
      {trend.length > 0 && (
        <div className="mt-3 flex h-7 items-end gap-1" aria-hidden>
          {trend.map((v, i) => (
            <span
              key={i}
              className={`flex-1 rounded-sm ${a.spark}`}
              style={{ height: `${Math.max(12, Math.round((v / max) * 100))}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
