import { describe, expect, it } from 'vitest';
import { ActionLedger } from './actionLedger.js';
import { HumanApprovalRegistry } from './approvalGate.js';
import { fixedClock, sequentialIds } from './testSupport.test.js';

const LEAD_ID = 'bw-fake-lead-0001';

function makeRegistry() {
  return new HumanApprovalRegistry({
    clock: fixedClock(),
    idFactory: sequentialIds('appr'),
    instanceNonce: 'test-nonce-a',
  });
}

describe('human approval registry (trusted local events only)', () => {
  it('reports missing when no approval event exists', () => {
    expect(makeRegistry().verify(LEAD_ID)).toEqual({ status: 'missing' });
  });

  it('verifies an approval it issued itself', () => {
    const registry = makeRegistry();
    const event = registry.issue({
      leadId: LEAD_ID,
      decision: 'approved',
      approvedBy: 'operator_fixture_01',
    });
    const verification = registry.verify(LEAD_ID);
    expect(verification.status).toBe('approved');
    if (verification.status === 'approved') {
      expect(verification.event.approvalId).toBe(event.approvalId);
      expect(verification.event.token).toBe(event.token);
    }
  });

  it('surfaces denied and hold decisions', () => {
    const registry = makeRegistry();
    registry.issue({ leadId: LEAD_ID, decision: 'denied', approvedBy: 'operator_fixture_01' });
    expect(registry.verify(LEAD_ID).status).toBe('denied');
    registry.issue({ leadId: LEAD_ID, decision: 'hold', approvedBy: 'operator_fixture_02' });
    expect(registry.verify(LEAD_ID).status).toBe('hold');
  });

  it('rejects a wholly fabricated approval object as forged', () => {
    const registry = makeRegistry();
    const forged = {
      approvalId: 'appr-9999',
      leadId: LEAD_ID,
      decision: 'approved',
      approvedBy: 'attacker',
      note: null,
      issuedAt: new Date().toISOString(),
      token: 'not-a-real-token',
    };
    expect(registry.verify(LEAD_ID, forged)).toEqual({ status: 'forged' });
  });

  it('rejects a tampered copy of a real approval (token mismatch)', () => {
    const registry = makeRegistry();
    const real = registry.issue({
      leadId: LEAD_ID,
      decision: 'denied',
      approvedBy: 'operator_fixture_01',
    });
    const tampered = { ...real, decision: 'approved' as const };
    // Same approvalId, but the decision no longer matches the stored event.
    expect(registry.verify(LEAD_ID, tampered)).toEqual({ status: 'forged' });
  });

  it('rejects an approval issued by a DIFFERENT registry instance', () => {
    const registryA = makeRegistry();
    const registryB = new HumanApprovalRegistry({
      clock: fixedClock(),
      idFactory: sequentialIds('appr'),
      instanceNonce: 'test-nonce-b',
    });
    const foreign = registryB.issue({
      leadId: LEAD_ID,
      decision: 'approved',
      approvedBy: 'operator_fixture_01',
    });
    // registryA never issued this event; ids collide but tokens cannot match.
    expect(registryA.verify(LEAD_ID, foreign)).toEqual({ status: 'forged' });
  });

  it('rejects an approval bound to a different lead', () => {
    const registry = makeRegistry();
    const other = registry.issue({
      leadId: 'bw-fake-lead-0002',
      decision: 'approved',
      approvedBy: 'operator_fixture_01',
    });
    expect(registry.verify(LEAD_ID, other)).toEqual({ status: 'forged' });
  });

  it('records issued approvals on the action ledger when provided', () => {
    const registry = makeRegistry();
    const ledger = new ActionLedger({ clock: fixedClock(), idFactory: sequentialIds('led') });
    registry.issue({
      leadId: LEAD_ID,
      decision: 'approved',
      approvedBy: 'operator_fixture_01',
      ledger,
    });
    const events = ledger.eventsOfType('approval_issued');
    expect(events).toHaveLength(1);
    expect(events[0]?.payload['leadId']).toBe(LEAD_ID);
    expect(ledger.verifyChain()).toBe(true);
  });
});
