import { describe, expect, it } from 'vitest';
import { DryRunExecutionLedger, type DryRunExecutionInput } from './dryRunExecutionLedger.js';

/** A clean, fully-cleared input: approved + consent granted + dry-run stage. */
function clearedInput(overrides: Partial<DryRunExecutionInput> = {}): DryRunExecutionInput {
  return {
    workspaceId: 'ws_budget_wheels_demo',
    actionType: 'email',
    prospectRef: 'prospect_0001',
    approvalState: 'approved',
    consentState: 'granted',
    releaseStage: 'dry_run',
    ...overrides,
  };
}

/** Fixed clock for deterministic timestamps. */
const fixedNow = () => new Date('2026-06-22T12:00:00.000Z');

describe('DryRunExecutionLedger', () => {
  describe('sent invariant', () => {
    it('records sent:false for a fully-cleared action', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      const entry = ledger.record(clearedInput());
      expect(entry.sent).toBe(false);
      expect(entry.outcome).toBe('recorded');
    });

    it('records sent:false even when blocked', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      const rejected = ledger.record(clearedInput({ approvalState: 'rejected' }));
      const noConsent = ledger.record(clearedInput({ consentState: 'denied' }));
      expect(rejected.sent).toBe(false);
      expect(noConsent.sent).toBe(false);
    });

    it('every entry across the ledger has sent:false', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      ledger.record(clearedInput());
      ledger.record(clearedInput({ approvalState: 'pending' }));
      ledger.record(clearedInput({ releaseStage: 'controlled_live', actionType: 'sms' }));
      expect(ledger.list().every((e) => e.sent === false)).toBe(true);
    });
  });

  describe('approval gating', () => {
    it('records a pending approval as blocked', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      const entry = ledger.record(clearedInput({ approvalState: 'pending' }));
      expect(entry.outcome).toBe('blocked');
      expect(entry.sent).toBe(false);
      expect(entry.blockedReasons.join(' ')).toContain('approval');
    });

    it('records a rejected approval as blocked', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      const entry = ledger.record(clearedInput({ approvalState: 'rejected' }));
      expect(entry.outcome).toBe('blocked');
      expect(entry.blockedReasons.join(' ')).toContain('approval');
    });

    it('records a denied/unknown consent as blocked (fail-closed)', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      const denied = ledger.record(clearedInput({ consentState: 'denied' }));
      const unknown = ledger.record(clearedInput({ consentState: 'unknown' }));
      expect(denied.outcome).toBe('blocked');
      expect(unknown.outcome).toBe('blocked');
      expect(denied.blockedReasons.join(' ')).toContain('consent');
    });
  });

  describe('release gate', () => {
    it('records controlled-live with missing conditions as blocked', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      const entry = ledger.record(clearedInput({ releaseStage: 'controlled_live' }));
      expect(entry.gateResult.passed).toBe(false);
      expect(entry.outcome).toBe('blocked');
      expect(entry.sent).toBe(false);
      expect(entry.gateResult.missing.length).toBeGreaterThan(0);
    });

    it('records controlled-live with partial conditions as blocked', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      const entry = ledger.record(
        clearedInput({
          releaseStage: 'controlled_live',
          releaseConditions: {
            signedCustomerScope: true,
            counselSignoff: true,
            // founderSignoff + monitoring + rollback + secrets + connector missing
          },
        }),
      );
      expect(entry.gateResult.passed).toBe(false);
      expect(entry.outcome).toBe('blocked');
    });

    it('dry-run stage passes the gate (still sent:false)', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      const entry = ledger.record(clearedInput());
      expect(entry.gateResult.passed).toBe(true);
      expect(entry.outcome).toBe('recorded');
      expect(entry.sent).toBe(false);
    });
  });

  describe('no raw PII', () => {
    it('serialized ledger contains no raw PII', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      ledger.record(
        clearedInput({
          prospectRef: 'prospect_0001',
          actionType: 'email',
          note: 'reach lead@buyer.example via dry-run',
          proofRef: 'proof:dryrun:budget_wheels_demo:0001',
        }),
      );
      const json = ledger.serialize();
      expect(json).not.toContain('@gmail.com');
      // The guard would have thrown if a raw email/phone slipped in.
      expect(() => ledger.serialize()).not.toThrow();
    });

    it('rejects a raw-looking email in the prospect ref', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      expect(() => ledger.record(clearedInput({ prospectRef: 'realbuyer@gmail.com' }))).toThrow(
        /PII/,
      );
      expect(ledger.size).toBe(0);
    });

    it('rejects a raw-looking phone number in a note', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      expect(() => ledger.record(clearedInput({ note: 'call +1 (415) 867-5309 now' }))).toThrow(
        /PII/,
      );
    });

    it('allows synthetic example/reserved values', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      expect(() =>
        ledger.record(
          clearedInput({
            note: 'preview to gm@dealer.example at +1-555-0142',
          }),
        ),
      ).not.toThrow();
    });
  });

  describe('ledger mechanics', () => {
    it('assigns increasing seq and stable refs', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      const a = ledger.record(clearedInput());
      const b = ledger.record(clearedInput({ prospectRef: 'prospect_0002' }));
      expect(a.seq).toBe(1);
      expect(b.seq).toBe(2);
      expect(a.entryRef).not.toBe(b.entryRef);
      expect(a.proofRef).toContain('proof:dryrun');
    });

    it('derives a deterministic createdAt from the injected clock', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      const entry = ledger.record(clearedInput());
      expect(entry.createdAt).toBe('2026-06-22T12:00:00.000Z');
    });

    it('exposes blocked() and a defensive list() copy', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      ledger.record(clearedInput());
      ledger.record(clearedInput({ approvalState: 'pending' }));
      expect(ledger.blocked()).toHaveLength(1);
      const copy = ledger.list();
      copy.pop();
      expect(ledger.size).toBe(2);
    });

    it('produces frozen, immutable entries', () => {
      const ledger = new DryRunExecutionLedger({ now: fixedNow });
      const entry = ledger.record(clearedInput());
      expect(Object.isFrozen(entry)).toBe(true);
    });
  });
});
