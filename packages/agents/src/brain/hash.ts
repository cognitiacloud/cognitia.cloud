/**
 * Brain-local hashing + token-estimate helpers.
 *
 * STATUS: MOCK / SANDBOX. Pure, deterministic, zero-dependency. `node:crypto`
 * is the only crypto dependency permitted in this repo (no new package dep).
 * There is no shared sha256 export in the workspace, so — matching
 * `packages/core/src/gtm/index.ts` — we hash directly with `node:crypto`.
 *
 * Hashes are how the usage ledger records *what* was sent/received without ever
 * persisting the raw prompt or completion (see {@link ../modelUsageLedger}).
 */
import { createHash } from 'node:crypto';

/** Deterministic SHA-256 hex digest of a UTF-8 string (64 hex chars). */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Deterministic, coarse token estimate (~4 chars/token). Used only to model
 * cost/latency in the mock harness — it is NOT a real tokenizer and makes no
 * provider call.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}
