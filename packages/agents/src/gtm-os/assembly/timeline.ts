import type { IsoTimestamp } from '@cognitia/core';
import type {
  SalesCloserState,
  TransitionVia,
  WorkflowTransition,
} from '../../closer/salesCloserWorkflow.js';

/**
 * Operator-facing timeline derived from the workflow transition log.
 *
 * The workflow records low-level `from → to` transitions; an operator console
 * wants an ordered, human-readable phase log. {@link toOperatorTimeline} maps
 * each transition to one timeline row with a phase label, an outcome
 * classification, and the proof/blocked detail. Pure — no IO.
 */

/** How a single timeline step resolved. */
export type TimelineOutcome = 'advanced' | 'halted' | 'blocked';

export interface TimelineRow {
  /** 1-based ordinal of the step in the run. */
  step: number;
  via: TransitionVia;
  from: SalesCloserState;
  to: SalesCloserState;
  at: IsoTimestamp;
  /** Short operator-facing label, e.g. "Compliance check". */
  phase: string;
  outcome: TimelineOutcome;
  detail?: string;
}

const PHASE_BY_VIA: Record<TransitionVia, string> = {
  init: 'Lead received',
  compliance: 'Compliance check',
  approval: 'Human approval gate',
  appointment: 'Appointment requested',
  crm: 'CRM writeback (mock)',
  proof: 'Proof report',
};

const BLOCKED_STATES: ReadonlySet<SalesCloserState> = new Set<SalesCloserState>([
  'blocked_compliance',
  'blocked_approval',
  'blocked_appointment',
  'blocked_crm',
  'blocked_proof',
]);

function classify(transition: WorkflowTransition): TimelineOutcome {
  if (BLOCKED_STATES.has(transition.to)) return 'blocked';
  // A self-loop into the approval gate means the run halted awaiting a human.
  if (transition.via === 'approval' && transition.to === 'human_approval_required') {
    return 'halted';
  }
  return 'advanced';
}

/** Project the workflow transition log onto an ordered operator timeline. */
export function toOperatorTimeline(transitions: readonly WorkflowTransition[]): TimelineRow[] {
  return transitions.map((t, index) => ({
    step: index + 1,
    via: t.via,
    from: t.from,
    to: t.to,
    at: t.at,
    phase: PHASE_BY_VIA[t.via],
    outcome: classify(t),
    detail: t.detail,
  }));
}
