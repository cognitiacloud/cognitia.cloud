import { createHash, randomUUID } from 'node:crypto';
import type { Repository, LeadIntakeRow, AgentActionRow } from '@cognitia/db';
import type { GtmServices } from '@cognitia/agents';
import { z } from 'zod';
import { encryptPii, decryptPii, hashPhone, maskPhone } from './frontdesk/pii.js';

/**
 * MoverOS AI Front Desk (COG-006, Lane A). Doctrine (Architecture Lock §6, §8):
 *   - SMS-first lead rescue, SIMULATION-FIRST: no real SMS exists in v1.1 —
 *     there is no provider integration and `sms.send_real` is deny-by-default
 *     and owner-gated; the execute path refuses non-simulated sends outright;
 *   - raw customer PII is encrypted and confined to lead_intakes; hashes and
 *     masks everywhere else; purge supported (PIPEDA / BC PIPA);
 *   - drafts ride the platform's EXISTING approval lifecycle (ledger
 *     approve/reject, approval console) — no parallel queue;
 *   - an executed (simulated) send produces exactly one Proof Registry row
 *     (kind lead_response, verified_fact — the simulation record IS the
 *     evidence) and exactly one front-desk audit row, with response time.
 *
 * `sms.reply.send` is intentionally NOT added to the core `actionType` enum:
 * that enum feeds the CRM adapter registry and governance matrix. Front-desk
 * actions are created via the repository (the column is free text) and only
 * this module's simulated path can execute them — `ledger.execute` would
 * refuse them anyway (no adapter), which is the desired failsafe.
 */

const FRONT_DESK_AGENT = 'frontdesk';
export const SMS_REPLY_ACTION = 'sms.reply.send';

const leadIngestBody = z.object({
  source: z.enum(['sms_sim', 'web', 'manual']), // sms_real is not ingestable in v1.1
  contact_name: z.string().min(1).max(200).optional(),
  contact_phone: z.string().min(7).max(32),
  message_body: z.string().min(1).max(2000),
  consent_captured: z.boolean().default(false),
  received_at: z.string().datetime({ offset: true }).optional(),
});

/** Operator list view: masked — no raw PII leaves the detail endpoint. */
export interface MaskedLead {
  id: string;
  source: string;
  phone_masked: string;
  received_at: string;
  consent_captured: boolean;
  pii_status: string;
  status: string;
}

export function toMaskedLead(row: LeadIntakeRow, phoneForMask?: string): MaskedLead {
  // Decrypt in-memory solely to derive the 2-digit display mask; the
  // decrypted value never leaves this function on the list path.
  const phone =
    phoneForMask ?? (row.contact_phone_enc ? decryptPii(row.contact_phone_enc) : undefined);
  return {
    id: row.id,
    source: row.source,
    phone_masked: phone ? maskPhone(phone) : '•••',
    received_at: row.received_at,
    consent_captured: row.consent_captured,
    pii_status: row.pii_status,
    status: row.status,
  };
}

export async function ingestLead(
  repo: Repository,
  tenantId: string,
  body: unknown,
  actorRef: string,
  traceId: string,
): Promise<{ lead: MaskedLead }> {
  const input = leadIngestBody.parse(body ?? {});
  const ts = new Date().toISOString();
  const row: LeadIntakeRow = {
    id: randomUUID(),
    tenant_id: tenantId,
    lead_id: null,
    source: input.source,
    channel_ref: null,
    contact_name_enc: input.contact_name ? encryptPii(input.contact_name) : null,
    contact_phone_enc: encryptPii(input.contact_phone),
    contact_phone_hash: hashPhone(input.contact_phone),
    message_body_enc: encryptPii(input.message_body),
    received_at: input.received_at ?? ts,
    consent_captured: input.consent_captured,
    pii_status: 'raw',
    status: 'needs_response',
    created_at: ts,
    updated_at: ts,
  };
  await repo.insertLeadIntake(row);
  // Event payload carries refs/metadata ONLY — never lead content.
  await repo.insertEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    event_name: 'lead.intake.received.v1',
    entity_type: 'lead_intake',
    entity_id: row.id,
    source: 'api',
    occurred_at: ts,
    ingested_at: ts,
    payload: { source: input.source, consent_captured: input.consent_captured },
    trace_id: traceId,
    created_at: ts,
  });
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'lead.intake.received.v1',
    subject_ref: `lead_intake:${row.id}`,
    detail: { source: input.source },
    occurred_at: ts,
    created_at: ts,
  });
  return { lead: toMaskedLead(row, input.contact_phone) };
}

/** Operator detail: decrypted content (mutating roles only at the handler). */
export function toLeadDetail(row: LeadIntakeRow): {
  lead: MaskedLead & { contact_name: string | null; message_body: string | null };
} {
  const phone = row.contact_phone_enc ? decryptPii(row.contact_phone_enc) : undefined;
  return {
    lead: {
      ...toMaskedLead(row, phone),
      contact_name: row.contact_name_enc ? decryptPii(row.contact_name_enc) : null,
      message_body: row.message_body_enc ? decryptPii(row.message_body_enc) : null,
    },
  };
}

/**
 * Draft an AI front-desk reply (deterministic template in v1.1 — clearly a
 * simulation; an LLM drafter slots in behind the same interface later) and
 * propose it into the EXISTING approval lifecycle.
 */
export async function draftReply(
  repo: Repository,
  services: GtmServices,
  tenantId: string,
  leadId: string,
  traceId: string,
): Promise<{ action: AgentActionRow; draft_body: string }> {
  const lead = await repo.getLeadIntake(tenantId, leadId);
  if (!lead) throw new LeadNotFoundError(leadId);
  if (lead.pii_status === 'purged') throw new LeadPurgedError(leadId);

  const firstName = lead.contact_name_enc
    ? decryptPii(lead.contact_name_enc).split(/\s+/)[0]
    : 'there';
  const draftBody =
    `Hi ${firstName}! Thanks for reaching out about your move. ` +
    `We'd love to help — what date are you planning, and what size is the move? ` +
    `We can usually hold a crew with 24h notice. — MoverOS Front Desk (simulated)`;

  const ts = new Date().toISOString();
  const run = await repo.createAgentRun({
    id: randomUUID(),
    tenant_id: tenantId,
    agent: FRONT_DESK_AGENT,
    objective: 'rescue inbound lead with a fast SMS reply (simulation)',
    input_refs: [`lead_intake:${leadId}`],
    status: 'completed',
    trace_id: traceId,
    created_at: ts,
    updated_at: ts,
  });

  const draftRef = `draft:frontdesk:${randomUUID()}`;
  await services.draftStore.put(draftRef, {
    subject_line: 'SMS reply (simulated)',
    body: draftBody,
    evidence_refs: [`lead_intake:${leadId}`],
  });

  const fingerprint = createHash('sha256').update(draftBody).digest('hex');
  const action = await repo.createAgentAction({
    id: randomUUID(),
    tenant_id: tenantId,
    agent_run_id: run.id,
    action_type: SMS_REPLY_ACTION,
    risk_level: 'high', // outbound customer contact is always high risk
    idempotency_key: `frontdesk:${leadId}:${fingerprint}`,
    approval_status: 'proposed',
    execution_status: 'pending',
    target_ref: `lead_intake:${leadId}`,
    evidence_refs: [`lead_intake:${leadId}`],
    payload_ref: draftRef,
    guardrail_results: [{ name: 'simulation_only', passed: true }],
    result: null,
    simulation: true, // explicit on both repo impls (PG trigger also defaults it)
    proof_id: null,
    created_at: ts,
    updated_at: ts,
  });

  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: `agent:${FRONT_DESK_AGENT}`,
    action: 'frontdesk.reply.drafted.v1',
    subject_ref: `agent_action:${action.id}`,
    detail: { lead_intake_id: leadId },
    occurred_at: ts,
    created_at: ts,
  });
  await repo.updateLeadIntakeStatus(tenantId, leadId, 'human_review_required');
  return { action, draft_body: draftBody };
}

// ---------------------------------------------------------------------------
// Mission Pack B: general lead actions, outcomes, summary
// ---------------------------------------------------------------------------

/** The front-desk action vocabulary. sms-backed actions are simulation-first. */
export const LEAD_ACTION_KEYS = [
  'qualify_lead',
  'request_missing_move_details',
  'estimate_urgency',
  'propose_sms_reply',
  'schedule_callback',
  'create_booking_intent',
  'handoff_to_human',
  'mark_rescued',
  'mark_unreachable',
] as const;
export type LeadActionKey = (typeof LEAD_ACTION_KEYS)[number];

const leadActionBody = z.object({
  action: z.enum(LEAD_ACTION_KEYS),
  note: z.string().max(2000).optional(),
});

/** Lead status each non-sms action moves the lead to once proposed. */
const ACTION_STATUS: Record<Exclude<LeadActionKey, 'propose_sms_reply'>, string> = {
  qualify_lead: 'agent_action_proposed',
  request_missing_move_details: 'agent_action_proposed',
  estimate_urgency: 'agent_action_proposed',
  schedule_callback: 'callback_scheduled',
  create_booking_intent: 'booking_intent_created',
  handoff_to_human: 'human_review_required',
  mark_rescued: 'agent_action_proposed',
  mark_unreachable: 'lost',
};

/** Actions whose execution touches a customer or commits the business. */
const RISKY_ACTIONS = new Set<LeadActionKey>([
  'propose_sms_reply',
  'schedule_callback',
  'create_booking_intent',
]);

/**
 * Propose a front-desk action on a lead. `propose_sms_reply` delegates to the
 * full SMS draft pipeline; everything else records a proposed agent_action
 * (simulation-first, approval-gated for risky kinds) + a proof + audit.
 *
 * Proof tagging (doctrine §13): the PROPOSAL itself is a verified_fact (the
 * system demonstrably generated and logged it); any customer/business outcome
 * it implies stays unknown until evidence exists.
 */
export async function proposeLeadAction(
  repo: Repository,
  services: GtmServices,
  tenantId: string,
  leadId: string,
  body: unknown,
  actorRef: string,
  traceId: string,
): Promise<{ action: AgentActionRow; proof_id: string | null; draft_body?: string }> {
  const input = leadActionBody.parse(body ?? {});
  if (input.action === 'propose_sms_reply') {
    const result = await draftReply(repo, services, tenantId, leadId, traceId);
    return { action: result.action, proof_id: null, draft_body: result.draft_body };
  }

  const lead = await repo.getLeadIntake(tenantId, leadId);
  if (!lead) throw new LeadNotFoundError(leadId);
  if (lead.pii_status === 'purged') throw new LeadPurgedError(leadId);

  const ts = new Date().toISOString();
  const run = await repo.createAgentRun({
    id: randomUUID(),
    tenant_id: tenantId,
    agent: FRONT_DESK_AGENT,
    objective: `front-desk: ${input.action}`,
    input_refs: [`lead_intake:${leadId}`],
    status: 'completed',
    trace_id: traceId,
    created_at: ts,
    updated_at: ts,
  });
  const action = await repo.createAgentAction({
    id: randomUUID(),
    tenant_id: tenantId,
    agent_run_id: run.id,
    action_type: `frontdesk.${input.action}`,
    risk_level: RISKY_ACTIONS.has(input.action) ? 'high' : 'medium',
    idempotency_key: `frontdesk:${leadId}:${input.action}:${ts}`,
    approval_status: RISKY_ACTIONS.has(input.action) ? 'proposed' : 'approved',
    execution_status: 'pending',
    target_ref: `lead_intake:${leadId}`,
    evidence_refs: [`lead_intake:${leadId}`],
    payload_ref: null,
    guardrail_results: [{ name: 'simulation_only', passed: true }],
    result: input.note ? { note: input.note } : null,
    simulation: true,
    proof_id: null,
    created_at: ts,
    updated_at: ts,
  });

  // The proposal is itself a verifiable fact: this action row is the evidence.
  const proofId = randomUUID();
  await repo.insertProof({
    id: proofId,
    tenant_id: tenantId,
    kind: 'system',
    subject_type: 'agent_action',
    subject_id: action.id,
    evidence_tag: 'verified_fact',
    evidence_ref: `agent_action:${action.id}`,
    verifier_ref: actorRef,
    summary_public: `Front-desk agent proposed '${input.action}' on an inbound lead (simulation).`,
    details_private: { lead_intake_id: leadId },
    public_safe: false,
    redaction_check_passed_at: null,
    supersedes_proof_id: null,
    external_attestation_ref: null,
    created_at: ts,
  });
  const linked = await repo.updateAgentAction(tenantId, action.id, { proof_id: proofId });
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'frontdesk.action.proposed.v1',
    subject_ref: `agent_action:${action.id}`,
    detail: { lead_intake_id: leadId, action: input.action, proof_id: proofId },
    occurred_at: ts,
    created_at: ts,
  });
  await repo.updateLeadIntakeStatus(tenantId, leadId, ACTION_STATUS[input.action]);
  return { action: linked, proof_id: proofId };
}

const leadOutcomeBody = z.object({
  outcome: z.enum([
    'rescued_lead',
    'booking_intent',
    'booked_job',
    'lost_lead',
    'invalid_lead',
    'human_handoff',
    'unknown',
  ]),
  evidence_tag: z.enum(['verified_fact', 'likely_inference', 'unknown']),
  evidence_source: z.string().max(500).optional(),
  estimated_value_cents: z.number().int().nonnegative().optional(),
  booked_value_cents: z.number().int().nonnegative().optional(),
  agent_id: z.string().uuid().optional(), // reputation credit target (verified_fact only)
});

const OUTCOME_LEAD_STATUS: Record<string, string | null> = {
  rescued_lead: 'contacted_simulated',
  booking_intent: 'booking_intent_created',
  booked_job: 'booked',
  lost_lead: 'lost',
  invalid_lead: 'lost',
  human_handoff: 'human_review_required',
  unknown: null,
};

/**
 * Record an evidence-tagged lead outcome. Creates a revenue_outcome proof and
 * — ONLY for verified_fact outcomes with a credited agent — a positive
 * reputation event (the 0010 trigger and its in-memory mirror reject anything
 * else). likely_inference / unknown outcomes can never add reputation.
 */
export async function createLeadOutcome(
  repo: Repository,
  tenantId: string,
  leadId: string,
  body: unknown,
  actorRef: string,
  traceId: string,
): Promise<{ outcome_id: string; proof_id: string; reputation_event_id: string | null }> {
  const input = leadOutcomeBody.parse(body ?? {});
  const lead = await repo.getLeadIntake(tenantId, leadId);
  if (!lead) throw new LeadNotFoundError(leadId);
  if (input.evidence_tag === 'verified_fact' && !input.evidence_source) {
    throw new OutcomeEvidenceError();
  }

  const ts = new Date().toISOString();
  const proofId = randomUUID();
  await repo.insertProof({
    id: proofId,
    tenant_id: tenantId,
    kind: 'revenue_outcome',
    subject_type: 'lead_intake',
    subject_id: leadId,
    evidence_tag: input.evidence_tag,
    evidence_ref: input.evidence_tag === 'verified_fact' ? input.evidence_source! : null,
    verifier_ref: input.evidence_tag === 'verified_fact' ? actorRef : null,
    summary_public: `Lead outcome recorded: ${input.outcome} (${input.evidence_tag}).`,
    details_private: {
      lead_intake_id: leadId,
      estimated_value_cents: input.estimated_value_cents ?? null,
      booked_value_cents: input.booked_value_cents ?? null,
      evidence_source: input.evidence_source ?? null,
    },
    public_safe: false,
    redaction_check_passed_at: null,
    supersedes_proof_id: null,
    external_attestation_ref: null,
    created_at: ts,
  });

  const outcomeId = randomUUID();
  await repo.insertLeadOutcome({
    id: outcomeId,
    tenant_id: tenantId,
    lead_intake_id: leadId,
    outcome: input.outcome,
    response_time_ms: null,
    booking_value_cents: input.booked_value_cents ?? null,
    currency: 'CAD',
    evidence_tag: input.evidence_tag,
    proof_id: proofId,
    estimated_value_cents: input.estimated_value_cents ?? null,
    evidence_source: input.evidence_source ?? null,
    created_at: ts,
    updated_at: ts,
  });

  // Reputation: verified_fact + positive business outcome + credited agent only.
  let reputationEventId: string | null = null;
  const positiveOutcome = ['rescued_lead', 'booking_intent', 'booked_job'].includes(input.outcome);
  if (input.evidence_tag === 'verified_fact' && positiveOutcome && input.agent_id) {
    const event = await repo.insertReputationEvent({
      id: randomUUID(),
      tenant_id: tenantId,
      agent_id: input.agent_id,
      proof_id: proofId,
      delta: input.outcome === 'booked_job' ? 5 : 2,
      reason_code: `lead_outcome:${input.outcome}`,
      created_at: ts,
    });
    reputationEventId = event.id;
  }

  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'frontdesk.outcome.recorded.v1',
    subject_ref: `lead_intake:${leadId}`,
    detail: { outcome: input.outcome, evidence_tag: input.evidence_tag, proof_id: proofId },
    occurred_at: ts,
    created_at: ts,
  });
  await repo.insertEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    event_name: 'frontdesk.lead_outcome.recorded.v1',
    entity_type: 'lead_intake',
    entity_id: leadId,
    source: 'api',
    occurred_at: ts,
    ingested_at: ts,
    payload: { outcome: input.outcome, evidence_tag: input.evidence_tag },
    trace_id: traceId,
    created_at: ts,
  });
  const nextStatus = OUTCOME_LEAD_STATUS[input.outcome];
  if (nextStatus) await repo.updateLeadIntakeStatus(tenantId, leadId, nextStatus);

  return { outcome_id: outcomeId, proof_id: proofId, reputation_event_id: reputationEventId };
}

/** Lead Rescue dashboard numbers. Verified values come from verified_fact rows only. */
export async function getLeadRescueSummary(repo: Repository, tenantId: string) {
  const [leads, outcomes, actions] = await Promise.all([
    repo.listLeadIntakes(tenantId),
    repo.listLeadOutcomes(tenantId),
    repo.listAgentActions(tenantId),
  ]);
  const frontDeskActions = actions.filter(
    (a) => a.action_type.startsWith('frontdesk.') || a.action_type === SMS_REPLY_ACTION,
  );
  const byOutcome = (kind: string) => outcomes.filter((o) => o.outcome === kind);
  // Number() is load-bearing: the pg driver returns bigint columns as
  // strings (int8 overflows JS numbers), so `+` would concatenate on a live
  // Postgres even though the in-memory repo returns numbers. Found by the
  // live-DB smoke (LANE_A_DEV_DB_VERIFICATION.md).
  const sum = (rows: typeof outcomes, field: 'estimated_value_cents' | 'booking_value_cents') =>
    rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
  return {
    total_leads: leads.length,
    leads_needing_response: leads.filter((l) => l.status === 'needs_response' || l.status === 'new')
      .length,
    actions_proposed: frontDeskActions.length,
    rescued_leads: byOutcome('rescued_lead').length,
    booking_intents: byOutcome('booking_intent').length,
    booked_jobs: byOutcome('booked_job').length,
    unknown_outcomes: byOutcome('unknown').length,
    estimated_value_cents: sum(outcomes, 'estimated_value_cents'),
    /** Counted ONLY from verified_fact booked_job outcomes — doctrine §13. */
    verified_booked_value_cents: sum(
      outcomes.filter((o) => o.outcome === 'booked_job' && o.evidence_tag === 'verified_fact'),
      'booking_value_cents',
    ),
  };
}

export class OutcomeEvidenceError extends Error {
  constructor() {
    super('verified_fact outcomes require an evidence_source (CRM ref, payment ref, …)');
    this.name = 'OutcomeEvidenceError';
  }
}

/**
 * Execute an APPROVED front-desk action as a SIMULATED send. Real sends are
 * structurally impossible in v1.1: any request for one is refused (no
 * provider exists, and sms.send_real is deny-by-default + owner-gated).
 * Emits exactly one proof (lead_response, verified_fact) + one audit row.
 */
export async function executeSimulatedSend(
  repo: Repository,
  tenantId: string,
  actionId: string,
  options: { simulation?: boolean },
  actorRef: string,
  traceId: string,
): Promise<{ action: AgentActionRow; proof_id: string; response_time_ms: number }> {
  const action = await repo.getAgentAction(tenantId, actionId);
  if (!action || action.action_type !== SMS_REPLY_ACTION) {
    throw new FrontDeskActionNotFoundError(actionId);
  }
  if (options.simulation === false) {
    throw new RealSendRefusedError();
  }
  if (action.approval_status !== 'approved') {
    throw new NotApprovedError(actionId, action.approval_status);
  }
  if (action.execution_status === 'executed') {
    // Idempotent replay: return the stored outcome without re-sending.
    const priorMs = Number((action.result as { response_time_ms?: number })?.response_time_ms ?? 0);
    return { action, proof_id: action.proof_id ?? '', response_time_ms: priorMs };
  }

  const leadId = action.target_ref.replace('lead_intake:', '');
  const lead = await repo.getLeadIntake(tenantId, leadId);
  if (!lead) throw new LeadNotFoundError(leadId);

  const now = new Date();
  const responseTimeMs = Math.max(0, now.getTime() - new Date(lead.received_at).getTime());
  const ts = now.toISOString();

  // The simulation record (action + this proof) is itself the verifiable
  // fact; a human approved it, so verifier_ref is the approving operator.
  const proofId = randomUUID();
  await repo.insertProof({
    id: proofId,
    tenant_id: tenantId,
    kind: 'lead_response',
    subject_type: 'agent_action',
    subject_id: action.id,
    evidence_tag: 'verified_fact',
    evidence_ref: `agent_action:${action.id}`,
    verifier_ref: actorRef,
    summary_public: `Simulated SMS reply sent ${Math.round(responseTimeMs / 1000)}s after lead intake (no real message sent).`,
    details_private: { lead_intake_id: leadId, draft_ref: action.payload_ref },
    public_safe: false,
    redaction_check_passed_at: null,
    supersedes_proof_id: null,
    external_attestation_ref: null,
    created_at: ts,
  });

  const updated = await repo.updateAgentAction(tenantId, action.id, {
    execution_status: 'executed',
    simulation: true,
    proof_id: proofId,
    result: { simulated: true, response_time_ms: responseTimeMs },
  });

  await repo.insertEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    event_name: 'frontdesk.lead_response.simulated.v1',
    entity_type: 'agent_action',
    entity_id: action.id,
    source: 'api',
    occurred_at: ts,
    ingested_at: ts,
    payload: { lead_intake_id: leadId, response_time_ms: responseTimeMs, proof_id: proofId },
    trace_id: traceId,
    created_at: ts,
  });
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'frontdesk.simulated_send.v1',
    subject_ref: `agent_action:${action.id}`,
    detail: { proof_id: proofId, response_time_ms: responseTimeMs },
    occurred_at: ts,
    created_at: ts,
  });

  await repo.updateLeadIntakeStatus(tenantId, leadId, 'contacted_simulated');
  return { action: updated, proof_id: proofId, response_time_ms: responseTimeMs };
}

export async function purgeLeadPii(
  repo: Repository,
  tenantId: string,
  leadId: string,
  actorRef: string,
): Promise<LeadIntakeRow> {
  const purged = await repo.purgeLeadIntakePii(tenantId, leadId);
  if (!purged) throw new LeadNotFoundError(leadId);
  const ts = new Date().toISOString();
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'lead.pii_purged.v1',
    subject_ref: `lead_intake:${leadId}`,
    detail: {},
    occurred_at: ts,
    created_at: ts,
  });
  return purged;
}

export class LeadNotFoundError extends Error {
  constructor(id: string) {
    super(`lead intake not found: ${id}`);
    this.name = 'LeadNotFoundError';
  }
}
export class LeadPurgedError extends Error {
  constructor(id: string) {
    super(`lead intake ${id} has been purged; no drafting on purged leads`);
    this.name = 'LeadPurgedError';
  }
}
export class FrontDeskActionNotFoundError extends Error {
  constructor(id: string) {
    super(`front-desk action not found: ${id}`);
    this.name = 'FrontDeskActionNotFoundError';
  }
}
export class NotApprovedError extends Error {
  constructor(id: string, status: string) {
    super(`action ${id} is '${status}' — human approval is required before any send`);
    this.name = 'NotApprovedError';
  }
}
export class RealSendRefusedError extends Error {
  constructor() {
    super(
      'real SMS is disabled in v1.1: no provider is configured and sms.send_real is deny-by-default (owner-gated)',
    );
    this.name = 'RealSendRefusedError';
  }
}
