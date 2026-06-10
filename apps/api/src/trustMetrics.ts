import type { AgentActionRow, FeedbackLabelRow } from '@cognitia/db';

/**
 * MET-1 — trust metrics. The auditable numbers a design partner can check
 * against their own CRM: how much ran, how much a human approved, why things
 * were rejected, how fast decisions happen, and how many duplicate writes the
 * idempotency layer collapsed. Computed from the action ledger + the FLY-1
 * decision labels — no separate counters to drift.
 */
export interface TrustMetrics {
  actions: {
    proposed: number;
    approved: number;
    rejected: number;
    executed: number;
    failed: number;
  };
  /** approved / (approved + rejected); null until something was decided. */
  approval_rate: number | null;
  /** Reason-code mix per decision kind (the FLY-1 labels, aggregated). */
  approve_reasons: Record<string, number>;
  reject_reasons: Record<string, number>;
  /** Median seconds from proposal to decision; null until something was decided. */
  median_decision_seconds: number | null;
  /** Executed actions collapsed by idempotency (a duplicate write that never happened). */
  duplicate_writes_prevented: number;
}

export function computeTrustMetrics(
  actions: AgentActionRow[],
  labels: FeedbackLabelRow[],
): TrustMetrics {
  const byStatus = (s: string) => actions.filter((a) => a.approval_status === s).length;
  const byExec = (s: string) => actions.filter((a) => a.execution_status === s).length;
  const approved = byStatus('approved');
  const rejected = byStatus('rejected');
  const decided = approved + rejected;

  const approveReasons: Record<string, number> = {};
  const rejectReasons: Record<string, number> = {};
  const latencies: number[] = [];
  const actionById = new Map(actions.map((a) => [a.id, a]));

  for (const label of labels) {
    if (label.label !== 'approved' && label.label !== 'rejected') continue;
    const code = typeof label.detail['reason_code'] === 'string' ? label.detail['reason_code'] : '';
    if (code) {
      const bucket = label.label === 'approved' ? approveReasons : rejectReasons;
      bucket[code] = (bucket[code] ?? 0) + 1;
    }
    const actionId = label.subject_ref.startsWith('agent_action:')
      ? label.subject_ref.slice('agent_action:'.length)
      : undefined;
    const action = actionId ? actionById.get(actionId) : undefined;
    if (action) {
      const ms = Date.parse(label.created_at) - Date.parse(action.created_at);
      if (Number.isFinite(ms) && ms >= 0) latencies.push(ms / 1000);
    }
  }

  const duplicatesPrevented = actions.filter(
    (a) => (a.result as { idempotent_replay?: boolean } | null)?.idempotent_replay === true,
  ).length;

  return {
    actions: {
      proposed: byStatus('proposed'),
      approved,
      rejected,
      executed: byExec('executed'),
      failed: byExec('failed'),
    },
    approval_rate: decided > 0 ? approved / decided : null,
    approve_reasons: approveReasons,
    reject_reasons: rejectReasons,
    median_decision_seconds: median(latencies),
    duplicate_writes_prevented: duplicatesPrevented,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
