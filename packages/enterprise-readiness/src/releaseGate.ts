/**
 * Release-gate evidence requirements (mock-safe, dependency-free).
 *
 * A release gate is a fail-closed checklist of evidence. Promotion to any
 * higher-trust stage (especially anything that would turn a connector live) is
 * BLOCKED unless every required piece of evidence is present and PASSING.
 * Missing or unknown evidence is treated as a failure, never as a pass.
 */

/** Stages a change can be promoted through. `live` is never reachable in mock-safe. */
export const RELEASE_STAGES = ['dev', 'mock-staging', 'pilot-dark', 'live'] as const;
export type ReleaseStage = (typeof RELEASE_STAGES)[number];

/** A single evidence requirement the gate enforces. */
export interface EvidenceRequirement {
  readonly id: string;
  readonly description: string;
  /** Stages at which this evidence becomes mandatory. */
  readonly requiredFrom: ReleaseStage;
  /** If true, only a human (founder/legal) can satisfy it — never automation. */
  readonly humanAttested?: boolean;
}

export const EVIDENCE_REQUIREMENTS: readonly EvidenceRequirement[] = [
  { id: 'typecheck', description: 'pnpm check / tsc passes', requiredFrom: 'mock-staging' },
  { id: 'unit_tests', description: 'unit + guard tests pass', requiredFrom: 'mock-staging' },
  { id: 'safety_scan', description: 'safety scan: no live egress, no secrets', requiredFrom: 'mock-staging' },
  { id: 'mock_safe_proof', description: 'dry-run actions assert sent:false', requiredFrom: 'mock-staging' },
  { id: 'audit_schema_conformance', description: 'emitted events validate + carry no raw PII', requiredFrom: 'mock-staging' },
  { id: 'rollback_rehearsed', description: 'rollback runbook executed in mock-staging', requiredFrom: 'pilot-dark' },
  { id: 'monitoring_active', description: 'monitoring rules deployed and firing on synthetic events', requiredFrom: 'pilot-dark' },
  { id: 'founder_approval', description: 'founder approval checklist signed', requiredFrom: 'pilot-dark', humanAttested: true },
  { id: 'legal_client_approval', description: 'legal + client approval checklist signed', requiredFrom: 'live', humanAttested: true },
  { id: 'connector_dark_mode_review', description: 'dark-mode policy review for every connector going live', requiredFrom: 'live', humanAttested: true },
];

export type EvidenceState = 'pass' | 'fail' | 'unknown';

export interface EvidenceItem {
  readonly id: string;
  readonly state: EvidenceState;
  readonly ref?: string; // pointer to the proof (CI run, doc, signature ref)
}

export type GateDecision =
  | { readonly promote: true; readonly stage: ReleaseStage }
  | { readonly promote: false; readonly stage: ReleaseStage; readonly blockers: readonly string[] };

const STAGE_ORDER: Record<ReleaseStage, number> = {
  dev: 0,
  'mock-staging': 1,
  'pilot-dark': 2,
  live: 3,
};

/** Requirements that are mandatory at or below the target stage. */
export function requirementsFor(stage: ReleaseStage): readonly EvidenceRequirement[] {
  return EVIDENCE_REQUIREMENTS.filter(
    (r) => STAGE_ORDER[r.requiredFrom] <= STAGE_ORDER[stage],
  );
}

/**
 * Evaluate a promotion to `targetStage`. Fail-closed:
 *   - any required evidence missing → blocked;
 *   - any required evidence 'unknown' or 'fail' → blocked;
 *   - promotion to 'live' is ALWAYS blocked while mock-safe is on, regardless of
 *     evidence, because going live requires explicit founder+legal sign-off that
 *     this automated gate must never grant on its own.
 */
export function evaluateReleaseGate(
  targetStage: ReleaseStage,
  evidence: readonly EvidenceItem[],
  opts?: { mockSafe?: boolean },
): GateDecision {
  const mockSafe = opts?.mockSafe ?? true;
  const blockers: string[] = [];
  const byId = new Map(evidence.map((e) => [e.id, e]));

  for (const req of requirementsFor(targetStage)) {
    const item = byId.get(req.id);
    if (!item) {
      blockers.push(`missing_evidence:${req.id}`);
      continue;
    }
    if (item.state !== 'pass') {
      blockers.push(`evidence_not_passing:${req.id}:${item.state}`);
    }
  }

  if (targetStage === 'live' && mockSafe) {
    blockers.push('live_promotion_blocked_in_mock_safe');
  }

  return blockers.length === 0
    ? { promote: true, stage: targetStage }
    : { promote: false, stage: targetStage, blockers };
}
