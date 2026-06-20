import { listPendingDrafts } from '@/lib/queries';
import { ActionButton } from '@/components/ActionButton';
import { Badge, Card, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const rows = await listPendingDrafts();

  return (
    <div className="space-y-6">
      <PageHeader title="Outreach approval queue" subtitle={`${rows.length} pending`} />

      {rows.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">Nothing awaiting approval. 🎉</p>
        </Card>
      )}

      {rows.map(({ draft, contact, account }) => (
        <Card key={draft.id}>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1 border-r border-slate-100 pr-4 text-sm">
              <p className="font-semibold">{account.displayName}</p>
              <p className="text-slate-500">{account.domain}</p>
              <p className="mt-2">{contact.fullName}</p>
              <p className="text-slate-500">{contact.title}</p>
              <div className="mt-2">
                <Badge>{draft.channel}</Badge> <Badge>{contact.consentStatus}</Badge>
              </div>
            </div>
            <div className="col-span-2">
              {draft.subject && <p className="text-sm font-medium">{draft.subject}</p>}
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{draft.body}</p>
              <div className="mt-4 flex gap-2">
                <ActionButton endpoint={`/api/drafts/${draft.id}/approve`}>Approve</ActionButton>
                <ActionButton endpoint={`/api/drafts/${draft.id}/reject`} variant="danger">
                  Reject
                </ActionButton>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
