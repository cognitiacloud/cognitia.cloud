import { describe, it, expect } from 'vitest';
import {
  createProposal,
  evaluateProposal,
  approveProposal,
  rejectProposal,
  rollbackProposal,
  InMemoryProposalStore,
  SelfImprovementError,
  type ImprovementProposal,
} from './selfImprove.js';

/**
 * Item 4 — shadow-mode self-improvement scaffolding. The ledger is INERT:
 * proposals are data, never auto-applied; promotion requires explicit decisions;
 * illegal transitions throw; every record carries auto_applied === false.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const base = () =>
  createProposal({
    tenantId: TENANT,
    kind: 'threshold',
    target: 'rule:scoring.v1',
    rationale: 'raise fit threshold to cut low-quality proposals',
    proposed_change: 'fit_min 0.6 -> 0.7',
    createdBy: 'user:olivia',
    now: '2026-06-14T00:00:00.000Z',
  });

describe('self-improvement proposal ledger (inert, human-gated)', () => {
  it('a new proposal is proposed and is NEVER auto-applied', () => {
    const p = base();
    expect(p.status).toBe('proposed');
    expect(p.auto_applied).toBe(false);
    expect(p.decided_by).toBeNull();
  });

  it('happy path: proposed -> evaluated (evidence) -> approved (decider recorded)', () => {
    const evaluated = evaluateProposal(
      base(),
      { eval_run: 'r1', delta: '+3% precision' },
      'user:olivia',
    );
    expect(evaluated.status).toBe('evaluated');
    expect(evaluated.evidence).toMatchObject({ eval_run: 'r1' });

    const approved = approveProposal(evaluated, 'user:owner', '2026-06-14T01:00:00.000Z');
    expect(approved.status).toBe('approved');
    expect(approved.decided_by).toBe('user:owner');
    expect(approved.decided_at).toBe('2026-06-14T01:00:00.000Z');
    // Approval applies NOTHING — still inert.
    expect(approved.auto_applied).toBe(false);
  });

  it('approved can be rolled back; rejected/rolled_back are terminal', () => {
    const approved = approveProposal(evaluateProposal(base(), {}, 'user:olivia'), 'user:owner');
    const rolled = rollbackProposal(approved, 'user:owner');
    expect(rolled.status).toBe('rolled_back');
    expect(() => approveProposal(rolled, 'user:owner')).toThrow(SelfImprovementError);

    const rejected = rejectProposal(base(), 'user:owner');
    expect(rejected.status).toBe('rejected');
    expect(() => evaluateProposal(rejected, {}, 'user:owner')).toThrow(SelfImprovementError);
  });

  it('illegal transitions are refused (no skipping human review)', () => {
    // proposed -> approved (skipping evaluation) is illegal.
    expect(() => approveProposal(base(), 'user:owner')).toThrow(/illegal transition/i);
    // proposed -> rolled_back is illegal.
    expect(() => rollbackProposal(base(), 'user:owner')).toThrow(SelfImprovementError);
  });

  it('store is tenant-scoped', async () => {
    const store = new InMemoryProposalStore();
    const p = base();
    await store.put(p);
    expect((await store.get(TENANT, p.id))?.id).toBe(p.id);
    expect(await store.get('22222222-2222-2222-2222-222222222222', p.id)).toBeNull();
    expect(await store.list(TENANT)).toHaveLength(1);
  });

  it('auto_applied is structurally false on every transition (no auto-promote)', () => {
    const states: ImprovementProposal[] = [];
    const p = base();
    states.push(p);
    const e = evaluateProposal(p, {}, 'u');
    states.push(e);
    const a = approveProposal(e, 'u');
    states.push(a, rollbackProposal(a, 'u'), rejectProposal(base(), 'u'));
    expect(states.every((s) => s.auto_applied === false)).toBe(true);
  });
});
