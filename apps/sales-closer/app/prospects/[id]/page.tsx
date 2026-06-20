import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAccountDetail } from '@/lib/queries';
import { ActionButton } from '@/components/ActionButton';
import {
  Badge,
  BackLink,
  Card,
  Field,
  PageHeader,
  ScoreMeter,
  TierBadge,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

const CONSENT_TONE = {
  opted_in: 'green',
  opted_out: 'amber',
  dnc: 'red',
  unknown: 'neutral',
} as const;

const SIGNAL_LABELS: Record<string, string> = {
  review: 'Reviews',
  traffic: 'Web traffic',
  tech_stack: 'Tech stack',
  website_audit: 'Website audit',
  hiring: 'Hiring',
  funding: 'Funding',
  social: 'Social',
  news: 'News',
};

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getAccountDetail(id);
  if (!detail) notFound();
  const { account, contacts, signals, scores, drafts } = detail;
  const e = (account.enrichment ?? {}) as Record<string, unknown>;
  const latestScore = scores[0];
  const breakdown = (latestScore?.breakdown ?? {}) as Record<string, number>;

  return (
    <div className="space-y-6">
      <BackLink href="/prospects" label="Prospect dashboard" />
      <PageHeader
        eyebrow={String(e.brand ?? 'Auto dealer')}
        title={account.displayName}
        subtitle={`${account.hqCity}, ${account.region} · ${account.domain}`}
        action={
          <div className="flex items-center gap-2">
            <ActionButton endpoint={`/api/accounts/${id}/score`} variant="secondary">
              Re-score
            </ActionButton>
            <ActionButton endpoint={`/api/accounts/${id}/brief`}>Generate brief</ActionButton>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Business profile */}
        <Card title="Business profile" className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
            <dl>
              <Field label="Brand" value={String(e.brand ?? '—')} />
              <Field label="Founded" value={String(e.foundedYear ?? '—')} />
              <Field label="Headquarters" value={`${account.hqCity}, ${account.region}`} />
              <Field
                label="Website"
                value={
                  <a className="text-mint-600 hover:underline" href={String(e.website ?? '#')}>
                    {String(e.website ?? '—').replace('https://', '')}
                  </a>
                }
              />
            </dl>
            <dl>
              <Field label="Google rating" value={`${e.rating ?? '—'} ★ (${e.reviewCount ?? 0})`} />
              <Field
                label="Monthly visitors"
                value={Number(e.monthlyVisitors ?? 0).toLocaleString()}
              />
              <Field label="Source" value={String(e.source ?? '—')} />
              <Field
                label="Source URL"
                value={
                  <a className="text-mint-600 hover:underline" href={String(e.sourceUrl ?? '#')}>
                    Google Maps listing
                  </a>
                }
              />
            </dl>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 border-t border-navy/5 pt-4 text-sm">
            <Link href={`/prospects/${id}/audit`} className="font-medium text-mint-600 hover:underline">
              → Website audit
            </Link>
            <Link href={`/prospects/${id}/brief`} className="font-medium text-mint-600 hover:underline">
              → Closer brief
            </Link>
          </div>
        </Card>

        {/* Score breakdown */}
        <Card title="Fit score">
          {latestScore ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold tabular text-navy">
                  {Number(latestScore.score).toFixed(0)}
                </span>
                <span className="text-sm text-slate-400">/ 100</span>
                <span className="ml-auto">
                  <TierBadge tier={latestScore.tier} />
                </span>
              </div>
              <dl className="mt-4 space-y-2.5">
                {Object.entries(breakdown).map(([k, v]) => (
                  <div key={k}>
                    <div className="mb-1 flex justify-between text-xs">
                      <dt className="capitalize text-slate-500">{k}</dt>
                      <dd className="font-medium tabular text-slate-600">{v}</dd>
                    </div>
                    <ScoreMeter value={Number(v)} showLabel={false} />
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-sm text-slate-400">Not scored yet.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Contacts */}
        <Card title={`Contacts (${contacts.length})`}>
          <ul className="space-y-3 text-sm">
            {contacts.map((c) => (
              <li key={c.id} className="rounded-lg border border-navy/5 bg-navy-50/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{c.fullName}</span>
                  <Badge tone={CONSENT_TONE[c.consentStatus]}>{c.consentStatus.replace('_', ' ')}</Badge>
                </div>
                <p className="text-slate-500">{c.title}</p>
                <p className="mt-1 text-xs text-slate-400">{c.email}</p>
                <p className="text-xs text-slate-400">{c.phone}</p>
              </li>
            ))}
          </ul>
        </Card>

        {/* Source evidence */}
        <Card title="Source evidence" subtitle="Observed, scraped facts" className="lg:col-span-2">
          <ul className="space-y-2.5 text-sm">
            {signals.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-4 border-b border-navy/5 pb-2.5 last:border-0"
              >
                <div>
                  <Badge tone="navy">{SIGNAL_LABELS[s.type] ?? s.type}</Badge>
                  <span className="ml-2 text-slate-600">{summarizeSignal(s.type, s.value)}</span>
                </div>
                <div className="shrink-0 text-right text-xs text-slate-400">
                  <div>{s.source}</div>
                  <div>{new Date(s.observedAt).toLocaleDateString()}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            {drafts.length} outreach draft{drafts.length === 1 ? '' : 's'} · evidence feeds the AI
            score and brief, which are clearly labeled as inferences.
          </p>
        </Card>
      </div>
    </div>
  );
}

function summarizeSignal(type: string, value: unknown): string {
  const v = (value ?? {}) as Record<string, unknown>;
  switch (type) {
    case 'review':
      return `${v.rating} ★ across ${Number(v.reviewCount).toLocaleString()} reviews (${v.source})`;
    case 'traffic':
      return `~${Number(v.monthlyVisitors).toLocaleString()} monthly visits`;
    case 'tech_stack':
      return Array.isArray(v.tools) ? (v.tools as string[]).join(', ') : '—';
    case 'website_audit':
      return `Mobile perf ${v.mobilePerf}/100 · ${v.pageLoadSec}s load`;
    default:
      return '';
  }
}
