/**
 * Cognitia Brain Harness — Run Ledger.
 *
 * An append-only record of every routing decision the brain makes. It is the
 * accountability surface: which provider/model served which task for which
 * workspace, at what (estimated) cost and latency, whether a fallback fired,
 * and what the policy decided — plus a `proofRef` over the whole record.
 *
 * PRIVACY: the ledger stores ONLY sha256 hashes of the prompt and output. It
 * never stores the raw prompt or raw model output, and `record()` actively
 * refuses any entry that contains raw PII (email/phone shapes) anywhere in its
 * serialized form. This is the belt-and-braces guarantee behind "no raw PII".
 */

import { createHash } from 'node:crypto';
import type { BrainMode, BrainPolicyDecisionCode } from './brainPolicy.js';
import type { BrainTaskType } from './taskRegistry.js';

/** One immutable ledger entry. Hashes only — never raw prompt/output/PII. */
export interface BrainRunRecord {
  id: string;
  createdAt: string;
  workspaceId: string;
  taskType: BrainTaskType;
  /** Provider id that served (or would have served) the run. */
  provider: string;
  /** Model id used (or the candidate that was blocked). */
  model: string;
  /** Routing mode in force for the run. */
  mode: BrainMode;
  /** sha256 of the prompt. */
  inputHash: string;
  /** sha256 of the output ('' when nothing executed). */
  outputHash: string;
  /** Estimated USD cost (0 for mock/local/blocked). */
  costEstimate: number;
  /** Measured latency in ms (0 when nothing executed). */
  latencyMs: number;
  /** Whether the served provider was reached via the fallback chain. */
  fallbackUsed: boolean;
  /** The terminal policy decision code for the run. */
  policyDecision: BrainPolicyDecisionCode;
  /** sha256-based reference over the canonicalised record. */
  proofRef: string;
}

/** Fields a caller supplies; the ledger fills `id`, `createdAt`, `proofRef`. */
export type BrainRunRecordInput = Omit<BrainRunRecord, 'id' | 'createdAt' | 'proofRef'>;

/** Pluggable storage. The default keeps records in memory. */
export interface BrainLedgerStore {
  append(record: BrainRunRecord): void;
  all(): BrainRunRecord[];
  find(id: string): BrainRunRecord | undefined;
}

class InMemoryLedgerStore implements BrainLedgerStore {
  private readonly records: BrainRunRecord[] = [];
  append(record: BrainRunRecord): void {
    this.records.push(record);
  }
  all(): BrainRunRecord[] {
    return [...this.records];
  }
  find(id: string): BrainRunRecord | undefined {
    return this.records.find((r) => r.id === id);
  }
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** sha256 of the prompt — the only thing stored about an input. */
export function hashInput(input: string): string {
  return sha256Hex(input);
}

/** sha256 of the output — the only thing stored about a model's answer. */
export function hashOutput(output: string): string {
  return sha256Hex(output);
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[\s\-.])?\(?\d{3}\)?[\s\-.]\d{3}[\s\-.]\d{4}/;

/**
 * Throw if a serialized ledger entry contains a raw email or phone number. The
 * ledger only ever holds hashes/ids/codes, so this should never fire — it is a
 * regression tripwire that fails loudly rather than persisting PII.
 */
export function assertLedgerNoRawPii(record: BrainRunRecord): void {
  const serialized = JSON.stringify(record);
  if (EMAIL_RE.test(serialized)) {
    throw new Error('brain ledger: refused entry — raw email detected');
  }
  if (PHONE_RE.test(serialized)) {
    throw new Error('brain ledger: refused entry — raw phone number detected');
  }
}

export interface BrainRunLedgerDeps {
  store?: BrainLedgerStore;
  now?: () => Date;
  newId?: () => string;
}

/**
 * The ledger. Deterministic when `now`/`newId` are injected (tests, demos).
 * `record()` computes the proofRef, runs the PII tripwire, then appends.
 */
export class BrainRunLedger {
  private readonly store: BrainLedgerStore;
  private readonly now: () => Date;
  private readonly newId: () => string;
  private seq = 0;

  constructor(deps: BrainRunLedgerDeps = {}) {
    this.store = deps.store ?? new InMemoryLedgerStore();
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => `brain-run-${String(++this.seq).padStart(6, '0')}`);
  }

  record(input: BrainRunRecordInput): BrainRunRecord {
    const id = this.newId();
    const createdAt = this.now().toISOString();
    // proofRef is computed over the stable (non-volatile) routing facts so it is
    // reproducible for identical decisions, independent of id/timestamp.
    const canonical = JSON.stringify({
      workspaceId: input.workspaceId,
      taskType: input.taskType,
      provider: input.provider,
      model: input.model,
      mode: input.mode,
      inputHash: input.inputHash,
      outputHash: input.outputHash,
      policyDecision: input.policyDecision,
      fallbackUsed: input.fallbackUsed,
    });
    const proofRef = `brain-proof:${sha256Hex(canonical)}`;
    const record: BrainRunRecord = { id, createdAt, proofRef, ...input };
    assertLedgerNoRawPii(record);
    this.store.append(record);
    return record;
  }

  list(): BrainRunRecord[] {
    return this.store.all();
  }

  get(id: string): BrainRunRecord | undefined {
    return this.store.find(id);
  }
}
