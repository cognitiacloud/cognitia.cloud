import type { ActionProvenance } from '@cognitia/core';

/**
 * GOV-1 — typed CRM write plans. One pure module computes the EXACT property
 * map a HubSpot write will carry, and both consumers use it:
 *
 *   - the execution path (`HttpHubspotClient.upsertEngagement`) assembles the
 *     request body with `assembleEngagementProperties`, and
 *   - the preview path (`ActionLedger.previewExecution` → GET
 *     /agent-actions/:id/preview) returns `buildHubspotWritePlan(...)`.
 *
 * Because assembly is shared, the preview cannot drift from the write — and a
 * CI test pins the invariant by capturing a real request body and asserting
 * byte-equality with the plan. Determinism rule: every property derives from
 * the action row (timestamps from `created_at`, never `now()`), so the same
 * action always yields the same plan. No raw PII may ever enter a plan.
 */

/** Minimal structural slice of an agent action the planner needs. */
export interface PlannableAction {
  action_type: string;
  target_ref: string;
  idempotency_key: string;
  agent_run_id: string;
  evidence_refs: string[];
  created_at: string;
}

export interface CrmWritePlan {
  system: 'hubspot';
  object: 'tasks' | 'notes';
  operation: 'create';
  target_ref: string;
  idempotency_key: string;
  /** The custom property the idempotency key is stored under. */
  idempotency_property: string;
  /** The exact property map the write request will carry. */
  properties: Record<string, string | number>;
}

export const DEFAULT_IDEMPOTENCY_PROPERTY = 'cognitia_idempotency_key';

/**
 * Namespaced HubSpot custom properties carrying execution lineage (PROV-1).
 * These must exist on Tasks and Notes in the portal (see hubspot-onboarding.md);
 * missing properties cause HubSpot to reject the write, so onboarding documents
 * them as required. Keep this list and the runbook in sync.
 */
export const PROVENANCE_PROPERTIES = {
  agent: 'cognitia_agent',
  agentRunId: 'cognitia_agent_run_id',
  agentActionId: 'cognitia_agent_action_id',
  evidenceCount: 'cognitia_evidence_count',
  riskLevel: 'cognitia_risk_level',
  approvedBy: 'cognitia_approved_by',
} as const;

/**
 * RDY-1 — the custom properties every engagement write requires. A write to a
 * property that doesn't exist in the portal is rejected by HubSpot, so the
 * connection-readiness gate verifies all of these exist on Tasks and Notes
 * before the first live action. Content properties (`hs_task_subject` etc.)
 * are standard HubSpot fields and never need creating, so they're excluded.
 */
export const REQUIRED_ENGAGEMENT_PROPERTIES: readonly string[] = [
  DEFAULT_IDEMPOTENCY_PROPERTY,
  ...Object.values(PROVENANCE_PROPERTIES),
];

/** Map a provenance object to HubSpot property values (refs/roles only, no PII). */
export function provenanceProperties(
  p: ActionProvenance | undefined,
): Record<string, string | number> {
  if (!p) return {};
  const props: Record<string, string | number> = {
    [PROVENANCE_PROPERTIES.agent]: p.agent,
    [PROVENANCE_PROPERTIES.agentRunId]: p.agent_run_id,
    [PROVENANCE_PROPERTIES.agentActionId]: p.agent_action_id,
    [PROVENANCE_PROPERTIES.evidenceCount]: p.evidence_count,
    [PROVENANCE_PROPERTIES.riskLevel]: p.risk_level,
  };
  if (p.approved_by) props[PROVENANCE_PROPERTIES.approvedBy] = p.approved_by;
  return props;
}

/**
 * Typed human-readable content for the engagement. Derived ONLY from the
 * action row, so what the operator previews at approval time is exactly what
 * executes later. `hs_timestamp` is required by HubSpot on engagements; it is
 * pinned to the proposal time (`created_at`) to stay deterministic.
 */
export function engagementContent(action: PlannableAction): Record<string, string | number> {
  const body = [
    `Proposed by Cognitia agent run ${action.agent_run_id}.`,
    `Target: ${action.target_ref}.`,
    action.evidence_refs.length > 0
      ? `Evidence (${action.evidence_refs.length}): ${action.evidence_refs.join(', ')}.`
      : 'Evidence: none recorded.',
    'Lineage is stamped in the cognitia_* properties on this record.',
  ].join('\n');
  const ts = Date.parse(action.created_at);
  if (action.action_type === 'crm.note.create') {
    return { hs_note_body: body, hs_timestamp: ts };
  }
  return {
    hs_task_subject: `Cognitia follow-up: ${action.target_ref}`,
    hs_task_body: body,
    hs_task_status: 'NOT_STARTED',
    hs_timestamp: ts,
  };
}

/** Inputs needed to assemble the final property map for an engagement write. */
export interface EngagementWrite {
  idempotencyKey: string;
  payload: Record<string, unknown>;
  provenance?: ActionProvenance;
}

/**
 * The single assembly point for engagement write properties: typed content +
 * idempotency property + provenance lineage. The HTTP client and the plan
 * builder both call this — that sharing is what makes previews trustworthy.
 */
export function assembleEngagementProperties(
  write: EngagementWrite,
  idempotencyProperty: string = DEFAULT_IDEMPOTENCY_PROPERTY,
): Record<string, unknown> {
  return {
    ...write.payload,
    [idempotencyProperty]: write.idempotencyKey,
    ...provenanceProperties(write.provenance),
  };
}

/** Build the full typed plan for an action (preview + execution contract). */
export function buildHubspotWritePlan(
  action: PlannableAction,
  provenance?: ActionProvenance,
  opts: { idempotencyProperty?: string } = {},
): CrmWritePlan {
  const idemProp = opts.idempotencyProperty ?? DEFAULT_IDEMPOTENCY_PROPERTY;
  return {
    system: 'hubspot',
    object: action.action_type === 'crm.note.create' ? 'notes' : 'tasks',
    operation: 'create',
    target_ref: action.target_ref,
    idempotency_key: action.idempotency_key,
    idempotency_property: idemProp,
    properties: assembleEngagementProperties(
      {
        idempotencyKey: action.idempotency_key,
        payload: engagementContent(action),
        provenance,
      },
      idemProp,
    ) as Record<string, string | number>,
  };
}
