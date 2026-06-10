import type { AgentRunRow, AgentActionRow } from '@cognitia/db';

/**
 * RUN-1 — run/plan rollups. A Mira run already groups the actions it proposed
 * (`agent_run_id`); this turns that grouping into the operator's unit of work —
 * the governed answer to "campaigns". Each run reports its objective, status,
 * and a rollup of its actions' approval/execution state, so an operator can
 * review and act on a whole run rather than loose individual actions.
 *
 * Pure + derived live from runs + the ledger; no separate counters.
 */

export interface RunRollup {
  total: number;
  proposed: number;
  approved: number;
  rejected: number;
  executed: number;
  rolled_back: number;
  /** Action types proposed in this run, with counts. */
  action_types: Record<string, number>;
}

export interface RunPlan {
  run_id: string;
  agent: string;
  objective: string;
  status: string;
  created_at: string;
  rollup: RunRollup;
  /** True when every proposed action in the run has been decided (no pending review). */
  fully_reviewed: boolean;
}

export function buildRunPlans(runs: AgentRunRow[], actions: AgentActionRow[]): RunPlan[] {
  const byRun = new Map<string, AgentActionRow[]>();
  for (const a of actions) {
    const arr = byRun.get(a.agent_run_id) ?? [];
    arr.push(a);
    byRun.set(a.agent_run_id, arr);
  }

  return runs.map((run) => {
    const slice = byRun.get(run.id) ?? [];
    const byApproval = (s: string) => slice.filter((a) => a.approval_status === s).length;
    const byExec = (s: string) => slice.filter((a) => a.execution_status === s).length;
    const actionTypes: Record<string, number> = {};
    for (const a of slice) actionTypes[a.action_type] = (actionTypes[a.action_type] ?? 0) + 1;
    const proposed = byApproval('proposed');
    return {
      run_id: run.id,
      agent: run.agent,
      objective: run.objective,
      status: run.status,
      created_at: run.created_at,
      rollup: {
        total: slice.length,
        proposed,
        approved: byApproval('approved'),
        rejected: byApproval('rejected'),
        executed: byExec('executed'),
        rolled_back: byExec('rolled_back'),
        action_types: actionTypes,
      },
      // A run is fully reviewed when nothing is still awaiting a decision.
      fully_reviewed: slice.length > 0 && proposed === 0,
    };
  });
}
