import { notFound } from 'next/navigation';
import { getAccountDetail, getLatestBrief } from '@/lib/queries';
import { ActionButton } from '@/components/ActionButton';
import { BackLink, Card, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getAccountDetail(id);
  if (!detail) notFound();
  const brief = await getLatestBrief(id);

  return (
    <div className="space-y-6">
      <BackLink href={`/prospects/${id}`} label={detail.account.displayName} />
      <div className="flex items-start justify-between">
        <PageHeader
          title="Closer brief"
          subtitle={brief ? `Version ${brief.version} · ${brief.model}` : 'Not generated yet'}
        />
        <ActionButton endpoint={`/api/accounts/${id}/brief`}>Regenerate</ActionButton>
      </div>

      {!brief && (
        <Card>
          <p className="text-sm text-slate-400">No brief yet. Generate one to see the playbook.</p>
        </Card>
      )}

      {brief && (
        <>
          <Card title="Summary">
            <p className="text-sm">{brief.summary}</p>
            <p className="mt-2 text-xs text-slate-400">
              Recommended channel: <strong>{brief.recommendedChannel}</strong>
            </p>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Card title="Pain points">
              <List items={brief.painPoints} />
            </Card>
            <Card title="Value props">
              <List items={brief.valueProps} />
            </Card>
          </div>
          <Card title="Talk track">
            <List items={brief.talkTrack} ordered />
          </Card>
          <Card title="Objections">
            <ul className="space-y-2 text-sm">
              {brief.objections.map((o, i) => (
                <li key={i}>
                  <p className="font-medium">“{o.objection}”</p>
                  <p className="text-slate-500">{o.response}</p>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

function List({ items, ordered }: { items: string[]; ordered?: boolean }) {
  const cls = 'list-inside space-y-1 text-sm text-slate-700';
  return ordered ? (
    <ol className={`list-decimal ${cls}`}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ol>
  ) : (
    <ul className={`list-disc ${cls}`}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
