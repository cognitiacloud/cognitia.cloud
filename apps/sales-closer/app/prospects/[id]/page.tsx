import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAccountDetail } from '@/lib/queries';
import { ActionButton } from '@/components/ActionButton';
import { Badge, BackLink, Card, PageHeader, TierBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getAccountDetail(id);
  if (!detail) notFound();
  const { account, contacts, signals, scores, briefs, drafts } = detail;
  const latestScore = scores[0];

  return (
    <div className="space-y-6">
      <BackLink href="/prospects" label="Prospects" />
      <div className="flex items-start justify-between">
        <PageHeader title={account.displayName} subtitle={account.domain} />
        <div className="flex items-center gap-2">
          <ActionButton endpoint={`/api/accounts/${id}/score`} variant="secondary">
            Re-score
          </ActionButton>
          <ActionButton endpoint={`/api/accounts/${id}/brief`}>Generate brief</ActionButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Overview">
          <dl className="space-y-1 text-sm">
            <Row label="Industry" value={account.industry ?? '—'} />
            <Row label="Size" value={account.employeeRange ?? '—'} />
            <Row label="HQ" value={[account.hqCity, account.region, account.country].filter(Boolean).join(', ')} />
            <Row
              label="Latest score"
              value={
                latestScore ? `${Number(latestScore.score).toFixed(0)} (tier ${latestScore.tier})` : '—'
              }
            />
          </dl>
          <div className="mt-3 flex gap-3 text-sm">
            <Link href={`/prospects/${id}/audit`} className="text-indigo-600 hover:underline">
              Website audit
            </Link>
            <Link href={`/prospects/${id}/brief`} className="text-indigo-600 hover:underline">
              Closer brief
            </Link>
          </div>
        </Card>

        <Card title={`Contacts (${contacts.length})`}>
          <ul className="space-y-2 text-sm">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span>
                  <span className="font-medium">{c.fullName}</span>{' '}
                  <span className="text-slate-500">{c.title}</span>
                </span>
                <Badge>{c.consentStatus}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Signals timeline">
        <ul className="space-y-2 text-sm">
          {signals.map((s) => (
            <li key={s.id} className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span>
                <Badge>{s.type}</Badge>{' '}
                <span className="text-slate-500">{JSON.stringify(s.value)}</span>
              </span>
              <span className="text-xs text-slate-400">weight {Number(s.weight)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Score history">
          <ul className="space-y-1 text-sm">
            {scores.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>
                  {Number(s.score).toFixed(0)} <TierBadge tier={s.tier} />
                </span>
                <span className="text-xs text-slate-400">{s.model}</span>
              </li>
            ))}
            {scores.length === 0 && <li className="text-slate-400">Not scored yet.</li>}
          </ul>
        </Card>
        <Card title={`Drafts (${drafts.length})`}>
          <ul className="space-y-1 text-sm">
            {drafts.map((d) => (
              <li key={d.id} className="flex justify-between">
                <span>{d.subject ?? d.channel}</span>
                <Badge>{d.status}</Badge>
              </li>
            ))}
            {drafts.length === 0 && <li className="text-slate-400">No drafts.</li>}
          </ul>
          <p className="mt-2 text-xs text-slate-400">
            {briefs.length} brief version{briefs.length === 1 ? '' : 's'} generated.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
