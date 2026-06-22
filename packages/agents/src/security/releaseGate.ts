/**
 * Mock-safe enterprise-readiness primitive: LOCAL live release gates.
 *
 * STATUS: MOCK / SANDBOX. This is a pure, deterministic gate used to model the
 * conditions that MUST hold before any progression toward a live release. It
 * does NOT perform a release, does NOT touch secrets, connectors, or the
 * network, and issues NO production-readiness claim. It is a decision function
 * only. Actually performing a controlled-live release remains PLANNED and is
 * blocked until legal, customer, and founder signoff land out-of-band.
 *
 * Fail-closed: the live stage requires ALL conditions to be true. Default or
 * empty conditions => the live stage FAILS CLOSED.
 */

/** Ordered release stages, from safest to most exposed. */
export const RELEASE_STAGES = [
  'dry_run',
  'private_pilot',
  'controlled_live',
] as const;

export type ReleaseStage = (typeof RELEASE_STAGES)[number];

/**
 * The conditions a release stage may require. Every field defaults to `false`
 * (absent => not satisfied) so unknown/partial state fails closed.
 *
 * These are SANDBOX booleans only — asserting one true here does NOT make it
 * true in the real world; it models that an out-of-band attestation exists.
 */
export interface ReleaseConditions {
  /** Customer has signed the scope of what may be acted on. */
  signedCustomerScope?: boolean;
  /** Legal counsel has signed off on going live. */
  counselSignoff?: boolean;
  /** Founder has signed off on going live. */
  founderSignoff?: boolean;
  /** Live monitoring / alerting is enabled. */
  monitoringEnabled?: boolean;
  /** A tested rollback path is ready. */
  rollbackReady?: boolean;
  /** Required secrets are configured (SANDBOX flag; no secret is read here). */
  secretsConfigured?: boolean;
  /** The live connector has explicit approval. */
  connectorApproval?: boolean;
}

/** The condition keys, in display order, with human labels. */
export const CONDITION_LABELS: Readonly<Record<keyof ReleaseConditions, string>> = {
  signedCustomerScope: 'signed customer scope',
  counselSignoff: 'counsel signoff',
  founderSignoff: 'founder signoff',
  monitoringEnabled: 'monitoring enabled',
  rollbackReady: 'rollback ready',
  secretsConfigured: 'secrets configured',
  connectorApproval: 'connector approval',
};

/**
 * Conditions required per stage. `dry_run` requires nothing (it cannot act on
 * the real world). `private_pilot` requires monitoring + rollback. The live
 * stage requires the full set.
 */
const STAGE_REQUIREMENTS: Readonly<
  Record<ReleaseStage, ReadonlyArray<keyof ReleaseConditions>>
> = {
  dry_run: [],
  private_pilot: ['monitoringEnabled', 'rollbackReady'],
  controlled_live: [
    'signedCustomerScope',
    'counselSignoff',
    'founderSignoff',
    'monitoringEnabled',
    'rollbackReady',
    'secretsConfigured',
    'connectorApproval',
  ],
};

export interface ReleaseGateResult {
  stage: ReleaseStage;
  /** True only if every required condition for the stage is satisfied. */
  passed: boolean;
  /** Human labels of the required conditions that were missing/false. */
  missing: string[];
  /** Required condition keys that were missing/false. */
  missingKeys: Array<keyof ReleaseConditions>;
  reason: string;
}

function isReleaseStage(value: string): value is ReleaseStage {
  return (RELEASE_STAGES as readonly string[]).includes(value);
}

/**
 * Pure evaluation of a release gate. Fails closed:
 * - An unknown stage fails.
 * - The live stage with default/empty conditions fails (all 7 required).
 * - Any single missing required condition fails the stage.
 */
export function evaluateReleaseGate(
  stage: string,
  conditions: ReleaseConditions = {},
): ReleaseGateResult {
  if (!isReleaseStage(stage)) {
    return {
      // Surface the unknown input but keep the typed shape; treat as failed.
      stage: 'controlled_live',
      passed: false,
      missing: [`unknown stage "${stage}"`],
      missingKeys: [],
      reason: `unknown release stage "${stage}" — failing closed`,
    };
  }

  const required = STAGE_REQUIREMENTS[stage];
  const missingKeys = required.filter((key) => conditions[key] !== true);
  const missing = missingKeys.map((key) => CONDITION_LABELS[key]);
  const passed = missingKeys.length === 0;

  return {
    stage,
    passed,
    missing,
    missingKeys,
    reason: passed
      ? `release stage "${stage}" conditions satisfied`
      : `release stage "${stage}" blocked: missing ${missing.join(', ')}`,
  };
}

/** Returns the required condition keys for a stage (empty for unknown). */
export function requiredConditions(
  stage: string,
): ReadonlyArray<keyof ReleaseConditions> {
  if (!isReleaseStage(stage)) return [];
  return STAGE_REQUIREMENTS[stage];
}
