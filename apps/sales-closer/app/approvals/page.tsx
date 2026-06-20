import { listPendingDrafts } from '@/lib/queries';
import { ActionButton } from '@/components/ActionButton';
import { Badge, Card, PageHeader, SafetyBanner } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const rows = await listPendingDrafts();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Human-in-the-loop"
        title="Outreach approval queue"
        subtitle={`${rows.length} draft${rows.length === 1 ? '' : 's'} waiting for a human decision`}
      />

      <SafetyBanner tone="gold" title="Nothing sends automatically">
        Every message below is a draft. No email, call, or message leaves the system until a person
        clicks Approve. Rejected drafts are logged and never sent.
      </SafetyBanner>

      {rows.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">Nothing awaiting approval right now.</p>
        </Card>
      )}

      {rows.map(({ draft, contact, account }) => (
        <Card key={draft.id}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="border-navy/5 pr-5 text-sm lg:col-span-1 lg:border-r">
              <p className="font-semibold text-navy">{account.displayName}</p>
              <p className="text-slate-500">{account.domain}</p>
              <p className="mt-3 font-medium text-ink">{contact.fullName}</p>
              <p className="text-slate-500">{contact.title}</p>
              <p className="mt-1 text-xs text-slate-400">{contact.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="navy">{draft.channel}</Badge>
                <Badge tone={contact.consentStatus === 'opted_in' ? 'green' : 'amber'}>
                  {contact.consentStatus.replace('_', ' ')}
                </Badge>
                <Badge tone="amber">awaiting approval</Badge>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="rounded-lg border border-navy/10 bg-canvas">
                {draft.subject && (
                  <div className="border-b border-navy/5 px-4 py-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Subject:</span> {draft.subject}
                  </div>
                )}
                <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-relaxed text-ink">
                  {draft.body}
                </pre>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <ActionButton endpoint={`/api/drafts/${draft.id}/approve`}>
                  Approve &amp; queue handoff
                </ActionButton>
                <ActionButton endpoint={`/api/drafts/${draft.id}/reject`} variant="danger">
                  Reject
                </ActionButton>
                <span className="ml-auto text-xs text-slate-400">
                  Approval is recorded in the compliance audit trail.
                </span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
