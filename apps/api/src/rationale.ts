import { scoreAccount, deriveAccountEvidence } from '@cognitia/agents';
import type { AccountRow, ContactRow, AgentActionRow } from '@cognitia/db';

/**
 * WHY-1 — decision rationale. Surfaces, at approval time, the deterministic
 * "why this action" the governed gate is otherwise blind to: the fit/timing
 * score the target account earned, the human-readable CRM facts that ground
 * it (the SAME evidence the agent used — `deriveAccountEvidence`), and how
 * fresh the underlying data is. An operator approving a write should not have
 * to guess what it rests on.
 *
 * Honest by construction: the score is recomputed from the account's own
 * signal columns (`fit_score`/`timing_score`) — the persisted source of truth
 * — and `stale_since_proposal` flags when the CRM row changed AFTER the
 * proposal was created, which is itself the most important governance signal
 * here (the proposal may rest on data that has since moved).
 */

export interface DecisionRationale {
  action_id: string;
  target_ref: string;
  account: {
    id: string;
    name: string;
    industry: string | null;
    employee_count: number | null;
    region: string | null;
  } | null;
  /** Deterministic fit/timing/combined from the account's signal columns. */
  score: { fit: number; timing: number; combined: number } | null;
  /** The human-readable CRM facts grounding the action (canonical evidence). */
  evidence: Array<{ claim: string; source_ref: string; score: number }>;
  /** Count recorded on the action vs facts derivable now (drift check). */
  evidence_refs_on_action: number;
  freshness: {
    /** When the account row was last synced/updated. */
    data_updated_at: string;
    /** Whole days between data_updated_at and now. */
    age_days: number;
    /** When this action was proposed. */
    proposed_at: string;
    /** True if the account changed AFTER the proposal — re-run recommended. */
    stale_since_proposal: boolean;
  } | null;
}

function ageDays(fromIso: string, now: Date): number {
  const ms = now.getTime() - Date.parse(fromIso);
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 86_400_000)) : 0;
}

export function buildActionRationale(
  action: AgentActionRow,
  account: AccountRow | null,
  contacts: ContactRow[],
  now: Date = new Date(),
): DecisionRationale {
  const evidenceRefsOnAction = action.evidence_refs.length;
  if (!account) {
    return {
      action_id: action.id,
      target_ref: action.target_ref,
      account: null,
      score: null,
      evidence: [],
      evidence_refs_on_action: evidenceRefsOnAction,
      freshness: null,
    };
  }
  const score = scoreAccount(account); // recompute from persisted signal columns
  const evidence = deriveAccountEvidence(account, contacts).map((e) => ({
    claim: e.claim,
    source_ref: e.source_ref,
    score: e.score,
  }));
  return {
    action_id: action.id,
    target_ref: action.target_ref,
    account: {
      id: account.id,
      name: account.name,
      industry: account.industry,
      employee_count: account.employee_count,
      region: account.region,
    },
    score,
    evidence,
    evidence_refs_on_action: evidenceRefsOnAction,
    freshness: {
      data_updated_at: account.updated_at,
      age_days: ageDays(account.updated_at, now),
      proposed_at: action.created_at,
      stale_since_proposal: Date.parse(account.updated_at) > Date.parse(action.created_at),
    },
  };
}
