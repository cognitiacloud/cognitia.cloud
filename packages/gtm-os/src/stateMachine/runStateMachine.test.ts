import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  canTransition,
  IllegalTransitionError,
  isTerminal,
} from './runStateMachine.js';

describe('run state machine', () => {
  it('permits the authorized path', () => {
    expect(canTransition('lead_received', 'compliance_evaluated')).toBe(true);
    expect(canTransition('compliance_evaluated', 'awaiting_approval')).toBe(true);
    expect(canTransition('awaiting_approval', 'approved')).toBe(true);
    expect(canTransition('approved', 'appointment_booked')).toBe(true);
    expect(canTransition('appointment_booked', 'crm_written')).toBe(true);
    expect(canTransition('crm_written', 'completed')).toBe(true);
  });

  it('forbids skipping approval or jumping states', () => {
    expect(canTransition('awaiting_approval', 'appointment_booked')).toBe(false);
    expect(canTransition('compliance_evaluated', 'crm_written')).toBe(false);
    expect(canTransition('lead_received', 'approved')).toBe(false);
    expect(() => assertTransition('lead_received', 'completed')).toThrow(IllegalTransitionError);
  });

  it('identifies terminal states', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('blocked')).toBe(true);
    expect(isTerminal('rejected')).toBe(true);
    expect(isTerminal('approved')).toBe(false);
    expect(isTerminal('awaiting_approval')).toBe(false);
  });
});
