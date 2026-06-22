/**
 * Pure automation release-gate engine (Sales Closer).
 *
 * STATUS: MOCK / SANDBOX. This is a single, deterministic decision function. It
 * decides whether a workspace action may advance from "nothing" → dry-run
 * simulation → controlled live automation. It does NOT perform any action, does
 * NOT touch the network, secrets, connectors, CRMs, or vendor SDKs, and issues
 * NO production-readiness claim. Actually authorizing live automation in the
 * real world remains PLANNED and stays gated behind the out-of-band signoffs
 * modelled here.
 *
 * Design rules (enforced by the tests):
 *  - Fail closed by default. Every input is optional and an absent/unknown
 *    value is treated as NOT satisfied. The empty input fails closed to
 *    `blocked`.
 *  - Approved human review (`approvalStatus === 'approved'`) is REQUIRED for any
 *    progression but is NEVER sufficient by itself — it can at most unlock
 *    `ready_for_dry_run`, never `controlled_live_authorized`.
 *  - The kill switch overrides everything. When engaged, the decision is
 *    `blocked` regardless of every other input.
 *  - No imports, no network, no vendor SDK — this module is intentionally pure.
 */

/** The three terminal decisions, from most restricted to most exposed. */
export type AutomationDecision = 'blocked' | 'ready_for_dry_run' | 'controlled_live_authorized';

export type ConsentStatus = 'granted' | 'revoked' | 'pending' | 'unknown';
export type ApprovalStatus = 'approved' | 'rejected' | 'pending' | 'unknown';
export type ConnectorApprovalStatus = 'approved' | 'denied' | 'pending' | 'unknown';
export type SecretsStatus = 'ready' | 'missing' | 'unknown';
export type RateLimitStatus = 'ok' | 'throttled' | 'exceeded' | 'unknown';
export type MonitoringStatus = 'active' | 'inactive' | 'unknown';
export type RollbackStatus = 'ready' | 'unavailable' | 'unknown';

/**
 * Inputs to the gate. Every field is optional so that partial/unknown state
 * fails closed. SANDBOX values only — asserting a status here does NOT make it
 * true in the real world; it models that an out-of-band attestation exists.
 */
export interface AutomationReleaseInput {
  /** Workspace the action belongs to. Empty/missing => unidentified => blocked. */
  workspaceId?: string;
  /** What is being automated (e.g. an outreach channel). Empty => blocked. */
  actionType?: string;
  /** Recipient/contact consent for this action. */
  consentStatus?: ConsentStatus;
  /** Human review of the action ("approved human review"). */
  approvalStatus?: ApprovalStatus;
  /** Explicit approval of the live connector/integration. */
  connectorApproval?: ConnectorApprovalStatus;
  /** Whether required secrets are configured (SANDBOX flag; no secret is read). */
  secretsStatus?: SecretsStatus;
  /** Rate-limit health for the live path. */
  rateLimitStatus?: RateLimitStatus;
  /** Live monitoring / alerting state. */
  monitoringStatus?: MonitoringStatus;
  /** Tested rollback path state. */
  rollbackStatus?: RollbackStatus;
  /** Founder has signed off on going live. */
  founderSignoff?: boolean;
  /** Legal counsel has signed off on going live. */
  legalSignoff?: boolean;
  /** Client has signed off on going live. */
  clientSignoff?: boolean;
  /** Master stop. When `true`, overrides everything and forces `blocked`. */
  killSwitch?: boolean;
}

/** Stable identifiers for every gate condition (used in `missingKeys`). */
export type AutomationConditionKey =
  | 'workspaceIdentified'
  | 'actionTyped'
  | 'consentGranted'
  | 'humanApproval'
  | 'connectorApproved'
  | 'secretsReady'
  | 'rateLimitHealthy'
  | 'monitoringActive'
  | 'rollbackReady'
  | 'founderSignoff'
  | 'legalSignoff'
  | 'clientSignoff';

/** Which gate a condition belongs to. `dry_run` conditions are a prerequisite
 * of the `controlled_live` conditions (the live set is a strict superset). */
export type ConditionTier = 'dry_run' | 'controlled_live';

interface ConditionSpec {
  key: AutomationConditionKey;
  label: string;
  tier: ConditionTier;
  isSatisfied: (input: AutomationReleaseInput) => boolean;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * The ordered condition table. `dry_run` conditions gate the move from
 * `blocked` → `ready_for_dry_run`; all conditions together gate the move to
 * `controlled_live_authorized`. Order here is the order used in `missing`.
 */
export const AUTOMATION_CONDITIONS: readonly ConditionSpec[] = [
  {
    key: 'workspaceIdentified',
    label: 'identified workspace',
    tier: 'dry_run',
    isSatisfied: (i) => isNonEmptyString(i.workspaceId),
  },
  {
    key: 'actionTyped',
    label: 'action type',
    tier: 'dry_run',
    isSatisfied: (i) => isNonEmptyString(i.actionType),
  },
  {
    key: 'consentGranted',
    label: 'consent granted',
    tier: 'dry_run',
    isSatisfied: (i) => i.consentStatus === 'granted',
  },
  {
    key: 'humanApproval',
    label: 'approved human review',
    tier: 'dry_run',
    isSatisfied: (i) => i.approvalStatus === 'approved',
  },
  {
    key: 'connectorApproved',
    label: 'connector approval',
    tier: 'controlled_live',
    isSatisfied: (i) => i.connectorApproval === 'approved',
  },
  {
    key: 'secretsReady',
    label: 'secrets ready',
    tier: 'controlled_live',
    isSatisfied: (i) => i.secretsStatus === 'ready',
  },
  {
    key: 'rateLimitHealthy',
    label: 'rate limit healthy',
    tier: 'controlled_live',
    isSatisfied: (i) => i.rateLimitStatus === 'ok',
  },
  {
    key: 'monitoringActive',
    label: 'monitoring active',
    tier: 'controlled_live',
    isSatisfied: (i) => i.monitoringStatus === 'active',
  },
  {
    key: 'rollbackReady',
    label: 'rollback ready',
    tier: 'controlled_live',
    isSatisfied: (i) => i.rollbackStatus === 'ready',
  },
  {
    key: 'founderSignoff',
    label: 'founder signoff',
    tier: 'controlled_live',
    isSatisfied: (i) => i.founderSignoff === true,
  },
  {
    key: 'legalSignoff',
    label: 'legal signoff',
    tier: 'controlled_live',
    isSatisfied: (i) => i.legalSignoff === true,
  },
  {
    key: 'clientSignoff',
    label: 'client signoff',
    tier: 'controlled_live',
    isSatisfied: (i) => i.clientSignoff === true,
  },
] as const;

/** Human label given when the kill switch forces a block. */
export const KILL_SWITCH_REASON = 'kill switch engaged';

export interface AutomationReleaseDecision {
  decision: AutomationDecision;
  /** Echoed identity (null when unidentified). */
  workspaceId: string | null;
  actionType: string | null;
  /** True iff the kill switch was engaged (it overrides everything). */
  killSwitchEngaged: boolean;
  /**
   * Human labels of what is still missing to advance to the NEXT gate:
   *  - `blocked`            => what is missing to reach `ready_for_dry_run`
   *  - `ready_for_dry_run`  => what is missing to reach `controlled_live_authorized`
   *  - `controlled_live_authorized` => `[]`
   * When the kill switch is engaged this is exactly `[KILL_SWITCH_REASON]`.
   */
  missing: string[];
  /** Condition keys backing `missing` (empty for the kill-switch override). */
  missingKeys: AutomationConditionKey[];
  /** Condition keys that ARE satisfied (independent of the kill switch). */
  satisfied: AutomationConditionKey[];
  reason: string;
}

/**
 * Pure evaluation of the automation release gate. Fails closed.
 *
 * Precedence:
 *  1. Kill switch engaged => `blocked` (overrides everything).
 *  2. Any `dry_run` condition missing => `blocked`.
 *  3. All `dry_run` met but some `controlled_live` missing => `ready_for_dry_run`.
 *  4. All conditions met => `controlled_live_authorized`.
 */
export function evaluateAutomationReleaseGate(
  input: AutomationReleaseInput = {},
): AutomationReleaseDecision {
  const workspaceId = isNonEmptyString(input.workspaceId) ? input.workspaceId.trim() : null;
  const actionType = isNonEmptyString(input.actionType) ? input.actionType.trim() : null;
  const killSwitchEngaged = input.killSwitch === true;

  const satisfied: AutomationConditionKey[] = [];
  const dryRunMissing: ConditionSpec[] = [];
  const liveMissing: ConditionSpec[] = [];
  for (const condition of AUTOMATION_CONDITIONS) {
    if (condition.isSatisfied(input)) {
      satisfied.push(condition.key);
    } else if (condition.tier === 'dry_run') {
      dryRunMissing.push(condition);
    } else {
      liveMissing.push(condition);
    }
  }

  // 1. Kill switch overrides everything — including a fully-signed-off input.
  if (killSwitchEngaged) {
    return {
      decision: 'blocked',
      workspaceId,
      actionType,
      killSwitchEngaged: true,
      missing: [KILL_SWITCH_REASON],
      missingKeys: [],
      satisfied,
      reason: 'blocked: kill switch engaged — overrides all other conditions',
    };
  }

  // 2. Missing any dry-run prerequisite fails closed to blocked.
  if (dryRunMissing.length > 0) {
    const missing = dryRunMissing.map((c) => c.label);
    return {
      decision: 'blocked',
      workspaceId,
      actionType,
      killSwitchEngaged: false,
      missing,
      missingKeys: dryRunMissing.map((c) => c.key),
      satisfied,
      reason: `blocked: missing ${missing.join(', ')}`,
    };
  }

  // 3. Dry-run prerequisites met, but live conditions outstanding. Human review
  //    alone can only land here — never controlled-live — because the live set
  //    requires the additional connector/secrets/limits/monitoring/rollback +
  //    founder/legal/client signoffs below.
  if (liveMissing.length > 0) {
    const missing = liveMissing.map((c) => c.label);
    return {
      decision: 'ready_for_dry_run',
      workspaceId,
      actionType,
      killSwitchEngaged: false,
      missing,
      missingKeys: liveMissing.map((c) => c.key),
      satisfied,
      reason: `ready_for_dry_run: dry-run conditions met; missing for live: ${missing.join(', ')}`,
    };
  }

  // 4. Everything satisfied.
  return {
    decision: 'controlled_live_authorized',
    workspaceId,
    actionType,
    killSwitchEngaged: false,
    missing: [],
    missingKeys: [],
    satisfied,
    reason: 'controlled_live_authorized: all conditions satisfied',
  };
}

/** Returns the condition keys required to reach a target decision. */
export function requiredConditionsFor(
  target: Exclude<AutomationDecision, 'blocked'>,
): AutomationConditionKey[] {
  if (target === 'ready_for_dry_run') {
    return AUTOMATION_CONDITIONS.filter((c) => c.tier === 'dry_run').map((c) => c.key);
  }
  return AUTOMATION_CONDITIONS.map((c) => c.key);
}
