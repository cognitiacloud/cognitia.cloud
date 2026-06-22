import { TERMINAL_STATES, type RunState } from '../types.js';

/**
 * The run state machine for the single authorized v0 flow:
 *
 *   lead_received -> compliance_evaluated -> awaiting_approval -> approved
 *     -> appointment_booked -> crm_written -> completed
 *
 * with two terminal off-ramps: `compliance_evaluated -> blocked` (gate failed)
 * and `awaiting_approval -> rejected` (human declined). Illegal transitions
 * throw, so the consequential states are unreachable except along this path.
 */

export const TRANSITIONS: Record<RunState, readonly RunState[]> = {
  lead_received: ['compliance_evaluated'],
  compliance_evaluated: ['awaiting_approval', 'blocked'],
  awaiting_approval: ['approved', 'rejected'],
  approved: ['appointment_booked'],
  appointment_booked: ['crm_written'],
  crm_written: ['completed'],
  completed: [],
  blocked: [],
  rejected: [],
};

export class IllegalTransitionError extends Error {
  constructor(from: RunState, to: RunState) {
    super(`illegal run transition: ${from} -> ${to}`);
    this.name = 'IllegalTransitionError';
  }
}

export function canTransition(from: RunState, to: RunState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: RunState, to: RunState): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}

export function isTerminal(state: RunState): boolean {
  return (TERMINAL_STATES as readonly RunState[]).includes(state);
}
