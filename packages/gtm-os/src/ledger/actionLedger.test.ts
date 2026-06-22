import { describe, expect, it } from 'vitest';
import { createDeterministicEnv } from '../ids.js';
import { PiiViolationError } from '../pii/piiSafety.js';
import { AppendOnlyLedger, verifyLedger } from './actionLedger.js';

describe('append-only action ledger', () => {
  it('appends hash-chained events that verify', () => {
    const ledger = new AppendOnlyLedger(createDeterministicEnv());
    const e0 = ledger.append({
      runId: 'run_1',
      tenantId: 'cognitia_internal',
      kind: 'run.created',
      summary: 'a',
      detail: { leadId: 'lead_cg_001' },
    });
    const e1 = ledger.append({
      runId: 'run_1',
      tenantId: 'cognitia_internal',
      kind: 'run.transition',
      summary: 'b',
      detail: { from: 'lead_received', to: 'compliance_evaluated' },
    });
    expect(e0.prevHash).toBeNull();
    expect(e1.prevHash).toBe(e0.hash);
    expect(verifyLedger(ledger.all()).valid).toBe(true);
  });

  it('detects tampering anywhere in the chain', () => {
    const ledger = new AppendOnlyLedger(createDeterministicEnv());
    ledger.append({
      runId: 'r',
      tenantId: 'cognitia_internal',
      kind: 'run.created',
      summary: 'a',
      detail: {},
    });
    ledger.append({
      runId: 'r',
      tenantId: 'cognitia_internal',
      kind: 'run.transition',
      summary: 'b',
      detail: {},
    });
    const tampered = ledger.all().map((e, i) => (i === 0 ? { ...e, summary: 'TAMPERED' } : e));
    const result = verifyLedger(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
  });

  it('all() returns a copy that cannot mutate internal state', () => {
    const ledger = new AppendOnlyLedger(createDeterministicEnv());
    ledger.append({
      runId: 'r',
      tenantId: 'cognitia_internal',
      kind: 'run.created',
      summary: 'a',
      detail: {},
    });
    const copy = ledger.all();
    copy.pop();
    expect(ledger.size()).toBe(1);
  });

  it('rejects raw PII in any payload (fail-closed)', () => {
    const ledger = new AppendOnlyLedger(createDeterministicEnv());
    expect(() =>
      ledger.append({
        runId: 'r',
        tenantId: 'cognitia_internal',
        kind: 'run.created',
        summary: 's',
        detail: { leaked: 'a@real-corp.test' },
      }),
    ).toThrow(PiiViolationError);
  });
});
