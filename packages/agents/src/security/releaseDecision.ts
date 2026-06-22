/**
 * Mock-safe enterprise-readiness primitive: a COMPOSED release decision.
 *
 * STATUS: MOCK / SANDBOX. This composes three existing local primitives — the
 * permission model, the release gate, and workspace isolation — into a single
 * fail-closed decision. It is a pure decision function. It does NOT perform a
 * release, touch secrets/connectors/the network, or make any production-
 * readiness claim. Actually progressing to a live stage remains PLANNED and
 * blocked until legal + customer + founder signoff land out-of-band.
 *
 * The guarantee proven by the tests: a `controlled_live` decision is `allowed`
 * ONLY when ALL of the following hold simultaneously —
 *   1. the actor's role holds `configure_live_connector`, AND
 *   2. every one of the 7 release conditions is true, AND
 *   3. the target workspace is the sandbox (Tenant Zero).
 * Any missing element fails the decision closed.
 */

import { can, type Role } from './permissionModel.js';
import { evaluateReleaseGate, type ReleaseConditions, type ReleaseStage } from './releaseGate.js';
import {
  assertSandboxWorkspace,
  WorkspaceIsolationError,
  type WorkspaceRef,
} from './workspaceIsolation.js';

/** Permission required to attempt any stage beyond `dry_run`. */
const STAGE_PERMISSION = 'configure_live_connector';

/** Stages that may act on the real world and therefore require the permission above. */
const LIVE_CAPABLE_STAGES: ReadonlySet<ReleaseStage> = new Set([
  'private_pilot',
  'controlled_live',
]);

export interface ReleaseDecisionInput {
  /** The actor requesting the stage progression. */
  role: string;
  /** The release stage being requested. */
  stage: string;
  /** The attested release conditions (booleans; default empty => fail closed). */
  conditions?: ReleaseConditions;
  /** The workspace the decision is scoped to. Must be the sandbox. */
  workspace: WorkspaceRef;
}

export interface ReleaseDecision {
  /** True only when permission, gate, and workspace checks ALL pass. */
  allowed: boolean;
  stage: string;
  /** Did the actor's role hold the required permission? */
  permissionOk: boolean;
  /** Did the release gate pass for the stage + conditions? */
  gateOk: boolean;
  /** Did the workspace pass the sandbox-isolation check? */
  workspaceOk: boolean;
  /** Ordered, human-readable reasons the decision was denied (empty if allowed). */
  blockers: string[];
  reason: string;
}

/**
 * Pure, fail-closed release decision. Evaluates every independent check (it does
 * not short-circuit) so the caller sees the full set of blockers at once.
 */
export function decideRelease(input: ReleaseDecisionInput): ReleaseDecision {
  const { role, stage, conditions, workspace } = input;
  const blockers: string[] = [];

  // 1. Permission. dry_run needs none; live-capable stages need the connector perm.
  const needsPermission = LIVE_CAPABLE_STAGES.has(stage as ReleaseStage);
  const permissionOk = !needsPermission || can(role, STAGE_PERMISSION);
  if (!permissionOk) {
    blockers.push(`role "${role}" lacks "${STAGE_PERMISSION}"`);
  }

  // 2. Release gate (already fails closed on unknown stage / missing conditions).
  const gate = evaluateReleaseGate(stage, conditions);
  const gateOk = gate.passed;
  if (!gateOk) {
    blockers.push(gate.reason);
  }

  // 3. Workspace isolation: must be the sandbox tenant.
  let workspaceOk = true;
  try {
    assertSandboxWorkspace(workspace, 'release workspace');
  } catch (err) {
    workspaceOk = false;
    blockers.push(err instanceof WorkspaceIsolationError ? err.message : 'workspace check failed');
  }

  const allowed = permissionOk && gateOk && workspaceOk;
  return {
    allowed,
    stage,
    permissionOk,
    gateOk,
    workspaceOk,
    blockers,
    reason: allowed
      ? `release stage "${stage}" permitted (sandbox, all conditions met)`
      : `release stage "${stage}" denied: ${blockers.join('; ')}`,
  };
}

/** Convenience guard: the role that may even attempt a live-capable stage. */
export function canAttemptLiveStage(role: Role): boolean {
  return can(role, STAGE_PERMISSION);
}
