'use client';

// components/portal/ApprovalQueue.tsx
import { useAppState } from '@/lib/store/useAppState';
import { ApprovalCard } from '@/components/portal/ApprovalCard';
import { DisclosureNote } from '@/components/portal/DisclosureNote';

export function ApprovalQueue() {
  const { approvals, aiDrafts } = useAppState();
  const draftById = new Map(aiDrafts.map((d) => [d.id, d]));
  const pending = approvals.filter((a) => a.status === 'pending');
  const decided = approvals.filter((a) => a.status !== 'pending');

  return (
    <div className="space-y-8">
      <DisclosureNote tone="info">
        AI agents draft; a human approves. No message is sent and no listing is published without an
        explicit decision here. Sensitive claims (finance, trade-in, warranty, accident history,
        price, availability) always require approval.
      </DisclosureNote>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-ink-100">
          Pending
          <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-xs font-semibold text-gold-700">
            {pending.length}
          </span>
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface-2 p-6 text-sm text-ink-400">
            Nothing awaiting approval. Generate a reply from a lead to see the gate in action.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((a) => (
              <ApprovalCard key={a.id} approval={a} draft={draftById.get(a.draftId)} />
            ))}
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-ink-100">Decided</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {decided.slice(0, 6).map((a) => (
              <ApprovalCard key={a.id} approval={a} draft={draftById.get(a.draftId)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
