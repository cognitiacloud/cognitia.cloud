import { hashOf } from '../hashing.js';
import type { ProofDecision, ProofReceipt, RunState, RuntimeEnv, TenantId } from '../types.js';

/**
 * Proof-receipt construction and verification. A receipt is emitted on every
 * run transition (see the engine), attesting the ledger event that recorded the
 * transition (`eventHash`) and chaining to the prior receipt (`prevReceiptHash`
 * -> `receiptHash`). The chain is independently verifiable.
 */

export interface BuildReceiptInput {
  env: RuntimeEnv;
  runId: string;
  tenantId: TenantId;
  seq: number;
  fromState: RunState | null;
  toState: RunState;
  decision: ProofDecision;
  reasons: string[];
  eventHash: string;
  prevReceiptHash: string | null;
}

export function buildProofReceipt(input: BuildReceiptInput): ProofReceipt {
  const core = {
    receiptId: input.env.id('rcpt'),
    runId: input.runId,
    tenantId: input.tenantId,
    seq: input.seq,
    fromState: input.fromState,
    toState: input.toState,
    decision: input.decision,
    reasons: input.reasons,
    eventHash: input.eventHash,
    prevReceiptHash: input.prevReceiptHash,
    at: input.env.now(),
  };
  return { ...core, receiptHash: hashOf(core) };
}

export interface ReceiptChainVerification {
  valid: boolean;
  brokenAt: number | null;
  reason: string | null;
}

export function verifyReceiptChain(receipts: readonly ProofReceipt[]): ReceiptChainVerification {
  let prevReceiptHash: string | null = null;
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    if (receipt === undefined) {
      return { valid: false, brokenAt: i, reason: 'missing receipt' };
    }
    if (receipt.seq !== i) {
      return { valid: false, brokenAt: i, reason: 'non-monotonic seq' };
    }
    if (receipt.prevReceiptHash !== prevReceiptHash) {
      return { valid: false, brokenAt: i, reason: 'prevReceiptHash mismatch' };
    }
    const recomputed = hashOf({
      receiptId: receipt.receiptId,
      runId: receipt.runId,
      tenantId: receipt.tenantId,
      seq: receipt.seq,
      fromState: receipt.fromState,
      toState: receipt.toState,
      decision: receipt.decision,
      reasons: receipt.reasons,
      eventHash: receipt.eventHash,
      prevReceiptHash: receipt.prevReceiptHash,
      at: receipt.at,
    });
    if (recomputed !== receipt.receiptHash) {
      return { valid: false, brokenAt: i, reason: 'receiptHash mismatch' };
    }
    prevReceiptHash = receipt.receiptHash;
  }
  return { valid: true, brokenAt: null, reason: null };
}
