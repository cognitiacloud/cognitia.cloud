/**
 * DRY-RUN EXECUTION LEDGER.
 *
 * An append-only, in-memory record of every action the closer *would* take —
 * and never did. Each entry captures the governance context (approval, consent,
 * release gate) around a planned action together with the immutable fact that
 * nothing was sent.
 *
 * STATUS: MOCK / SANDBOX. There is no network, no vendor SDK, no DB, and no live
 * egress. The ledger is a decision/audit surface, not an executor.
 *
 * Fail-closed guarantees:
 *  - Every entry has `sent: false`, literally and unconditionally. There is no
 *    code path that records a sent action.
 *  - An entry whose approval is not `approved`, whose consent is not `granted`,
 *    or whose release gate did not pass is recorded with `outcome: 'blocked'`.
 *    Unknown / partial state therefore blocks (the gate and the state checks all
 *    default to the safe side).
 *  - No raw PII may enter the ledger: every string field is passed through
 *    {@link assertNoRawPii}, and {@link DryRunExecutionLedger.serialize} re-scans
 *    the full serialized payload before returning it.
 *
 * The release-gate evaluation reuses the canonical {@link evaluateReleaseGate}
 * so "controlled-live missing conditions" is judged by exactly the same rules as
 * the rest of the platform.
 */

import { assertNoRawPii } from '../crm-lite/timeline.js';
import {
  evaluateReleaseGate,
  type ReleaseConditions,
  type ReleaseGateResult,
  type ReleaseStage,
} from '../security/releaseGate.js';

/** Human-approval state for the planned action. Non-`approved` blocks. */
export type ApprovalState = 'approved' | 'rejected' | 'pending';

/** Consent state for the prospect/contact. Non-`granted` blocks. */
export type ConsentState = 'granted' | 'denied' | 'unknown';

/** Whether the entry was recorded as actionable-in-dry-run or blocked. */
export type LedgerOutcome = 'recorded' | 'blocked';

/** Environment label — never a production claim. */
export type LedgerEnvironment = 'MOCK' | 'SANDBOX';

/**
 * Input for recording one planned action. Identifiers and previews only —
 * `prospectRef` and every other string must be an opaque ref or a synthetic /
 * redacted value (e.g. `*.example`, `555-01xx`). Raw PII is rejected.
 */
export interface DryRunExecutionInput {
  /** Workspace / tenant scope. */
  workspaceId: string;
  /** What kind of action was planned (e.g. `email`, `sms`, `crm_writeback`). */
  actionType: string;
  /** Opaque prospect/contact reference (NOT raw PII). */
  prospectRef: string;
  /** Human-approval state at planning time. */
  approvalState: ApprovalState;
  /** Consent state at planning time. */
  consentState: ConsentState;
  /** Release stage being evaluated. Defaults to `'dry_run'`. */
  releaseStage?: ReleaseStage;
  /** Sandbox release conditions; default/empty fails closed for live stages. */
  releaseConditions?: ReleaseConditions;
  /** Reference to the proof/receipt record for this entry (auto-derived if absent). */
  proofRef?: string;
  /** Optional preview note. Must be PII-safe. */
  note?: string;
  /** Defaults to `'MOCK'`. */
  environment?: LedgerEnvironment;
}

/**
 * One immutable ledger entry. `sent` is always `false`. `gateResult` is the
 * canonical release-gate evaluation. `outcome` is `'blocked'` whenever approval,
 * consent, or the gate did not clear; `blockedReasons` lists why.
 */
export interface DryRunLedgerEntry {
  /** 1-based append order within this ledger instance. */
  seq: number;
  /** Stable, deterministic reference for this entry. */
  entryRef: string;
  workspaceId: string;
  actionType: string;
  prospectRef: string;
  approvalState: ApprovalState;
  consentState: ConsentState;
  gateResult: ReleaseGateResult;
  /** Always literally `false`. The action was not, and cannot be, sent here. */
  sent: false;
  proofRef: string;
  outcome: LedgerOutcome;
  /** Reasons the action was blocked; empty when `outcome === 'recorded'`. */
  blockedReasons: string[];
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  environment: LedgerEnvironment;
  /** Optional PII-safe preview note. */
  note?: string;
}

export interface DryRunExecutionLedgerDeps {
  now?: () => Date;
}

/** Validate every free-text string on the input against the PII guard. */
function assertInputPiiSafe(input: DryRunExecutionInput): void {
  assertNoRawPii(input.workspaceId);
  assertNoRawPii(input.actionType);
  assertNoRawPii(input.prospectRef);
  if (input.proofRef !== undefined) assertNoRawPii(input.proofRef);
  if (input.note !== undefined) assertNoRawPii(input.note);
}

/**
 * Compute the blocking reasons for a planned action. Fail-closed: anything other
 * than approved + granted + a passing gate produces at least one reason.
 */
function computeBlockedReasons(
  approvalState: ApprovalState,
  consentState: ConsentState,
  gateResult: ReleaseGateResult,
): string[] {
  const reasons: string[] = [];
  if (approvalState !== 'approved') {
    reasons.push(`approval not granted (state: ${approvalState})`);
  }
  if (consentState !== 'granted') {
    reasons.push(`consent not granted (state: ${consentState})`);
  }
  if (!gateResult.passed) {
    reasons.push(gateResult.reason);
  }
  return reasons;
}

/**
 * Append-only, in-memory dry-run execution ledger. Not a database — state lives
 * only in the instance. Writes are pure given the injected `now`.
 */
export class DryRunExecutionLedger {
  private readonly entries: DryRunLedgerEntry[] = [];
  private readonly now: () => Date;
  private seqCounter = 0;

  constructor(deps: DryRunExecutionLedgerDeps = {}) {
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * Record one planned action. Always returns an entry with `sent: false`. If
   * approval, consent, or the release gate did not clear, the entry's
   * `outcome` is `'blocked'`. Throws if any field contains raw-looking PII.
   */
  record(input: DryRunExecutionInput): DryRunLedgerEntry {
    assertInputPiiSafe(input);

    const stage: ReleaseStage = input.releaseStage ?? 'dry_run';
    const gateResult = evaluateReleaseGate(stage, input.releaseConditions ?? {});
    const blockedReasons = computeBlockedReasons(
      input.approvalState,
      input.consentState,
      gateResult,
    );
    const outcome: LedgerOutcome = blockedReasons.length === 0 ? 'recorded' : 'blocked';

    const seq = ++this.seqCounter;
    const entryRef = `ledger:${input.workspaceId}:${input.actionType}:${input.prospectRef}:${seq}`;
    const proofRef =
      input.proofRef ??
      `proof:dryrun:${input.workspaceId}:${input.actionType}:${input.prospectRef}:${seq}`;

    // proofRef may have been auto-derived from already-validated fields, but a
    // caller-supplied one was validated above; re-validate the final value to be
    // safe against any future change to derivation.
    assertNoRawPii(proofRef);

    const entry: DryRunLedgerEntry = Object.freeze({
      seq,
      entryRef,
      workspaceId: input.workspaceId,
      actionType: input.actionType,
      prospectRef: input.prospectRef,
      approvalState: input.approvalState,
      consentState: input.consentState,
      gateResult,
      // The cast pins the literal `false` type even though `sent` is a const.
      sent: false as const,
      proofRef,
      outcome,
      blockedReasons,
      createdAt: this.now().toISOString(),
      environment: input.environment ?? 'MOCK',
      ...(input.note !== undefined ? { note: input.note } : {}),
    });

    this.entries.push(entry);
    return entry;
  }

  /** All entries in append order (defensive copy). */
  list(): DryRunLedgerEntry[] {
    return [...this.entries];
  }

  /** Entries that were blocked (approval/consent/gate did not clear). */
  blocked(): DryRunLedgerEntry[] {
    return this.entries.filter((e) => e.outcome === 'blocked');
  }

  /** Number of entries recorded. */
  get size(): number {
    return this.entries.length;
  }

  /**
   * Serialize the full ledger to JSON. Re-scans the serialized payload with the
   * PII guard before returning, so a serialized ledger can never carry raw PII
   * even if a future field were added without its own guard.
   */
  serialize(): string {
    const json = JSON.stringify(this.entries, null, 2);
    assertNoRawPii(json);
    return json;
  }
}
