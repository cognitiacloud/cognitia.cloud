'use client';

// components/portal/AgentRoster.tsx
// Visualizes the Cognitia agent economy: each agent's mission, permissions
// (allow/deny), risk boundary, internal trust score, and recent ledger activity.
import { AGENTS } from '@/lib/agents';
import { useAppState } from '@/lib/store/useAppState';
import { Badge } from '@/components/ui/Badge';
import { RiskBadge } from '@/components/portal/RiskBadge';
import { DisclosureNote } from '@/components/portal/DisclosureNote';
import type { Agent } from '@/types/portal';

const TIER_LABEL: Record<Agent['trustTier'], string> = {
  observe: 'Observe',
  assist: 'Assist',
  act_with_approval: 'Act w/ approval',
};

function AgentCard({ agent, actions }: { agent: Agent; actions: number }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-line glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold text-ink-100">{agent.name}</p>
          <p className="mt-0.5 text-xs text-ink-400">{agent.mission}</p>
        </div>
        <Badge tone="cyan">{TIER_LABEL[agent.trustTier]}</Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <RiskBadge level={agent.riskBoundary} />
        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-400">
          Trust {agent.trustScore}/100
        </span>
        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-400">
          {actions} actions
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-xs">
        <div>
          <p className="mb-1 font-semibold uppercase tracking-wider text-mint-600">Allowed</p>
          <div className="flex flex-wrap gap-1">
            {agent.allowedActions.map((a) => (
              <span key={a} className="rounded bg-mint-400/10 px-1.5 py-0.5 text-mint-600">
                {a.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 font-semibold uppercase tracking-wider text-rose-600">Forbidden</p>
          <div className="flex flex-wrap gap-1">
            {agent.forbiddenActions.slice(0, 5).map((a) => (
              <span key={a} className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-600">
                {a.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentRoster() {
  const { ledger } = useAppState();
  const counts = new Map<string, number>();
  for (const e of ledger) counts.set(e.actorId, (counts.get(e.actorId) ?? 0) + 1);

  return (
    <div className="space-y-5">
      <DisclosureNote tone="info">
        Agents are <strong>deny-by-default</strong>: each may only perform its allowed actions and
        never its forbidden ones. Every agent action writes to the action ledger, and high-risk
        drafts require human approval. Trust scores are internal operational demo scores — not
        external certifications.
      </DisclosureNote>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {AGENTS.map((a) => (
          <AgentCard key={a.id} agent={a} actions={counts.get(a.id) ?? 0} />
        ))}
      </div>
    </div>
  );
}
