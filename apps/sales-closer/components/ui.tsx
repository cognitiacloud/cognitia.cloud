import Link from 'next/link';

/** Card surface — the primary container across every screen. */
export function Card({
  title,
  subtitle,
  children,
  action,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-navy/10 bg-surface shadow-card ${className}`}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-navy/5 px-5 py-3.5">
          <div>
            {title && (
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-navy/70">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const TIER_STYLES: Record<string, string> = {
  A: 'bg-gold-soft text-gold-600 ring-1 ring-gold-200',
  B: 'bg-mint-soft text-mint-600 ring-1 ring-mint/20',
  C: 'bg-navy-50 text-navy-600 ring-1 ring-navy/10',
  D: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
};

export function TierBadge({ tier }: { tier?: string | null }) {
  if (!tier) return <span className="text-slate-300">—</span>;
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
        TIER_STYLES[tier] ?? TIER_STYLES.D
      }`}
      title={`Priority tier ${tier}`}
    >
      {tier}
    </span>
  );
}

type Tone = 'neutral' | 'navy' | 'mint' | 'gold' | 'green' | 'amber' | 'red';

const TONE_STYLES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  navy: 'bg-navy-50 text-navy-700',
  mint: 'bg-mint-soft text-mint-600',
  gold: 'bg-gold-soft text-gold-600',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-rose-50 text-rose-700',
};

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Small colored status dot + label. */
export function StatusDot({ tone = 'neutral', label }: { tone?: Tone; label: string }) {
  const dot: Record<Tone, string> = {
    neutral: 'bg-slate-400',
    navy: 'bg-navy',
    mint: 'bg-mint',
    gold: 'bg-gold',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-rose-500',
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} />
      {label}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-mint-600">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-navy">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium text-navy-600 hover:text-navy"
    >
      <span aria-hidden>←</span> {label}
    </Link>
  );
}

/** Big number metric tile for dashboards. */
export function StatTile({
  label,
  value,
  hint,
  tone = 'navy',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  const accent: Record<Tone, string> = {
    neutral: 'text-slate-700',
    navy: 'text-navy',
    mint: 'text-mint-600',
    gold: 'text-gold-600',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-rose-600',
  };
  return (
    <div className="rounded-xl border border-navy/10 bg-surface p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular ${accent[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** Horizontal score meter (0–100). */
export function ScoreMeter({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 75 ? 'bg-gold' : pct >= 55 ? 'bg-mint' : 'bg-navy-600';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-navy-50">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="w-8 text-right text-sm font-semibold tabular">{Math.round(pct)}</span>}
    </div>
  );
}

/** Definition row used in profile panels. */
export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{value || '—'}</dd>
    </div>
  );
}

/** Banner used to call out safety / governance facts (e.g. "nothing sends automatically"). */
export function SafetyBanner({
  tone = 'mint',
  title,
  children,
}: {
  tone?: 'mint' | 'gold' | 'navy';
  title: string;
  children?: React.ReactNode;
}) {
  const styles = {
    mint: 'border-mint/30 bg-mint-soft',
    gold: 'border-gold-200 bg-gold-soft',
    navy: 'border-navy/15 bg-navy-50',
  }[tone];
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${styles}`}>
      <span className="mt-0.5 text-base" aria-hidden>
        🛡️
      </span>
      <div>
        <p className="text-sm font-semibold text-navy">{title}</p>
        {children && <p className="mt-0.5 text-sm text-slate-600">{children}</p>}
      </div>
    </div>
  );
}

/** Pass/fail check row used by the website audit. */
export function CheckRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-navy/5 py-2.5 last:border-0">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
            ok ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}
        >
          {ok ? '✓' : '✕'}
        </span>
        <span className="text-sm font-medium text-ink">{label}</span>
      </div>
      <span className={`text-xs font-medium ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
        {detail ?? (ok ? 'Present' : 'Missing')}
      </span>
    </li>
  );
}
