import type { RunPlanView } from './apiClient.js';

/**
 * View-model for the Runs surfaces (list + detail) and shared action formatting.
 * Pure transforms so the Next.js components stay thin and the logic is unit
 * tested here. No imports from `.tsx` modules — plain `.ts` so the root tsconfig
 * (which globs `*.ts` without `jsx`) can typecheck it cleanly.
 */

export const ACTION_TYPE_LABELS: Record<string, string> = {
  'email.draft.send': 'Email',
  'crm.task.create': 'CRM task',
  'crm.note.create': 'CRM note',
};

/** Human channel label for an action type; falls back to the raw type. */
export function actionTypeLabel(actionType: string): string {
  return ACTION_TYPE_LABELS[actionType] ?? actionType;
}

export type RunRollup = RunPlanView['rollup'];

export type RollupKey = 'proposed' | 'approved' | 'rejected' | 'executed' | 'rolled_back';

export interface RollupChip {
  key: RollupKey;
  label: string;
  count: number;
}

const ROLLUP_ORDER: RollupKey[] = ['proposed', 'approved', 'rejected', 'executed', 'rolled_back'];
const ROLLUP_LABELS: Record<RollupKey, string> = {
  proposed: 'Proposed',
  approved: 'Approved',
  rejected: 'Rejected',
  executed: 'Executed',
  rolled_back: 'Rolled back',
};

/**
 * Ordered rollup counts for the chips on a run row / run header. `nonZeroOnly`
 * keeps a list row visually quiet (the console targets ~70% visual / 30% text);
 * the detail header passes the full set.
 */
export function summarizeRollup(
  rollup: RunRollup,
  opts: { nonZeroOnly?: boolean } = {},
): RollupChip[] {
  return ROLLUP_ORDER.map((key) => ({ key, label: ROLLUP_LABELS[key], count: rollup[key] })).filter(
    (c) => (opts.nonZeroOnly ? c.count > 0 : true),
  );
}

/**
 * A run still needs a human when any action remains proposed. Mirrors
 * `RunPlanView.fully_reviewed`, but stays resilient if that field is absent.
 */
export function runNeedsReview(run: Pick<RunPlanView, 'fully_reviewed' | 'rollup'>): boolean {
  if (typeof run.fully_reviewed === 'boolean') return !run.fully_reviewed;
  return run.rollup.proposed > 0;
}

/** Distinct run statuses present, in first-seen order, for the status filter. */
export function runStatusOptions(runs: Array<Pick<RunPlanView, 'status'>>): string[] {
  return Array.from(new Set(runs.map((r) => r.status)));
}
