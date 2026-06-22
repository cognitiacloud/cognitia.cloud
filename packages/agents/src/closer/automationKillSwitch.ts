/**
 * Automation kill-switch + rollback-readiness model for the Sales Closer.
 *
 * STATUS: MOCK / SANDBOX. This module is a pure, deterministic, in-memory
 * decision layer. It NEVER sends anything, touches no network/vendor SDK, reads
 * no secrets, and issues NO production-readiness claim. Every output is a
 * dry-run decision object carrying `{ mode: 'dry_run', sent: false }`. Even an
 * `authorized: true` controlled-live decision here authorizes nothing live —
 * actually performing a controlled-live release remains PLANNED and blocked
 * out-of-band.
 *
 * Purpose:
 *  - A defence-in-depth "stop" control that can halt automation at three
 *    scopes (global / workspace / action-type) independently.
 *  - A rollback-readiness model that MUST be satisfied before any
 *    controlled-live authorization is even considered.
 *
 * Precedence + fail-closed:
 *  - The kill switch is the HIGHEST-precedence control. If it blocks, the
 *    action is blocked regardless of consent, approval, release conditions, or
 *    anything else.
 *  - Missing/untested rollback => controlled-live is NOT authorized.
 *  - Unknown action types and unknown stages fail closed.
 */

import {
  evaluateReleaseGate,
  type ReleaseConditions,
  type ReleaseGateResult,
} from '../security/releaseGate.js';

/** The automation action types this control can halt. Mirrors the channel set. */
export const ACTION_TYPES = [
  'email',
  'sms',
  'whatsapp',
  'call',
  'linkedin',
  'ad',
  'crm_writeback',
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

function isActionType(value: string): value is ActionType {
  return (ACTION_TYPES as readonly string[]).includes(value);
}

/**
 * The engaged state of the kill switch. All three scopes are independent and
 * additive — engaging any one of them blocks the matching automation. Default
 * (all empty/false) means NO scope is halted by the switch itself; downstream
 * gates still apply.
 */
export interface KillSwitchState {
  /** Halts ALL automation everywhere when true. Highest precedence. */
  readonly global: boolean;
  /** Workspace/tenant ids whose automation is halted. */
  readonly workspaces: ReadonlySet<string>;
  /** Action types whose automation is halted across all workspaces. */
  readonly actionTypes: ReadonlySet<ActionType>;
}

/** A fresh, all-clear kill-switch state (nothing halted by the switch). */
export function createKillSwitchState(): KillSwitchState {
  return Object.freeze({
    global: false,
    workspaces: new Set<string>(),
    actionTypes: new Set<ActionType>(),
  });
}

/** The scope at which a kill-switch block fired (null when not blocked). */
export type KillSwitchScope = 'global' | 'workspace' | 'action_type' | null;

/** A single automation request evaluated against the kill switch. */
export interface KillSwitchQuery {
  /** Workspace/tenant scope of the action. */
  workspaceId: string;
  /** The action type being attempted. */
  actionType: string;
}

export interface KillSwitchDecision {
  /** True if the kill switch halts this action at any scope. */
  blocked: boolean;
  /** Which scope fired (in precedence order), or null when not blocked. */
  scope: KillSwitchScope;
  reason: string;
  /** SANDBOX marker — this layer only ever decides, never sends. */
  readonly mode: 'dry_run';
  /** SANDBOX marker — nothing is sent by this layer, ever. */
  readonly sent: false;
}

function killDecision(scope: KillSwitchScope, reason: string): KillSwitchDecision {
  return { blocked: scope !== null, scope, reason, mode: 'dry_run', sent: false };
}

/**
 * Pure evaluation of the kill switch for a single action.
 *
 * Precedence (first match wins): global > workspace > action-type. An unknown
 * action type fails closed (treated as blocked) so a malformed request can
 * never slip past the control.
 */
export function evaluateKillSwitch(
  state: KillSwitchState,
  query: KillSwitchQuery,
): KillSwitchDecision {
  if (state.global) {
    return killDecision('global', 'automation halted: GLOBAL kill switch engaged');
  }

  const workspaceId = typeof query.workspaceId === 'string' ? query.workspaceId.trim() : '';
  if (workspaceId === '') {
    return killDecision('workspace', 'automation halted: missing workspaceId (fail closed)');
  }
  if (state.workspaces.has(workspaceId)) {
    return killDecision(
      'workspace',
      `automation halted: WORKSPACE kill switch engaged for "${workspaceId}"`,
    );
  }

  if (!isActionType(query.actionType)) {
    return killDecision(
      'action_type',
      `automation halted: unknown action type "${query.actionType}" (fail closed)`,
    );
  }
  if (state.actionTypes.has(query.actionType)) {
    return killDecision(
      'action_type',
      `automation halted: ACTION-TYPE kill switch engaged for "${query.actionType}"`,
    );
  }

  return killDecision(null, 'kill switch clear at all scopes');
}

/**
 * In-memory, mock-safe manager for engaging/disengaging the kill switch.
 *
 * This is a convenience around immutable {@link KillSwitchState} snapshots for
 * tests and demos. It holds no identity, no persistence, and no network.
 */
export class AutomationKillSwitch {
  #global = false;
  readonly #workspaces = new Set<string>();
  readonly #actionTypes = new Set<ActionType>();

  /** Engage the global kill switch (halts everything). */
  engageGlobal(): void {
    this.#global = true;
  }

  /** Disengage the global kill switch. */
  disengageGlobal(): void {
    this.#global = false;
  }

  /** Engage the kill switch for a specific workspace. */
  engageWorkspace(workspaceId: string): void {
    const id = workspaceId.trim();
    if (id !== '') this.#workspaces.add(id);
  }

  /** Disengage the kill switch for a specific workspace. */
  disengageWorkspace(workspaceId: string): void {
    this.#workspaces.delete(workspaceId.trim());
  }

  /** Engage the kill switch for a specific action type (unknown types ignored). */
  engageActionType(actionType: string): void {
    if (isActionType(actionType)) this.#actionTypes.add(actionType);
  }

  /** Disengage the kill switch for a specific action type. */
  disengageActionType(actionType: string): void {
    if (isActionType(actionType)) this.#actionTypes.delete(actionType);
  }

  /** Snapshot the current engaged state as an immutable {@link KillSwitchState}. */
  snapshot(): KillSwitchState {
    return Object.freeze({
      global: this.#global,
      workspaces: new Set(this.#workspaces),
      actionTypes: new Set(this.#actionTypes),
    });
  }

  /** Evaluate a single action against the current state. */
  evaluate(query: KillSwitchQuery): KillSwitchDecision {
    return evaluateKillSwitch(this.snapshot(), query);
  }
}

/* ------------------------------------------------------------------------- *
 * Rollback readiness model
 * ------------------------------------------------------------------------- */

/** A single, ordered reversal step in a rollback plan. */
export interface RollbackStep {
  /** Stable id for the step. */
  id: string;
  /** Human-readable description of what is reversed. */
  description: string;
  /** True if a machine can reverse it; false if it needs a human. */
  automated: boolean;
}

/**
 * A rollback plan object: how a controlled-live action would be undone if it
 * misbehaves. This is a description only — it performs nothing.
 */
export interface RollbackPlan {
  /** Stable id for the plan. */
  id: string;
  /** Workspace/tenant the plan covers. */
  workspaceId: string;
  /** Action type the plan covers. */
  actionType: ActionType;
  /** Named owner accountable for executing the rollback. */
  owner: string;
  /** Ordered reversal steps. A ready plan needs at least one. */
  steps: ReadonlyArray<RollbackStep>;
  /**
   * Whether the rollback has been exercised in a dry-run/rehearsal. An untested
   * plan is NOT considered ready (fail closed).
   */
  tested: boolean;
}

export interface RollbackReadiness {
  /** True only if the plan satisfies every readiness requirement. */
  ready: boolean;
  /** Human-readable reasons the plan is not ready (empty when ready). */
  missing: string[];
  reason: string;
}

/**
 * Pure readiness assessment of a rollback plan. A plan is ready only if it has:
 *  - a non-empty owner,
 *  - at least one reversal step,
 *  - a known action type, and
 *  - been tested (rehearsed).
 *
 * A missing/undefined plan fails closed (not ready).
 */
export function assessRollbackReadiness(plan?: RollbackPlan | null): RollbackReadiness {
  const missing: string[] = [];

  if (!plan) {
    return {
      ready: false,
      missing: ['rollback plan missing'],
      reason: 'rollback not ready: no rollback plan provided (fail closed)',
    };
  }

  if (typeof plan.owner !== 'string' || plan.owner.trim() === '') {
    missing.push('rollback owner');
  }
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    missing.push('at least one rollback step');
  }
  if (!isActionType(plan.actionType)) {
    missing.push('known action type');
  }
  if (plan.tested !== true) {
    missing.push('rollback rehearsal (tested)');
  }

  const ready = missing.length === 0;
  return {
    ready,
    missing,
    reason: ready
      ? 'rollback ready: plan has an owner, steps, and a passing rehearsal'
      : `rollback not ready: missing ${missing.join(', ')}`,
  };
}

/* ------------------------------------------------------------------------- *
 * Controlled-live authorization (kill switch + rollback + release gate)
 * ------------------------------------------------------------------------- */

export interface ControlledLiveRequest {
  /** Current engaged state of the kill switch. */
  killSwitch: KillSwitchState;
  /** The action being authorized. */
  query: KillSwitchQuery;
  /** Rollback plan for the action (required for authorization). */
  rollbackPlan?: RollbackPlan | null;
  /**
   * The other out-of-band release conditions (counsel/founder signoff, etc.).
   * `rollbackReady` is IGNORED here and derived from {@link rollbackPlan} so the
   * caller cannot assert readiness without a real plan.
   */
  releaseConditions?: ReleaseConditions;
}

export interface ControlledLiveDecision {
  /** SANDBOX decision: would controlled-live be authorized? Never acts live. */
  authorized: boolean;
  /** The kill-switch decision (highest precedence). */
  killSwitch: KillSwitchDecision;
  /** The rollback readiness assessment. */
  rollback: RollbackReadiness;
  /** The underlying release-gate evaluation for `controlled_live`. */
  releaseGate: ReleaseGateResult;
  /** Ordered blocking reasons (empty when authorized). */
  reasons: string[];
  /** SANDBOX marker — this layer only ever decides, never sends. */
  readonly mode: 'dry_run';
  /** SANDBOX marker — nothing is sent by this layer, ever. */
  readonly sent: false;
}

/**
 * Decide whether controlled-live MAY be authorized for a single action.
 *
 * Fail-closed evaluation order:
 *  1. Kill switch — if it blocks at ANY scope, the request is denied regardless
 *     of every other condition. (Highest precedence.)
 *  2. Rollback readiness — a missing/untested plan denies the request.
 *  3. Release gate — the full `controlled_live` condition set must pass, with
 *     `rollbackReady` derived from step 2 (callers cannot self-assert it).
 *
 * The returned object is a decision only. `authorized: true` authorizes a
 * SANDBOX decision; it performs nothing live (`mode: 'dry_run', sent: false`).
 */
export function authorizeControlledLive(req: ControlledLiveRequest): ControlledLiveDecision {
  const reasons: string[] = [];

  const killSwitch = evaluateKillSwitch(req.killSwitch, req.query);
  const rollback = assessRollbackReadiness(req.rollbackPlan);

  // The kill switch wins over everything, even a fully-satisfied release gate.
  if (killSwitch.blocked) {
    reasons.push(killSwitch.reason);
  }
  if (!rollback.ready) {
    reasons.push(rollback.reason);
  }

  // Derive rollbackReady from the real plan; never trust a caller-supplied flag.
  const conditions: ReleaseConditions = {
    ...req.releaseConditions,
    rollbackReady: rollback.ready,
  };
  const releaseGate = evaluateReleaseGate('controlled_live', conditions);
  if (!releaseGate.passed) {
    reasons.push(releaseGate.reason);
  }

  // Authorized only if the kill switch is clear AND rollback is ready AND the
  // full release gate passes. Any single failure denies (fail closed).
  const authorized = !killSwitch.blocked && rollback.ready && releaseGate.passed;

  return {
    authorized,
    killSwitch,
    rollback,
    releaseGate,
    reasons,
    mode: 'dry_run',
    sent: false,
  };
}
