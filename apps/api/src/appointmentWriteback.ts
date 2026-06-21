import { createHash } from 'node:crypto';
import {
  appointmentRequest,
  idempotencyKey,
  type AppointmentRequest,
  type ProofCreate,
  type ApprovedAgentAction,
  type ActionProvenance,
} from '@cognitia/core';
import {
  assertApproved,
  type AdapterResult,
  type IntegrationAdapter,
} from '@cognitia/integrations';
import type { Repository, ProofRow } from '@cognitia/db';
import { createProof } from './proofs.js';

/**
 * ============================================================================
 * MOCK-ONLY. Client Zero appointment → CRM writeback (no live anything).
 * ============================================================================
 *
 * This module supplies the "appointment / CRM writeback" leg the PR #115
 * Client Zero review names as the missing happy-path step
 * (lead → consent → approval → appointment/CRM writeback → proof report). It
 * does NOT call HubSpot/Supabase/any vendor, touches no real customer data,
 * sends no outreach, and performs no network I/O. It only:
 *
 *   1. maps an appointment booking onto the EXISTING governed `crm.note.create`
 *      action shape (it proposes; a human still approves before any real write);
 *   2. derives a deterministic idempotency key so one appointment maps to
 *      exactly one CRM note (replays collapse to a no-op);
 *   3. emits a Proof-Harness-consumable result (a `proofCreate`-valid body,
 *      kind `booking`) carrying an explicit `mock`/`simulated` flag.
 *
 * The `MockCrmWritebackAdapter` is an in-memory stand-in for a real
 * `IntegrationAdapter`; the live seam (operator-gated transport + a real CRM
 * client) attaches later, exactly where the HubSpot adapter does.
 */

/** The producing context for an appointment writeback. Refs/roles only — no PII. */
export interface AppointmentWritebackContext {
  /** UUID of the agent run that produced this proposal. */
  agentRunId: string;
  /** Producing agent label; defaults to 'client-zero'. */
  agent?: string;
  traceId: string;
  /** Approver principal ref/role (e.g. "user:operator"), when resolved. */
  approvedBy?: string;
}

/**
 * A proposed `crm.note.create` action for an appointment. Mirrors the governed
 * action shape (schemas/agent.ts) so it can flow through the same preview →
 * approve → execute lifecycle as every other CRM write. No raw PII rides along:
 * the note summary stays out-of-band behind `payloadRef`.
 */
export interface AppointmentNoteProposal {
  tenantId: string;
  agentRunId: string;
  agent: string;
  traceId: string;
  actionType: 'crm.note.create';
  riskLevel: 'low';
  /** "contact:<uuid>" — the CRM contact the note attaches to. */
  targetRef: string;
  /** Grounding refs only (e.g. "appointment:<uuid>"), never a transcript. */
  evidenceRefs: string[];
  contentFingerprint: string;
  /** Out-of-band pointer to the rendered note body; never inlines PII. */
  payloadRef: string;
  idempotencyKey: string;
  guardrailResults: never[];
}

/** The machine-readable envelope the Proof Harness (or an operator) consumes. */
export interface AppointmentWritebackResult {
  /** Always true here — this path never goes live. */
  mock: true;
  idempotency_key: string;
  proposed_action: AppointmentNoteProposal;
  /** A `proofCreate`-valid body (kind: 'booking') ready for `createProof`. */
  proof_input: ProofCreate;
}

const VERIFIER_REF = 'verifier:client-zero-mock';

/**
 * Deterministic content fingerprint for an appointment note. Keyed on the
 * appointment id ALONE, so one appointment ⇒ one note no matter how many times
 * the booking is re-delivered.
 */
export function appointmentNoteFingerprint(appointmentId: string): string {
  return (
    'appointment-note:v1:' + createHash('sha256').update(appointmentId).digest('hex').slice(0, 32)
  );
}

/** "contact:<uuid>" target ref for the CRM contact. */
function contactTargetRef(contactId: string): string {
  return `contact:${contactId}`;
}

/**
 * Map an appointment request onto a governed `crm.note.create` proposal. Pure;
 * proposes only — it never writes, never sends, never touches the network.
 */
export function appointmentToNoteProposal(
  input: AppointmentRequest,
  ctx: AppointmentWritebackContext,
): AppointmentNoteProposal {
  const req = appointmentRequest.parse(input);
  const targetRef = contactTargetRef(req.contact_id);
  const contentFingerprint = appointmentNoteFingerprint(req.appointment_id);
  const key = idempotencyKey({
    tenant_id: req.tenant_id,
    action_type: 'crm.note.create',
    target_ref: targetRef,
    content_fingerprint: contentFingerprint,
  });
  return {
    tenantId: req.tenant_id,
    agentRunId: ctx.agentRunId,
    agent: ctx.agent ?? 'client-zero',
    traceId: ctx.traceId,
    actionType: 'crm.note.create',
    riskLevel: 'low',
    targetRef,
    evidenceRefs: [`appointment:${req.appointment_id}`],
    contentFingerprint,
    payloadRef: `appointment-summary:${req.appointment_id}`,
    idempotencyKey: key,
    guardrailResults: [],
  };
}

/**
 * Build the Proof-Harness-consumable proof body for an appointment writeback.
 * kind `booking`; tagged `verified_fact` (the mock run deterministically
 * happened) with the mandatory evidence_ref + verifier_ref, and an explicit
 * `mock`/`simulated` flag in details_private so it is never mistaken for a live
 * CRM write. summary_public is PII-free; invitee name/email never appear.
 */
export function appointmentToProofInput(input: AppointmentRequest): ProofCreate {
  const req = appointmentRequest.parse(input);
  const fingerprint = appointmentNoteFingerprint(req.appointment_id);
  const idemKey = idempotencyKey({
    tenant_id: req.tenant_id,
    action_type: 'crm.note.create',
    target_ref: contactTargetRef(req.contact_id),
    content_fingerprint: fingerprint,
  });
  return {
    tenant_id: req.tenant_id,
    kind: 'booking',
    subject_type: 'appointment',
    subject_id: req.appointment_id,
    evidence_tag: 'verified_fact',
    evidence_ref: `appointment:${req.appointment_id}:mock:${fingerprint}`,
    verifier_ref: VERIFIER_REF,
    summary_public: `Mock ${req.provider} appointment writeback prepared (${req.event_type}) for a Client Zero contact.`,
    details_private: {
      mock: true,
      simulated: true,
      provider: req.provider,
      event_type: req.event_type,
      status: req.status,
      scheduled_start: req.scheduled_start,
      scheduled_end: req.scheduled_end ?? null,
      idempotency_key: idemKey,
      content_fingerprint: fingerprint,
    },
  };
}

/**
 * Ingest an appointment writeback in mock mode and return the machine-readable
 * result. Pure and side-effect-free: it proposes a CRM note and prepares a
 * proof, but writes nothing and sends nothing. A human approval gate and the
 * (later) live transport sit downstream of this envelope.
 */
export function ingestAppointmentWriteback(
  input: AppointmentRequest,
  ctx: AppointmentWritebackContext,
): AppointmentWritebackResult {
  const req = appointmentRequest.parse(input);
  const proposal = appointmentToNoteProposal(req, ctx);
  return {
    mock: true,
    idempotency_key: proposal.idempotencyKey,
    proposed_action: proposal,
    proof_input: appointmentToProofInput(req),
  };
}

/**
 * Persist the appointment proof through the real Proof Registry so the Proof
 * Harness / public trust surface can consume it. Delegates to `createProof`
 * (append-only insert + event/audit emission); `tenant_id` is taken from the
 * request. This is the only function here that has a side effect, and it is
 * confined to the local repository — still no vendor/network call.
 */
export async function recordAppointmentProof(
  repo: Repository,
  req: AppointmentRequest,
  actorRef: string,
  traceId: string,
): Promise<ProofRow> {
  const parsed = appointmentRequest.parse(req);
  return createProof(repo, parsed.tenant_id, appointmentToProofInput(parsed), actorRef, traceId);
}

/**
 * In-memory mock CRM writeback adapter. Implements the real `IntegrationAdapter`
 * contract so the approve → execute → rollback lifecycle works end-to-end with
 * zero external dependencies. Idempotency is keyed on `action.idempotency_key`:
 * a replay returns the original `external_ref` with `idempotent_replay: true`
 * and produces no new write (exactly like the HubSpot client's
 * search-before-write). It never goes to the network.
 */
export class MockCrmWritebackAdapter implements IntegrationAdapter {
  readonly system = 'mock-crm';
  readonly kind = 'crm' as const;

  /** idempotency_key → external_ref. The mock "system of record". */
  private readonly store = new Map<string, string>();
  /** Append-only log of real writes (replays are NOT logged). */
  readonly writeLog: Array<{ idempotency_key: string; external_ref: string }> = [];

  handles(actionType: string): boolean {
    return actionType === 'crm.note.create';
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(
    action: ApprovedAgentAction,
    _provenance?: ActionProvenance,
  ): Promise<AdapterResult> {
    assertApproved(action);
    const key = action.idempotency_key;
    const existing = this.store.get(key);
    if (existing) {
      return {
        ok: true,
        external_ref: existing,
        idempotent_replay: true,
        detail: 'mock-crm idempotent replay',
      };
    }
    const externalRef = `mock-crm:notes:${key.slice(0, 12)}`;
    this.store.set(key, externalRef);
    this.writeLog.push({ idempotency_key: key, external_ref: externalRef });
    return {
      ok: true,
      external_ref: externalRef,
      idempotent_replay: false,
      detail: 'mock-crm note created',
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async rollback(_tenantId: string, externalRef: string): Promise<AdapterResult> {
    for (const [key, ref] of this.store) {
      if (ref === externalRef) {
        this.store.delete(key);
        break;
      }
    }
    // Idempotent: archiving an already-gone note is still a success.
    return { ok: true, external_ref: externalRef, detail: 'mock-crm note archived' };
  }

  /** Test/inspection helper: number of distinct notes currently written. */
  get size(): number {
    return this.store.size;
  }
}
