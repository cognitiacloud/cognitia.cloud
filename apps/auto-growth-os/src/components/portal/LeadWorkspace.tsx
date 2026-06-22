'use client';

// components/portal/LeadWorkspace.tsx
// Connected lead view: the rich detail panel plus the Cognitia Sales Draft Agent.
// Generating a reply routes a draft into the AI approval queue — nothing sends
// without a human decision.
import Link from 'next/link';
import { useAppState } from '@/lib/store/useAppState';
import { LeadDetailPanel } from '@/components/dashboard/LeadDetailPanel';
import { ApprovalCard } from '@/components/portal/ApprovalCard';
import { DisclosureNote } from '@/components/portal/DisclosureNote';
import { Button } from '@/components/ui/Button';
import { StageBadge } from '@/components/ui/Badge';
import { STAGE_ORDER } from '@/lib/constants';

const BASE_OWNERS = ['Unassigned', 'Priya Anand', 'Diego Martins', 'Daniel Roy', 'Sam Carter'];

export function LeadWorkspace({ leadId }: { leadId: string }) {
  const { leads, aiDrafts, approvals, createAiDraft, updateLeadStage, assignLead, mounted } =
    useAppState();
  const lead = leads.find((l) => l.id === leadId);

  if (!lead) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-sm text-ink-400">
          {mounted ? 'Lead not found.' : 'Loading…'}{' '}
          <Link href="/portal/leads" className="text-cyan-700">
            Back to leads
          </Link>
        </p>
      </div>
    );
  }

  const myDrafts = aiDrafts.filter((d) => d.subjectId === leadId);
  const apprByDraft = new Map(approvals.map((a) => [a.draftId, a]));
  const owners = Array.from(new Set([...BASE_OWNERS, lead.owner]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr] lg:items-start">
      <div>
        <Link href="/portal/leads" className="mb-3 inline-block text-sm text-cyan-700">
          ← All leads
        </Link>
        <LeadDetailPanel lead={lead} />
      </div>

      <div className="space-y-4">
        {/* Pipeline + ownership — wired to the store (emits an action-ledger entry). */}
        <div className="rounded-2xl border border-line glass p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-sm font-semibold text-ink-100">Pipeline stage</p>
            <StageBadge stage={lead.stage} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {STAGE_ORDER.map((stage) => {
              const active = stage === lead.stage;
              return (
                <button
                  key={stage}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateLeadStage(lead.id, stage)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-700'
                      : 'border-line bg-surface text-ink-400 hover:border-cyan-400/30 hover:text-ink-100'
                  }`}
                >
                  {stage}
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <label
              htmlFor="lead-owner"
              className="text-xs font-semibold uppercase tracking-wider text-ink-500"
            >
              Owner
            </label>
            <select
              id="lead-owner"
              value={lead.owner}
              onChange={(e) => assignLead(lead.id, e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-400/50"
            >
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-line glass p-5">
          <p className="font-display text-sm font-semibold text-ink-100">
            Cognitia Sales Draft Agent
          </p>
          <p className="mt-1 text-xs text-ink-400">
            Drafts a safe reply or summary. Sensitive topics route to the AI approval queue.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="tech"
              size="sm"
              onClick={() => {
                void createAiDraft(leadId, 'reply');
              }}
            >
              Generate reply draft
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void createAiDraft(leadId, 'lead_summary');
              }}
            >
              Generate summary
            </Button>
          </div>
        </div>

        <DisclosureNote tone="info">
          Generated drafts appear here and in{' '}
          <Link href="/portal/ai-approvals" className="text-cyan-700">
            AI Approvals
          </Link>
          . High-risk drafts cannot send without approval.
        </DisclosureNote>

        {myDrafts.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface-2 p-5 text-sm text-ink-400">
            No drafts yet for this lead.
          </p>
        ) : (
          myDrafts.map((d) => {
            const appr = apprByDraft.get(d.id);
            return appr ? (
              <ApprovalCard key={d.id} approval={appr} draft={d} />
            ) : (
              <div key={d.id} className="rounded-2xl border border-line glass p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  {d.kind.replace(/_/g, ' ')} · internal
                </p>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-3 font-sans text-sm text-ink-200">
                  {d.content}
                </pre>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
