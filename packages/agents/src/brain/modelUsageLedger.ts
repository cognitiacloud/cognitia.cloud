/**
 * Cognitia Brain Harness V1 — model usage ledger (proof receipts).
 *
 * STATUS: MOCK / SANDBOX. In-memory, append-only ledger of model-usage receipts.
 * A receipt is a privacy-safe proof of a routing decision: it records *that* a
 * task ran, on which provider/model, in which mode, with hashes of the input and
 * output — but NEVER the raw prompt or completion. `assertNoRawPii` is run over
 * every free-form string field so raw PII can never enter a receipt.
 *
 * V1 keeps receipts in memory (matching the pure mock-safe lanes). Persisting
 * them through the side-effect `ActionLedger` / `repo.insertAuditEvent` is
 * PLANNED — see `docs/architecture/cognitia-brain-harness.md`.
 */
import { assertNoRawPii } from '../crm-lite/timeline.js';
import { sha256Hex } from './hash.js';
import type { ProviderMode } from './modelProvider.js';

export type PolicyDecisionLabel = 'allow' | 'blocked';

/** The privacy-safe proof receipt for one model-routing decision. */
export interface UsageReceipt {
  workspaceId: string;
  taskType: string;
  provider: string;
  model: string;
  mode: ProviderMode;
  /** SHA-256 hex of the (system + prompt) input. Never the raw text. */
  inputHash: string;
  /** SHA-256 hex of the output, or `null` when nothing was generated (blocked). */
  outputHash: string | null;
  /** Estimated USD cost. `0` for mock/local or when blocked. */
  costEstimate: number;
  latencyMs: number;
  fallbackUsed: boolean;
  policyDecision: PolicyDecisionLabel;
  /** Stable block reason when `policyDecision === 'blocked'`, else `null`. */
  blockedReason: string | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

export interface MakeUsageReceiptInput {
  workspaceId: string;
  taskType: string;
  provider: string;
  model: string;
  mode: ProviderMode;
  /** Raw input text to hash (system + prompt). Hashed, never stored. */
  inputText: string;
  /** Raw output text to hash, or `null`/omitted when blocked. */
  outputText?: string | null;
  costEstimate: number;
  latencyMs: number;
  fallbackUsed: boolean;
  policyDecision: PolicyDecisionLabel;
  blockedReason?: string | null;
  createdAt: string;
}

/**
 * Build a receipt: hash the input/output and assert no raw PII leaked into any
 * free-form string field. The raw `inputText`/`outputText` are consumed for
 * hashing only and never returned.
 */
export function makeUsageReceipt(input: MakeUsageReceiptInput): UsageReceipt {
  // Free-form fields that a caller could accidentally populate with PII.
  for (const field of [input.workspaceId, input.taskType, input.provider, input.model]) {
    assertNoRawPii(field);
  }
  if (input.blockedReason) assertNoRawPii(input.blockedReason);

  return {
    workspaceId: input.workspaceId,
    taskType: input.taskType,
    provider: input.provider,
    model: input.model,
    mode: input.mode,
    inputHash: sha256Hex(input.inputText),
    outputHash:
      input.outputText === undefined || input.outputText === null
        ? null
        : sha256Hex(input.outputText),
    costEstimate: input.costEstimate,
    latencyMs: input.latencyMs,
    fallbackUsed: input.fallbackUsed,
    policyDecision: input.policyDecision,
    blockedReason: input.blockedReason ?? null,
    createdAt: input.createdAt,
  };
}

/** In-memory, append-only ledger of usage receipts. */
export class ModelUsageLedger {
  private readonly receipts: UsageReceipt[] = [];

  /** Append a receipt. Returns the same receipt for convenience. */
  append(receipt: UsageReceipt): UsageReceipt {
    this.receipts.push(receipt);
    return receipt;
  }

  /** All receipts in append order. */
  list(): readonly UsageReceipt[] {
    return [...this.receipts];
  }

  /** Receipts for a single workspace, in append order. */
  byWorkspace(workspaceId: string): readonly UsageReceipt[] {
    return this.receipts.filter((r) => r.workspaceId === workspaceId);
  }

  get size(): number {
    return this.receipts.length;
  }
}
