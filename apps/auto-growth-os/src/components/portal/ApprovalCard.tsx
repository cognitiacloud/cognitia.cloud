'use client';

// components/portal/ApprovalCard.tsx
// One AI draft awaiting human approval. Shows the risk, flagged claims, and a
// one-click safer rewrite. Nothing is released without a human decision.
import { useState } from 'react';
import type { AIDraft, Approval } from '@/types/portal';
import { useAppState } from '@/lib/store/useAppState';
import { suggestSaferRewrite } from '@/lib/guardrails';
import { Button } from '@/components/ui/Button';
import { RiskBadge, ClaimChips } from '@/components/portal/RiskBadge';
import { formatDate } from '@/lib/format';

export function ApprovalCard({ approval, draft }: { approval: Approval; draft?: AIDraft }) {
  const { decideApproval } = useAppState();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft?.content ?? '');
  const decided = approval.status !== 'pending';
  const safer =
    draft && draft.claimTypes.length > 0
      ? suggestSaferRewrite(draft.content, draft.claimTypes)
      : null;

  return (
    <div className="rounded-2xl border border-line glass p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold text-ink-100">
            {approval.itemType.replace(/_/g, ' ')}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            {draft?.subjectLabel ?? approval.draftId} · {approval.agentId}
          </p>
        </div>
        <RiskBadge level={approval.riskLevel} />
      </div>

      <div className="mt-3">
        <ClaimChips claims={approval.claimTypes} />
      </div>

      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="mt-3 w-full resize-y rounded-lg border border-line bg-surface-2 p-3 text-sm text-ink-100 outline-none focus:border-cyan-400/50"
        />
      ) : (
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-3 font-sans text-sm leading-relaxed text-ink-200">
          {draft?.content ?? '(draft unavailable)'}
        </pre>
      )}

      {safer && !decided && (
        <div className="mt-3 rounded-lg border border-mint-400/30 bg-mint-400/[0.06] p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-mint-600">
            Suggested safer wording
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-300">{safer}</p>
          <Button
            variant="tech"
            size="sm"
            className="mt-2"
            onClick={() => decideApproval(approval.id, 'edited', { editedContent: safer })}
          >
            Apply safer wording &amp; approve
          </Button>
        </div>
      )}

      {decided ? (
        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-500">
          {approval.status} by {approval.decidedBy} ·{' '}
          {approval.decidedAt ? formatDate(approval.decidedAt) : ''}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          {editing ? (
            <>
              <Button
                variant="gold"
                size="sm"
                onClick={() => decideApproval(approval.id, 'edited', { editedContent: text })}
              >
                Save &amp; approve
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="gold"
                size="sm"
                onClick={() => decideApproval(approval.id, 'approved')}
              >
                Approve &amp; send
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setText(draft?.content ?? '');
                  setEditing(true);
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => decideApproval(approval.id, 'rejected')}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
