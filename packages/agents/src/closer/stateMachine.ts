/**
 * Pure state machine for the Sales Closer workflow.
 *
 * `transition` is a side-effect-free reducer: it returns the next state on a
 * valid event and a structured `{ ok: false, reason }` on an invalid one (it
 * never throws). Terminal states reject every event. The runner composes this
 * with the compliance gate, mock CRM, and proof builder.
 */

import {
  CLOSER_TERMINAL_STATES,
  type CloserStateTransition,
  type CloserWorkflowEvent,
  type CloserWorkflowState,
} from './types.js';

/** The state every lead starts in. */
export const INITIAL_STATE: CloserWorkflowState = 'received';

const TERMINAL: ReadonlySet<CloserWorkflowState> = new Set(CLOSER_TERMINAL_STATES);

export function isTerminal(state: CloserWorkflowState): boolean {
  return TERMINAL.has(state);
}

/** Static description of allowed transitions (introspection / docs / tests). */
export interface CloserTransitionEdge {
  from: CloserWorkflowState;
  event: CloserWorkflowEvent['type'];
  to: readonly CloserWorkflowState[];
}

export const CLOSER_TRANSITIONS: readonly CloserTransitionEdge[] = [
  {
    from: 'received',
    event: 'RUN_COMPLIANCE_GATE',
    to: ['awaiting_human_approval', 'compliance_blocked'],
  },
  { from: 'awaiting_human_approval', event: 'HUMAN_DECISION', to: ['approved', 'rejected'] },
  { from: 'approved', event: 'BOOK_APPOINTMENT', to: ['appointment_ready'] },
  { from: 'appointment_ready', event: 'WRITE_CRM', to: ['crm_written'] },
  { from: 'crm_written', event: 'EMIT_PROOF', to: ['proof_ready'] },
] as const;

/**
 * Apply one event to a state. Pure: returns the resulting transition, never
 * mutates and never throws.
 */
export function transition(
  state: CloserWorkflowState,
  event: CloserWorkflowEvent,
): CloserStateTransition {
  const fail = (reason: string): CloserStateTransition => ({
    ok: false,
    from: state,
    event: event.type,
    reason,
  });
  const ok = (to: CloserWorkflowState): CloserStateTransition => ({
    ok: true,
    from: state,
    to,
    event: event.type,
  });

  if (isTerminal(state)) {
    return fail(`state '${state}' is terminal; '${event.type}' is not allowed`);
  }

  switch (event.type) {
    case 'RUN_COMPLIANCE_GATE':
      if (state !== 'received') return fail(`RUN_COMPLIANCE_GATE not allowed from '${state}'`);
      return ok(event.passed ? 'awaiting_human_approval' : 'compliance_blocked');
    case 'HUMAN_DECISION':
      if (state !== 'awaiting_human_approval')
        return fail(`HUMAN_DECISION not allowed from '${state}'`);
      return ok(event.decision === 'approve' ? 'approved' : 'rejected');
    case 'BOOK_APPOINTMENT':
      if (state !== 'approved') return fail(`BOOK_APPOINTMENT not allowed from '${state}'`);
      return ok('appointment_ready');
    case 'WRITE_CRM':
      if (state !== 'appointment_ready') return fail(`WRITE_CRM not allowed from '${state}'`);
      return ok('crm_written');
    case 'EMIT_PROOF':
      if (state !== 'crm_written') return fail(`EMIT_PROOF not allowed from '${state}'`);
      return ok('proof_ready');
    default: {
      const _exhaustive: never = event;
      return fail(`unknown event: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
