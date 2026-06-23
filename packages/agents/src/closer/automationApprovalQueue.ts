/**
 * Automation approval queue — a READ-MODEL for automation readiness.
 *
 * STATUS: MOCK / SANDBOX. This module composes an inspectable view over actions
 * that an operator may review before they could ever progress toward live
 * execution. It is a pure projection: it performs NO send, touches NO network,
 * reads NO secrets, and issues NO production-readiness claim. It only DECIDES
 * and DESCRIBES.
 *
 * The single most important invariant encoded here: APPROVAL DOES NOT IMPLY
 * SEND. A queue item being `approved` only clears the human-review gate; it does
 * not authorise execution, and it never sends. Execution eligibility requires,
 * in addition to approval, that the controlled-live release gate passes (see
 * `@cognitia/agents` `releaseGate.ts`). Even when eligibility is granted, the
 * embedded action remains a dry-run plan with `sent: false` — eligibility is a
 * read-model verdict, not an outbound effect. The dry-run channel layer fails
 * closed regardless of anything decided here.
 *
 * Fail-closed: pending and rejected items can never execute; approved items
 * cannot execute unless every required live condition is satisfied; an approved
 * + gate-open item is merely ELIGIBLE — `willSend` is always `false`.
 */

import type { ConsentStatus } from '@cognitia/core';
import { assertNoLiveSend, type DryRunAction } from '../channels/dryRunChannels.js';
import { evaluateReleaseGate, type ReleaseConditions } from '../security/releaseGate.js';

/** Human-review state of a queued action. Mirrors the closer approval port. */
export type ApprovalState = 'pending' | 'approved' | 'rejected';

/** Coarse risk classification for operator triage. */
export type RiskLevel = 'low' | 'medium' | 'high';

export const RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high'] as const;

/**
 * The lawful basis claimed for acting on a contact. Reuses the canonical
 * `@cognitia/core` consent vocabulary (`ConsentStatus`) so the queue never
 * invents its own. Aliased under the queue's own name to avoid colliding with
 * the audience lane's unrelated `ConsentBasis` enum in the package barrel.
 */
export type QueueConsentBasis = ConsentStatus;

/**
 * A short, non-PII preview of the proof/evidence backing an action. Holds only
 * a label, an operator-facing summary, and a redacted reference (e.g. a proof
 * ledger id or digest). Raw PII must never be placed here.
 */
export interface ProofPreview {
  /** What kind of proof this previews (e.g. 'consent_capture', 'dry_run_plan'). */
  kind: string;
  /** Operator-facing one-liner. Redacted/synthetic only. */
  summary: string;
  /** Opaque reference to the full proof record (id/hash). Never raw PII. */
  redactedRef: string;
}

/** Input used to build one queue item. Identifiers and previews only. */
export interface AutomationApprovalQueueItemInput {
  /** Workspace / tenant scope. Required and non-empty. */
  workspaceId: string;
  /** Human-review state for this action. */
  approval: ApprovalState;
  /** Lawful basis claimed for the action. */
  consentBasis: QueueConsentBasis;
  /** The exact dry-run action under review. MUST be `sent: false` / dry-run. */
  action: DryRunAction;
  /** Proof preview backing the action. */
  proofPreview: ProofPreview;
  /**
   * Sandbox flags modelling out-of-band live conditions. Absent/false fields
   * fail closed against the controlled-live gate.
   */
  releaseConditions?: ReleaseConditions;
  /** Explicit risk override. When omitted, risk is derived from consent basis. */
  riskLevel?: RiskLevel;
  /** Operator-facing summary override. Defaults to the action's preview text. */
  actionSummary?: string;
}

/**
 * The eligibility verdict for a queue item.
 *
 * `canExecute` is true ONLY when the item is approved AND every required live
 * condition is satisfied. `willSend` is ALWAYS `false`: eligibility is a
 * read-model decision and never performs or authorises an outbound send.
 */
export interface ExecutionDecision {
  /** Eligible to advance toward execution. Never true for pending/rejected. */
  canExecute: boolean;
  /** Ordered, human-readable reasons execution is blocked. Empty if eligible. */
  blockedBy: string[];
  /** Always false. Approval/eligibility does NOT imply a send in this layer. */
  willSend: false;
}

/** A fully-projected approval-queue item (the read-model output). */
export interface AutomationApprovalQueueItem {
  workspaceId: string;
  actionSummary: string;
  consentBasis: QueueConsentBasis;
  riskLevel: RiskLevel;
  proofPreview: ProofPreview;
  /** The exact dry-run action. Always `sent: false`, `mode: 'dry_run'`. */
  dryRunAction: DryRunAction;
  approval: ApprovalState;
  /** Required live conditions that are NOT yet satisfied (human labels). */
  missingLiveConditions: string[];
  execution: ExecutionDecision;
}

/**
 * Deterministically derive a risk level from the consent basis. Weaker consent
 * => higher risk. Pure and total over the consent vocabulary.
 */
export function deriveRiskLevel(consentBasis: QueueConsentBasis): RiskLevel {
  switch (consentBasis) {
    case 'express':
      return 'low';
    case 'implied_possible':
      return 'medium';
    case 'not_established':
    case 'unsubscribed':
    case 'do_not_contact':
      return 'high';
    default: {
      // Unknown basis fails closed to the highest risk.
      const _exhaustive: never = consentBasis;
      void _exhaustive;
      return 'high';
    }
  }
}

/**
 * Evaluate whether a queued item may advance toward execution. Fails closed.
 *
 * Order of checks (first failure stops eligibility but all reasons accrue):
 *  1. `pending`  => blocked (`approval_pending`).
 *  2. `rejected` => blocked (`approval_rejected`).
 *  3. `approved` but controlled-live gate not fully satisfied => blocked with
 *     the specific missing live conditions.
 *
 * `canExecute` is true only when approved AND the gate passes. `willSend` is
 * always false — eligibility is never a send.
 */
export function evaluateExecutability(
  approval: ApprovalState,
  releaseConditions: ReleaseConditions = {},
): ExecutionDecision {
  const gate = evaluateReleaseGate('controlled_live', releaseConditions);
  const blockedBy: string[] = [];

  if (approval === 'pending') {
    blockedBy.push('approval_pending: awaiting human review');
  } else if (approval === 'rejected') {
    blockedBy.push('approval_rejected: human review rejected this action');
  }

  if (!gate.passed) {
    // Surface the precise missing live conditions so the operator sees exactly
    // what is outstanding, even when approval itself is already blocking.
    blockedBy.push(`release_gate_closed: missing ${gate.missing.join(', ') || 'live conditions'}`);
  }

  const canExecute = approval === 'approved' && gate.passed;

  return { canExecute, blockedBy, willSend: false };
}

/**
 * Build one approval-queue read-model item.
 *
 * Validates inputs and refuses to project a non-dry-run action: `assertNoLiveSend`
 * throws on any forged/tampered action that claims to have sent. This keeps the
 * queue incapable of ever holding a "sent" action.
 */
export function buildApprovalQueueItem(
  input: AutomationApprovalQueueItemInput,
): AutomationApprovalQueueItem {
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    throw new Error('automationApprovalQueue: a non-empty workspaceId is required');
  }
  // Tripwire: the queue may only ever hold dry-run, never-sent actions.
  assertNoLiveSend(input.action);

  const gate = evaluateReleaseGate('controlled_live', input.releaseConditions ?? {});
  const riskLevel = input.riskLevel ?? deriveRiskLevel(input.consentBasis);
  const actionSummary = input.actionSummary ?? input.action.wouldSendIfLive.summary;

  return {
    workspaceId: input.workspaceId,
    actionSummary,
    consentBasis: input.consentBasis,
    riskLevel,
    proofPreview: input.proofPreview,
    dryRunAction: input.action,
    approval: input.approval,
    missingLiveConditions: gate.missing,
    execution: evaluateExecutability(input.approval, input.releaseConditions ?? {}),
  };
}

/** Sort order: highest risk first, then by workspace then plan ref (stable). */
const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

/**
 * Build the full approval-queue read-model from a list of inputs, ordered for
 * operator triage (highest risk first). Pure and deterministic.
 */
export function buildApprovalQueue(
  inputs: ReadonlyArray<AutomationApprovalQueueItemInput>,
): AutomationApprovalQueueItem[] {
  return inputs.map(buildApprovalQueueItem).sort((a, b) => {
    const byRisk = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
    if (byRisk !== 0) return byRisk;
    const byWorkspace = a.workspaceId.localeCompare(b.workspaceId);
    if (byWorkspace !== 0) return byWorkspace;
    return a.dryRunAction.planRef.localeCompare(b.dryRunAction.planRef);
  });
}

/** Convenience: the subset of items that are eligible to execute (read-only). */
export function executableItems(
  queue: ReadonlyArray<AutomationApprovalQueueItem>,
): AutomationApprovalQueueItem[] {
  return queue.filter((item) => item.execution.canExecute);
}
