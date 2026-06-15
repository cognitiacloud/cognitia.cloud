import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/** Status → chip tone mapping shared across the console. */
export type ChipTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'accent';

export function Chip({ tone = 'neutral', children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

/** Map common domain statuses to a restrained tone (single source for the UI). */
export function statusTone(status: string): ChipTone {
  const s = status.toLowerCase();
  if (['approved', 'executed', 'completed', 'ok', 'ready', 'connected', 'booked'].includes(s))
    return 'ok';
  if (['proposed', 'pending', 'running', 'queued', 'scheduled'].includes(s)) return 'accent';
  if (['rejected', 'failed', 'error', 'halted', 'disconnected', 'no_show'].includes(s))
    return 'danger';
  if (['paused', 'stale', 'rolled_back', 'warn', 'degraded'].includes(s)) return 'warn';
  return 'neutral';
}

export function PageHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function Section({
  title,
  link,
  children,
}: {
  title: string;
  link?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <span className="section-title">{title}</span>
        {link ? (
          <a className="section-link" href={link.href}>
            {link.label}
          </a>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  icon,
  foot,
  lead,
}: {
  label: string;
  value: ReactNode;
  icon: IconName;
  foot?: string;
  lead?: boolean;
}) {
  return (
    <div className="card kpi">
      <div className="kpi-label">
        <Icon name={icon} style={{ width: 14, height: 14 }} />
        {label}
      </div>
      <div className={lead ? 'kpi-value lead' : 'kpi-value'}>{value}</div>
      {foot ? <div className="kpi-foot">{foot}</div> : null}
    </div>
  );
}

/** Empty, loading, and error states — every data surface designs all three. */
export function EmptyState({
  icon = 'inbox',
  title,
  sub,
}: {
  icon?: IconName;
  title: string;
  sub?: string;
}) {
  return (
    <div className="card state">
      <Icon name={icon} className="state-icon" />
      <div className="state-title">{title}</div>
      {sub ? <div className="state-sub">{sub}</div> : null}
    </div>
  );
}

export function ErrorState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="card state error">
      <Icon name="alert" className="state-icon" />
      <div className="state-title">{title}</div>
      {sub ? <div className="state-sub">{sub}</div> : null}
    </div>
  );
}

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skel"
          style={{ height: 14, margin: '9px 0', width: `${90 - i * 12}%` }}
        />
      ))}
    </div>
  );
}
