import type { Repository } from '@cognitia/db';
import type { AdapterRegistry } from '@cognitia/integrations';
import { PROVENANCE_PROPERTIES, DEFAULT_IDEMPOTENCY_PROPERTY } from '@cognitia/integrations';
import { runGoldenEval, type GoldenEvalSummary } from '@cognitia/evals';
import { computeTrustMetrics, type TrustMetrics } from './trustMetrics.js';
import { computeScorecards, type ScorecardReport } from './scorecards.js';
import { buildGovernanceMatrix, type GovernanceMatrix } from './governance.js';

/**
 * TRUST-2 — the exportable trust packet: one tenant-scoped JSON artifact a
 * procurement/security reviewer, admin, or design-partner champion can read
 * without API access. Three rules keep it honest:
 *
 *  1. Every number is derived live from the ledger/labels at export time —
 *     never cached, never hand-entered.
 *  2. Every claimed control cites the CI-enforced test file that proves it
 *     (a test asserts those files exist, so pointers cannot go stale).
 *  3. The eval gate is RE-RUN at export time and its live result embedded —
 *     "the gate was green when this packet was generated" is a fact in the
 *     artifact, not a slide claim.
 *
 * No PII: decisions/audits carry refs, roles, hashes, and reason codes only.
 */

export interface ControlAttestation {
  control: string;
  description: string;
  /** Repo-relative test file(s) that enforce this control in CI. */
  enforced_by: string[];
}

export interface TrustPacket {
  packet_version: 'trust-packet-v1';
  generated_at: string;
  scope: { tenant_id: string; note: string };
  metrics: TrustMetrics;
  /** LEARN-1: per-segment governance scorecards (action_type × risk). */
  scorecards: ScorecardReport;
  decisions: Array<{
    subject_ref: string;
    label: string;
    reason_code: string;
    note: string | null;
    approver_ref: string;
    action_type: string;
    risk_level: string;
    target_ref: string;
    created_at: string;
  }>;
  audit_trail: Array<{
    actor_ref: string;
    action: string;
    subject_ref: string;
    detail: Record<string, unknown>;
    created_at: string;
  }>;
  write_contract: {
    description: string;
    idempotency_property: string;
    provenance_properties: string[];
    content_properties: string[];
  };
  controls: ControlAttestation[];
  /** ENF-1: the code-derived governance matrix at export time. */
  governance: GovernanceMatrix;
  /** ENF-1: connection + kill-switch state at export time. */
  integration: {
    system: string;
    status: string;
    kill_switch_enforced: boolean;
    halted: boolean;
  };
  eval_gate: {
    description: string;
    run_at_export: GoldenEvalSummary;
  };
}

/** The control → CI-evidence map. Paths are repo-relative; a test pins their existence. */
export const CONTROL_ATTESTATIONS: ControlAttestation[] = [
  {
    control: 'human_approval_per_action',
    description:
      'No side effect executes without an explicit, ledgered human approval; unapproved execution attempts are refused (409) and audited.',
    enforced_by: ['apps/api/src/fence.test.ts', 'apps/api/src/previewAction.test.ts'],
  },
  {
    control: 'mandatory_decision_reasons',
    description:
      'Every approve/reject/rollback requires a closed-enum reason code, persisted as a training label.',
    enforced_by: ['apps/api/src/decisionReasons.test.ts', 'apps/api/src/rollback.test.ts'],
  },
  {
    control: 'preview_equals_write',
    description:
      'The operator-visible write preview is byte-identical to the executed CRM request body (single shared assembly).',
    enforced_by: ['packages/integrations/src/hubspot/writePlan.test.ts'],
  },
  {
    control: 'idempotent_writes',
    description:
      'Duplicate executions collapse on an idempotency key at both the ledger and the CRM client.',
    enforced_by: ['apps/api/src/crmExecute.test.ts'],
  },
  {
    control: 'write_provenance',
    description:
      'Every CRM object Cognitia creates is stamped with agent/run/action/approver lineage inside the customer CRM.',
    enforced_by: ['apps/api/src/provenance.test.ts'],
  },
  {
    control: 'typed_rollback',
    description:
      'Executed writes can be undone (reversible CRM archive) with the same label/event/audit accountability as execution; refusals are audited.',
    enforced_by: [
      'apps/api/src/rollback.test.ts',
      'packages/integrations/src/hubspot/rollback.test.ts',
    ],
  },
  {
    control: 'zero_write_preflight',
    description:
      'The real agent runtime can be simulated over a copy of tenant data with zero writes (proven: 0 actions/events/audits after preflight).',
    enforced_by: ['apps/api/src/preflight.test.ts'],
  },
  {
    control: 'channel_scope_fence',
    description:
      'V1 executes CRM tasks/notes only; email/voice/ads surfaces are disabled in the production composition.',
    enforced_by: ['apps/api/src/fence.test.ts', 'packages/evals/src/golden.test.ts'],
  },
  {
    control: 'tenant_kill_switch',
    description:
      "Any non-'active' integration connection status halts execution AND rollback for the tenant without redeploy; halts are refused (409) and audited as denials. Any operator may pause; only the owner may resume.",
    enforced_by: ['apps/api/src/killSwitch.test.ts'],
  },
  {
    control: 'tenant_isolation',
    description: 'Row-level security plus tenant-scoped repositories; proven against Postgres.',
    enforced_by: ['packages/db/src/kysely.rls.pglite.test.ts'],
  },
  {
    control: 'eval_gate_in_ci',
    description:
      'A golden dataset runs the real runtime in CI; any regression in fence/suppression/targeting/idempotency/evidence fails the build.',
    enforced_by: ['packages/evals/src/golden.test.ts'],
  },
  {
    control: 'connection_readiness_gate',
    description:
      'Before the first live write, an automated read-only gate verifies the CRM portal is correctly configured (connection active; every required idempotency/provenance property present on Tasks and Notes) and names exactly what is missing.',
    enforced_by: [
      'packages/integrations/src/hubspot/readiness.test.ts',
      'apps/api/src/integrationReadiness.test.ts',
    ],
  },
  {
    control: 'per_segment_scorecards',
    description:
      'Governance performance is reported per segment (action type × risk tier) — approval rate, reason mixes, decision latency, rollbacks — derived live from the ledger; each segment carries a conservative, read-only earned-autonomy indicator (V1 grants no autonomy).',
    enforced_by: ['apps/api/src/scorecards.test.ts'],
  },
  {
    control: 'decision_rationale_visibility',
    description:
      'Before approving, the operator can see the deterministic rationale for each action — the fit/timing score, the grounding CRM facts (the same canonical evidence the agent used), and data freshness with a warning when the CRM record changed after the proposal.',
    enforced_by: ['apps/api/src/rationale.test.ts'],
  },
  {
    control: 'full_lifecycle_acceptance',
    description:
      'One CI-enforced test runs the entire governed loop — readiness, zero-write preflight, propose, preview/write parity, audited pre-approval denial, reasoned approval, idempotent provenance-stamped execution, kill-switch halt, owner-only resume, accountable undo, rejection-to-regression export — and asserts the complete audit census and trust-packet consistency.',
    enforced_by: ['apps/api/src/lifecycle.acceptance.test.ts'],
  },
];

export async function buildTrustPacket(
  repo: Repository,
  tenantId: string,
  adapters: AdapterRegistry,
): Promise<TrustPacket> {
  const [actions, labels, audits, conn] = await Promise.all([
    repo.listAgentActions(tenantId),
    repo.listFeedbackLabels(tenantId),
    repo.listAuditEvents(tenantId),
    repo.getIntegrationConnection(tenantId, 'hubspot'),
  ]);
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');

  return {
    packet_version: 'trust-packet-v1',
    generated_at: new Date().toISOString(),
    scope: {
      tenant_id: tenantId,
      note: 'All figures derived live from the action ledger, decision labels, and audit trail at generation time. No PII: refs, roles, hashes, and reason codes only.',
    },
    metrics: computeTrustMetrics(actions, labels),
    scorecards: computeScorecards(actions, labels),
    decisions: labels.map((l) => ({
      subject_ref: l.subject_ref,
      label: l.label,
      reason_code: str(l.detail['reason_code']),
      note: typeof l.detail['note'] === 'string' ? (l.detail['note'] as string) : null,
      approver_ref: str(l.detail['approver_ref']),
      action_type: str(l.detail['action_type']),
      risk_level: str(l.detail['risk_level']),
      target_ref: str(l.detail['target_ref']),
      created_at: l.created_at,
    })),
    audit_trail: audits.map((a) => ({
      actor_ref: a.actor_ref,
      action: a.action,
      subject_ref: a.subject_ref,
      detail: a.detail,
      created_at: a.created_at,
    })),
    write_contract: {
      description:
        'Every CRM write carries typed content, an idempotency key, and execution lineage as namespaced properties inside the customer CRM. The exact property map is previewable per action before approval.',
      idempotency_property: DEFAULT_IDEMPOTENCY_PROPERTY,
      provenance_properties: Object.values(PROVENANCE_PROPERTIES),
      content_properties: [
        'hs_task_subject',
        'hs_task_body',
        'hs_task_status',
        'hs_note_body',
        'hs_timestamp',
      ],
    },
    controls: CONTROL_ATTESTATIONS,
    governance: buildGovernanceMatrix(adapters),
    integration: {
      system: 'hubspot',
      status: conn?.status ?? 'not_connected',
      kill_switch_enforced: true,
      halted: conn !== null && conn.status !== 'active',
    },
    eval_gate: {
      description:
        'The golden-dataset gate (same one CI enforces) re-run at packet generation time against the real agent runtime.',
      run_at_export: await runGoldenEval(),
    },
  };
}
