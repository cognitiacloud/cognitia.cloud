/**
 * Brain Usage Ledger — append-only, in-memory provenance for brain runs.
 *
 * Every brain (model-routing) invocation — allowed OR blocked — is reduced to a
 * {@link BrainRunRecord}: provider/model/mode + cost/latency/policy metadata and
 * SHA-256 hashes of the prompt and output. The raw prompt/output text is NEVER
 * stored; only its hash. This lets the rest of the system answer "what did the
 * brain do, at what cost, under which policy?" while carrying zero
 * re-identifiable content at rest.
 *
 * Design notes:
 *   - Hashing is SHA-256 (`node:crypto`), deliberately INDEPENDENT of the Brain
 *     Core mock's FNV `hashBrainText`. The mock hash is a fast, non-secure
 *     fingerprint for deterministic mock content; this ledger is a privacy/proof
 *     receipt, so it uses a cryptographic digest.
 *   - The serialized record is run through {@link assertNoRawPii} before it is
 *     stored, so a regression that smuggled a raw email/phone into any field is
 *     caught loudly rather than persisted.
 *   - In-memory and append-only: there is no update or delete path, `list()`
 *     returns a copy, and stored records are frozen.
 *   - No network / vendor SDK imports (enforced by `brainSourceScan.test.ts`).
 *     Only `node:crypto` and the in-repo PII guard are imported.
 */

import { createHash } from 'node:crypto';
import { assertNoRawPii } from '../crm-lite/timeline.js';
import type { BrainRequest, BrainResponse } from './modelProvider.js';

/** Whether the policy gate allowed the run or blocked it before/at execution. */
export type BrainPolicyDecision = 'allow' | 'block';

/**
 * Execution mode for a run. Only `mock` is reachable in V1 — there is no live
 * model path — but the field is recorded so a future enabled provider is
 * distinguishable in the ledger without a schema change.
 */
export type BrainRunMode = 'mock' | 'live';

/**
 * One immutable ledger entry. Carries hashes only — never raw prompt/output —
 * plus the metadata needed to audit cost, latency, routing and policy. Blocked
 * runs are recorded too, with `policyDecision: 'block'` and a `blockedReason`.
 */
export interface BrainRunRecord {
  /** Ledger-assigned id, unique within the ledger instance. */
  id: string;
  /** ISO-8601 timestamp the record was appended. */
  createdAt: string;
  /** Workspace/tenant the run belongs to (e.g. `budget_wheels_demo`). */
  workspaceId: string;
  /** Coarse task label for routing/segmentation (e.g. `summarize`). */
  taskType: string;
  /** Provider id, aligned with Brain Core (`mock`, `openai`, ...). */
  provider: string;
  /** Model id, aligned with Brain Core (e.g. `mock-deterministic-1`). */
  model: string;
  /** Execution mode; `mock` in V1. */
  mode: BrainRunMode;
  /** SHA-256 hex of the (system + prompt) input. Never the raw text. */
  inputHash: string;
  /** SHA-256 hex of the output content. Never the raw text. */
  outputHash: string;
  /** Estimated cost of the run in abstract units (0 for the mock). */
  costEstimate: number;
  /** Wall-clock latency in milliseconds. */
  latencyMs: number;
  /** True when a fallback provider/model produced the result. */
  fallbackUsed: boolean;
  /** Whether the policy gate allowed or blocked the run. */
  policyDecision: BrainPolicyDecision;
  /** Structured reason when blocked; `null` for allowed runs. */
  blockedReason: string | null;
  /** Stable proof handle `brain-proof:<sha256>` over the record's identity. */
  proofRef: string;
}

/**
 * Input to {@link BrainRunLedger.append}. Callers pass the RAW prompt/output so
 * the ledger can compute its own SHA-256 hashes; the raw text is hashed and
 * discarded, never stored.
 */
export interface AppendBrainRunInput {
  workspaceId: string;
  taskType: string;
  provider: string;
  model: string;
  mode: BrainRunMode;
  /** Raw (system + prompt) input — hashed with SHA-256, never persisted. */
  input: string;
  /** Raw output text — hashed with SHA-256, never persisted. Omit when blocked. */
  output?: string;
  /** Estimated cost in abstract units. Defaults to 0. */
  costEstimate?: number;
  /** Wall-clock latency in ms. Defaults to 0. */
  latencyMs?: number;
  /** Whether a fallback produced the result. Defaults to false. */
  fallbackUsed?: boolean;
  /** Policy outcome. */
  policyDecision: BrainPolicyDecision;
  /** Reason a run was blocked; required-by-convention when blocked. */
  blockedReason?: string | null;
}

/** Injectable clock and id factory so records are deterministic in tests. */
export interface BrainLedgerDeps {
  now?: () => Date;
  newId?: () => string;
}

/** Stable proof-handle prefix; the full ref is `brain-proof:<sha256>`. */
export const BRAIN_PROOF_PREFIX = 'brain-proof:';

/** SHA-256 hex digest of a UTF-8 string. The only hashing primitive used here. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Derive the proof handle for a record's identity. Deterministic: identical
 * identity fields yield an identical ref. Includes workspace + task + both
 * hashes + policy + blocked reason so refs cannot collide across workspaces or
 * task types even when prompt/output happen to match.
 */
export function brainProofRef(parts: {
  workspaceId: string;
  taskType: string;
  inputHash: string;
  outputHash: string;
  policyDecision: BrainPolicyDecision;
  blockedReason: string | null;
}): string {
  const material = [
    parts.workspaceId,
    parts.taskType,
    parts.inputHash,
    parts.outputHash,
    parts.policyDecision,
    parts.blockedReason ?? '',
  ].join(':');
  return `${BRAIN_PROOF_PREFIX}${sha256Hex(material)}`;
}

/**
 * Append-only, in-memory ledger of brain runs. Not a database — state lives
 * only in the instance. Writes are pure given the injected `now`/`newId`.
 */
export class BrainRunLedger {
  private readonly records: BrainRunRecord[] = [];
  private readonly now: () => Date;
  private readonly newId: () => string;
  private seq = 0;

  constructor(deps: BrainLedgerDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => `brain-run-${++this.seq}`);
  }

  /**
   * Record a brain run. Hashes the raw input/output with SHA-256 (the raw text
   * is never stored), derives a stable `proofRef`, runs the PII guard over the
   * serialized record, then appends a frozen copy. Blocked runs are recorded
   * exactly like allowed ones, with their `blockedReason`.
   */
  append(input: AppendBrainRunInput): BrainRunRecord {
    const inputHash = sha256Hex(input.input);
    const outputHash = sha256Hex(input.output ?? '');
    const blockedReason = input.policyDecision === 'block' ? (input.blockedReason ?? null) : null;

    const record: BrainRunRecord = {
      id: this.newId(),
      createdAt: this.now().toISOString(),
      workspaceId: input.workspaceId,
      taskType: input.taskType,
      provider: input.provider,
      model: input.model,
      mode: input.mode,
      inputHash,
      outputHash,
      costEstimate: input.costEstimate ?? 0,
      latencyMs: input.latencyMs ?? 0,
      fallbackUsed: input.fallbackUsed ?? false,
      policyDecision: input.policyDecision,
      blockedReason,
      proofRef: brainProofRef({
        workspaceId: input.workspaceId,
        taskType: input.taskType,
        inputHash,
        outputHash,
        policyDecision: input.policyDecision,
        blockedReason,
      }),
    };

    // Belt-and-braces: never let a raw-looking email/phone reach the ledger,
    // even if a caller smuggled one into a metadata-shaped field.
    assertNoRawPii(JSON.stringify(record));

    this.records.push(Object.freeze(record));
    return { ...record };
  }

  /** All records in insertion order. Returns a copy — mutating it is a no-op. */
  list(): BrainRunRecord[] {
    return this.records.map((r) => ({ ...r }));
  }

  /** Records for a single workspace, in insertion order. */
  byWorkspace(workspaceId: string): BrainRunRecord[] {
    return this.records.filter((r) => r.workspaceId === workspaceId).map((r) => ({ ...r }));
  }

  /** Number of records appended so far. */
  get size(): number {
    return this.records.length;
  }
}

/**
 * Build an {@link AppendBrainRunInput} from a Brain Core {@link BrainRequest} /
 * {@link BrainResponse} pair, keeping the ledger's own SHA-256 hashing (the raw
 * `system + prompt` and `content` are hashed here, never the mock's FNV hash).
 * Provider/model/mode vocabulary is taken straight from the response so the
 * ledger stays compatible with Brain Core without depending on it at runtime.
 */
export function brainRunInputFromExchange(
  request: BrainRequest,
  response: BrainResponse,
  extra: {
    workspaceId: string;
    taskType: string;
    mode: BrainRunMode;
    costEstimate?: number;
    latencyMs?: number;
    fallbackUsed?: boolean;
    policyDecision?: BrainPolicyDecision;
    blockedReason?: string | null;
  },
): AppendBrainRunInput {
  return {
    workspaceId: extra.workspaceId,
    taskType: extra.taskType,
    provider: response.providerId,
    model: response.model,
    mode: extra.mode,
    input: `${request.system ?? ''}\n${request.prompt}`,
    output: response.content,
    costEstimate: extra.costEstimate,
    latencyMs: extra.latencyMs,
    fallbackUsed: extra.fallbackUsed,
    policyDecision: extra.policyDecision ?? 'allow',
    blockedReason: extra.blockedReason ?? null,
  };
}
