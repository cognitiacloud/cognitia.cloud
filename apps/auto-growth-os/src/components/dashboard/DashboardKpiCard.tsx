// components/dashboard/DashboardKpiCard.tsx
import type { ReactNode } from 'react';

type Accent = 'gold' | 'cyan' | 'mint' | 'alert' | 'neutral';

const ACCENT: Record<Accent, { bar: string; value: string; chip: string }> = {
  gold: {
    bar: 'from-gold-400 to-gold-500',
    value: 'text-gold-300',
    chip: 'bg-gold-400/10 text-gold-300',
  },
  cyan: {
    bar: 'from-cyan-400 to-cyan-300',
    value: 'text-cyan-300',
    chip: 'bg-cyan-400/10 text-cyan-300',
  },
  mint: {
    bar: 'from-mint-400 to-mint-300',
    value: 'text-mint-300',
    chip: 'bg-mint-400/10 text-mint-300',
  },
  alert: {
    bar: 'from-rose-400 to-rose-500',
    value: 'text-rose-300',
    chip: 'bg-rose-500/10 text-rose-300',
  },
  neutral: {
    bar: 'from-ink-400 to-ink-500',
    value: 'text-ink-100',
    chip: 'bg-white/5 text-ink-300',
  },
};

export function DashboardKpiCard({
  label,
  value,
  sublabel,
  accent = 'neutral',
  icon,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: Accent;
  icon?: ReactNode;
}) {
  const a = ACCENT[accent];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-navy-850/60 p-5">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${a.bar}`} />
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</p>
        {icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.chip}`}>
            {icon}
          </span>
        )}
      </div>
      <p className={`mt-3 font-display text-3xl font-bold ${a.value}`}>{value}</p>
      {sublabel && <p className="mt-1 text-xs text-ink-400">{sublabel}</p>}
    </div>
  );
}
