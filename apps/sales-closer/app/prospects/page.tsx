import Link from 'next/link';
import { listAccounts } from '@/lib/queries';
import { ActionButton } from '@/components/ActionButton';
import { Card, PageHeader, ScoreMeter, StatTile, StatusDot, TierBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

const STAGE_TONE: Record<string, 'navy' | 'mint' | 'gold' | 'amber' | 'neutral' | 'green'> = {
  New: 'neutral',
  Researching: 'navy',
  'Brief ready': 'gold',
  Approved: 'mint',
  Contacted: 'mint',
  'Meeting booked': 'green',
};

export default async function ProspectsPage() {
  const accounts = await listAccounts();
  const aTier = accounts.filter((a) => a.latestScore?.tier === 'A').length;
  const briefReady = accounts.filter((a) => a.enrichment.stage === 'Brief ready').length;
  const avgScore = accounts.length
    ? Math.round(
        accounts.reduce((s, a) => s + Number(a.latestScore?.score ?? 0), 0) / accounts.length,
      )
    : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline"
        title="Prospect dashboard"
        subtitle="Target auto dealerships sourced, scored, and prioritized for outreach."
        action={
          <ActionButton endpoint="/api/scrape-runs" body={{ source: 'apify/google-maps-scraper' }}>
            Start scrape run
          </ActionButton>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Target accounts" value={accounts.length} hint="Dealerships in pipeline" />
        <StatTile label="A-tier priority" value={aTier} tone="gold" hint="High-fit, ready to work" />
        <StatTile label="Briefs ready" value={briefReady} tone="mint" hint="Awaiting approval" />
        <StatTile label="Avg fit score" value={avgScore} hint="Across all accounts" />
      </div>

      <Card title="Target dealerships" subtitle={`${accounts.length} accounts`}>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 font-semibold">Dealership</th>
                <th className="py-2.5 font-semibold">City</th>
                <th className="py-2.5 font-semibold">Source</th>
                <th className="w-40 py-2.5 font-semibold">Fit score</th>
                <th className="py-2.5 font-semibold">Tier</th>
                <th className="py-2.5 font-semibold">Status</th>
                <th className="px-5 py-2.5 font-semibold">Next action</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-navy/5 last:border-0 hover:bg-navy-50/40">
                  <td className="px-5 py-3">
                    <Link
                      href={`/prospects/${a.id}`}
                      className="font-semibold text-navy hover:text-mint-600"
                    >
                      {a.displayName}
                    </Link>
                    <p className="text-xs font-normal text-slate-400">{a.industry}</p>
                  </td>
                  <td className="py-3 text-slate-600">
                    {a.hqCity}, {a.region}
                  </td>
                  <td className="py-3 text-slate-500">{a.enrichment.source ?? '—'}</td>
                  <td className="py-3 pr-4">
                    {a.latestScore ? (
                      <ScoreMeter value={Number(a.latestScore.score)} />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    <TierBadge tier={a.latestScore?.tier} />
                  </td>
                  <td className="py-3">
                    <StatusDot
                      tone={STAGE_TONE[a.enrichment.stage ?? 'New'] ?? 'neutral'}
                      label={a.enrichment.stage ?? 'New'}
                    />
                  </td>
                  <td className="px-5 py-3 text-slate-600">{a.enrichment.nextAction ?? '—'}</td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No prospects yet. Start a scrape run to populate the pipeline.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
