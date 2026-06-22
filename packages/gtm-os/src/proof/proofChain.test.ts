import { describe, expect, it } from 'vitest';
import { createDeterministicEnv } from '../ids.js';
import { buildProofReceipt, verifyReceiptChain } from './proofReceipt.js';

describe('proof receipt chain', () => {
  it('builds a verifiable receipt chain', () => {
    const env = createDeterministicEnv();
    const r0 = buildProofReceipt({
      env,
      runId: 'r',
      tenantId: 'cognitia_internal',
      seq: 0,
      fromState: null,
      toState: 'lead_received',
      decision: 'noop',
      reasons: [],
      eventHash: 'e0',
      prevReceiptHash: null,
    });
    const r1 = buildProofReceipt({
      env,
      runId: 'r',
      tenantId: 'cognitia_internal',
      seq: 1,
      fromState: 'lead_received',
      toState: 'compliance_evaluated',
      decision: 'allowed',
      reasons: [],
      eventHash: 'e1',
      prevReceiptHash: r0.receiptHash,
    });
    const result = verifyReceiptChain([r0, r1]);
    expect(result.valid).toBe(true);
  });

  it('detects a broken receipt chain', () => {
    const env = createDeterministicEnv();
    const r0 = buildProofReceipt({
      env,
      runId: 'r',
      tenantId: 'cognitia_internal',
      seq: 0,
      fromState: null,
      toState: 'lead_received',
      decision: 'noop',
      reasons: [],
      eventHash: 'e0',
      prevReceiptHash: null,
    });
    const tampered = { ...r0, toState: 'completed' as const };
    expect(verifyReceiptChain([tampered]).valid).toBe(false);
  });
});
