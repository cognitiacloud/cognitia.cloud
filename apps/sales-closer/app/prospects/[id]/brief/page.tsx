import { notFound } from 'next/navigation';
import { getAccountDetail, getLatestBrief } from '@/lib/queries';
import { ActionButton } from '@/components/ActionButton';
import { Badge, BackLink, Card, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getAccountDetail(id);
  if (!detail) notFound();
  const brief = await getLatestBrief(id);
  const { account, signals, drafts } = detail;
  const e = (account.enrichment ?? {}) as Record<string, unknown>;
  const draft = drafts[0];

  // Observed evidence = scraped signals (verifiable). AI inference = the brief.
  const evidence = buildEvidence(signals);
  const opener = brief?.talkTrack?.[0];
  const talkSteps = brief?.talkTrack?.slice(1) ?? [];

  return (
    <div className="space-y-6">
      <BackLink href={`/prospects/${id}`} label={account.displayName} />
      <PageHeader
        eyebrow="Closer brief"
        title={account.displayName}
        subtitle={brief ? `Version ${brief.version} · ${brief.model}` : 'Not generated yet'}
        action={<ActionButton endpoint={`/api/accounts/${id}/brief`}>Regenerate</ActionButton>}
      />

      {!brief && (
        <Card>
          <p className="text-sm text-slate-400">No brief yet. Generate one to see the playbook.</p>
        </Card>
      )}

      {brief && (
        <>
          <Card title="Account summary">
            <p className="text-sm leading-relaxed text-ink">{brief.summary}</p>
            <p className="mt-3 text-xs text-slate-400">
              Recommended channel:{' '}
              <strong className="text-slate-600">{brief.recommendedChannel}</strong> · Next action:{' '}
              <strong className="text-slate-600">{String(e.nextAction ?? '—')}</strong>
            </p>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Observed evidence */}
            <Card
              title="Observed evidence"
              subtitle="Scraped facts — verifiable"
              action={<Badge tone="navy">Source data</Badge>}
            >
              <ul className="space-y-2.5 text-sm">
                {evidence.map((ev) => (
                  <li key={ev.label} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy" />
                    <span className="text-slate-700">
                      <span className="font-medium text-ink">{ev.label}:</span> {ev.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* AI inference */}
            <Card
              title="Likely pain"
              subtitle="AI inference — review before use"
              action={<Badge tone="mint">AI generated</Badge>}
            >
              <ul className="space-y-2.5 text-sm">
                {brief.painPoints.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
                    <span className="text-slate-700">{p}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Recommended offer" action={<Badge tone="mint">AI generated</Badge>}>
              <ul className="space-y-2 text-sm">
                {brief.valueProps.map((vp, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 text-gold">◆</span>
                    <span className="text-slate-700">{vp}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Objection handling" action={<Badge tone="mint">AI generated</Badge>}>
              <ul className="space-y-3 text-sm">
                {brief.objections.map((o, i) => (
                  <li key={i}>
                    <p className="font-medium text-ink">“{o.objection}”</p>
                    <p className="text-slate-500">{o.response}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {opener && (
            <Card title="Call opener" action={<Badge tone="mint">AI generated</Badge>}>
              <blockquote className="border-l-2 border-mint pl-4 text-sm italic text-ink">
                “{opener}”
              </blockquote>
              {talkSteps.length > 0 && (
                <ol className="mt-4 list-inside list-decimal space-y-1 text-sm text-slate-600">
                  {talkSteps.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              )}
            </Card>
          )}

          {/* Personalized email draft */}
          <Card
            title="Personalized email draft"
            subtitle="Generated — requires human approval before it can send"
            action={
              <Badge tone={draft?.status === 'pending_approval' ? 'amber' : 'neutral'}>
                {draft ? draft.status.replace('_', ' ') : 'no draft'}
              </Badge>
            }
          >
            {draft ? (
              <div className="rounded-lg border border-navy/10 bg-canvas">
                <div className="border-b border-navy/5 px-4 py-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">Subject:</span> {draft.subject}
                </div>
                <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-relaxed text-ink">
                  {draft.body}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No email draft for this account.</p>
            )}
            <p className="mt-3 text-xs text-slate-400">
              🛡️ Drafts never send automatically — they appear in the approval queue for a human to
              approve or reject.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

function buildEvidence(
  signals: { type: string; value: unknown; source: string | null }[],
): { label: string; detail: string }[] {
  const out: { label: string; detail: string }[] = [];
  for (const s of signals) {
    const v = (s.value ?? {}) as Record<string, unknown>;
    if (s.type === 'traffic') {
      out.push({
        label: 'Traffic',
        detail: `~${Number(v.monthlyVisitors).toLocaleString()} monthly visits (${s.source})`,
      });
    } else if (s.type === 'review') {
      out.push({
        label: 'Reputation',
        detail: `${v.rating} ★ across ${Number(v.reviewCount).toLocaleString()} reviews`,
      });
    } else if (s.type === 'website_audit') {
      const gaps = (v.funnelGaps ?? {}) as Record<string, boolean>;
      const missing = Object.entries(gaps)
        .filter(([, on]) => on)
        .map(([k]) => k.replace(/^no/, '').replace(/([A-Z])/g, ' $1').trim().toLowerCase());
      out.push({
        label: 'Funnel gaps',
        detail: missing.length ? missing.join(', ') : 'none detected',
      });
      out.push({
        label: 'Mobile performance',
        detail: `${v.mobilePerf}/100, ${v.pageLoadSec}s load`,
      });
    } else if (s.type === 'tech_stack') {
      out.push({
        label: 'Tech stack',
        detail: Array.isArray(v.tools) ? (v.tools as string[]).join(', ') : '—',
      });
    }
  }
  return out;
}
