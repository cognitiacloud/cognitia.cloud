import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Repository, AgentActionRow } from '@cognitia/db';
import {
  acceptWorkOrder,
  deliverWorkOrder,
  disputeWorkOrder,
  WorkOrderNotFoundError,
  IllegalWorkOrderTransitionError,
  WorkerAtcRequiredError,
  SelfAcceptError,
  type WorkOrderView,
} from './agentEconomy.js';
import { AgentNotFoundError } from './atc.js';

/**
 * AGENT-ECONOMY-003 — agent-driven work-order actions through the EXISTING
 * Action Ledger / Approval Ledger. Agents never get uncontrolled execution:
 * they PROPOSE; humans decide on the same approve/reject ledger every other
 * risky action uses; a separate operator-gated execute step runs the safe
 * service path (escrow movements stay inside acceptWorkOrder /
 * deliverWorkOrder / disputeWorkOrder — this file never touches credits).
 *
 * Permission posture (deny-by-default, like sms.send_real):
 *   - economy.work_order.accept   → agent-proposable WITH an explicit allow
 *   - economy.work_order.deliver  → agent-proposable WITH an explicit allow
 *   - economy.work_order.dispute  → agent-proposable WITH an explicit allow
 *   - economy.work_order.verify   → NEVER agent-proposable (owner decision)
 *   - economy.work_order.resolve  → NEVER agent-proposable (owner decision)
 * An explicit deny row always wins; absence of an allow row is a deny.
 * Every proposal is risk_level=high and requires_human_approval — there is
 * no auto-approved economy action.
 */

export const ECONOMY_PERMISSION_KEYS = {
  accept: 'economy.work_order.accept',
  deliver: 'economy.work_order.deliver',
  dispute: 'economy.work_order.dispute',
  verify: 'economy.work_order.verify',
  resolve: 'economy.work_order.resolve',
} as const;
export type EconomyActionKind = keyof typeof ECONOMY_PERMISSION_KEYS;

/** Only these may arrive through the agent proposal path. */
const AGENT_PROPOSABLE: ReadonlySet<EconomyActionKind> = new Set(['accept', 'deliver', 'dispute']);

export const ECONOMY_ACTION_TYPE_PREFIX = 'economy.work_order.';

const proposalBody = z.object({
  agent_id: z.string().uuid(),
  /** Per-kind payload; everything optional, validated at execution time. */
  skill_version_id: z.string().uuid().optional(),
  proof_id: z.string().uuid().optional(),
  result_summary: z.string().max(2000).optional(),
  outcome_type: z.string().max(200).optional(),
  reason_code: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
});
export type EconomyProposalBody = z.infer<typeof proposalBody>;

async function requirePermission(
  repo: Repository,
  tenantId: string,
  agentId: string,
  kind: EconomyActionKind,
): Promise<void> {
  const key = ECONOMY_PERMISSION_KEYS[kind];
  const permissions = await repo.listAgentPermissions(tenantId, agentId);
  const row = permissions.find((p) => p.action_key === key);
  // Deny-by-default: an explicit allow is required; an explicit deny wins.
  if (!row || row.effect !== 'allow') {
    throw new EconomyPermissionDeniedError(agentId, key, row?.effect ?? 'absent');
  }
}

/**
 * An AGENT proposes an economy action on a work order. Trust gate (active
 * ATC) + permission gate (explicit allow) + state preconditions are checked
 * at proposal time so the approval queue only ever contains executable asks;
 * execution re-runs every rule through the safe service path anyway.
 */
export async function proposeWorkOrderAgentAction(
  repo: Repository,
  tenantId: string,
  workOrderId: string,
  kind: EconomyActionKind,
  body: unknown,
  actorRef: string,
  traceId: string,
): Promise<{ action: AgentActionRow; proof_id: string | null; replayed: boolean }> {
  if (!AGENT_PROPOSABLE.has(kind)) {
    throw new NotAgentProposableError(kind);
  }
  const input = proposalBody.parse(body ?? {});
  const wo = await repo.getWorkOrder(tenantId, workOrderId);
  if (!wo) throw new WorkOrderNotFoundError(workOrderId);
  const agent = await repo.getAgent(tenantId, input.agent_id);
  if (!agent) throw new AgentNotFoundError(input.agent_id);

  // Trust gate: proposing economy actions requires an ACTIVE ATC.
  const atcs = await repo.listAtcsByAgent(tenantId, input.agent_id);
  if (!atcs.some((a) => a.status === 'active')) {
    throw new WorkerAtcRequiredError(input.agent_id);
  }
  await requirePermission(repo, tenantId, input.agent_id, kind);

  // State preconditions (re-checked at execution; here they keep the queue clean).
  if (kind === 'accept') {
    if (wo.status !== 'proposed') throw new IllegalWorkOrderTransitionError(wo.status, 'accepted');
    if (input.agent_id === wo.requester_agent_id) throw new SelfAcceptError(workOrderId);
  }
  if (kind === 'deliver') {
    if (wo.status !== 'accepted' && wo.status !== 'in_progress') {
      throw new IllegalWorkOrderTransitionError(wo.status, 'delivered');
    }
    if (wo.worker_agent_id !== input.agent_id) {
      throw new WorkerMismatchError(input.agent_id, workOrderId);
    }
  }
  if (kind === 'dispute' && wo.status !== 'delivered') {
    throw new IllegalWorkOrderTransitionError(wo.status, 'disputed');
  }

  // Idempotent proposal, content-fingerprinted (front-desk precedent): the
  // SAME ask replays the same action; a REVISED payload (e.g. a deliver ask
  // that now carries a proof) is a fresh ask for a fresh human decision.
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify([
        input.skill_version_id ?? null,
        input.proof_id ?? null,
        input.result_summary ?? null,
        input.outcome_type ?? null,
        input.reason_code ?? null,
      ]),
    )
    .digest('hex')
    .slice(0, 12);
  const idempotencyKey = `economy:${kind}:${workOrderId}:${input.agent_id}:${fingerprint}`;
  const existing = await repo.findActionByIdempotencyKey(tenantId, idempotencyKey);
  if (existing) return { action: existing, proof_id: existing.proof_id ?? null, replayed: true };

  const ts = new Date().toISOString();
  const run = await repo.createAgentRun({
    id: randomUUID(),
    tenant_id: tenantId,
    agent: agent.slug,
    objective: `agent-economy: propose ${kind} on work order`,
    input_refs: [`work_order:${workOrderId}`, `agent:${input.agent_id}`],
    status: 'completed',
    trace_id: traceId,
    created_at: ts,
    updated_at: ts,
  });
  const action = await repo.createAgentAction({
    id: randomUUID(),
    tenant_id: tenantId,
    agent_run_id: run.id,
    action_type: `${ECONOMY_ACTION_TYPE_PREFIX}${kind}`,
    risk_level: 'high', // economic consequence ⇒ always approval-required
    idempotency_key: idempotencyKey,
    approval_status: 'proposed',
    execution_status: 'pending',
    target_ref: `work_order:${workOrderId}`,
    evidence_refs: [`work_order:${workOrderId}`, `agent:${input.agent_id}`],
    payload_ref: null,
    guardrail_results: [
      { name: 'active_atc', passed: true },
      { name: `permission:${ECONOMY_PERMISSION_KEYS[kind]}`, passed: true },
      { name: 'requires_human_approval', passed: true },
      { name: 'simulation_only', passed: true },
    ],
    result: {
      proposed_payload: {
        work_order_id: workOrderId,
        agent_id: input.agent_id,
        skill_version_id: input.skill_version_id ?? null,
        proof_id: input.proof_id ?? null,
        result_summary: input.result_summary ?? null,
        outcome_type: input.outcome_type ?? null,
        reason_code: input.reason_code ?? null,
        note: input.note ?? null,
      },
      requested_transition:
        kind === 'accept' ? 'proposed→accepted' : kind === 'deliver' ? '→delivered' : '→disputed',
      requires_human_approval: true,
      // The PROPOSAL is a verified fact (this row is the evidence); the
      // economic outcome it asks for stays ungranted until approval+execution.
      evidence_tag: 'verified_fact',
    },
    simulation: true,
    proof_id: null,
    created_at: ts,
    updated_at: ts,
  });

  // Proposal proof — same discipline as front-desk proposals (§13).
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
    summary_public: `Agent proposed '${kind}' on a work order through the Action Ledger (approval required).`,
    details_private: { work_order_id: workOrderId, agent_id: input.agent_id, kind },
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
    action: 'economy.agent_action.proposed.v1',
    subject_ref: `agent_action:${action.id}`,
    detail: { work_order_id: workOrderId, agent_id: input.agent_id, kind, proof_id: proofId },
    occurred_at: ts,
    created_at: ts,
  });
  return { action: linked, proof_id: proofId, replayed: false };
}

interface ProposedPayload {
  work_order_id: string;
  agent_id: string;
  skill_version_id: string | null;
  proof_id: string | null;
  result_summary: string | null;
  outcome_type: string | null;
  reason_code: string | null;
  note: string | null;
}

/**
 * Execute an APPROVED economy agent action (operator-gated route). All
 * economic effects run through the same service functions the human routes
 * use — escrow can only ever move along the safe path, and every 0016/0017
 * guard re-applies. Unapproved or rejected asks are refused; an executed
 * action never executes twice.
 */
export async function executeWorkOrderAgentAction(
  repo: Repository,
  tenantId: string,
  actionId: string,
  actorRef: string,
  traceId: string,
): Promise<{ action: AgentActionRow; work_order: WorkOrderView | null }> {
  const action = await repo.getAgentAction(tenantId, actionId);
  if (!action || !action.action_type.startsWith(ECONOMY_ACTION_TYPE_PREFIX)) {
    throw new EconomyActionNotFoundError(actionId);
  }
  if (action.approval_status !== 'approved') {
    throw new EconomyActionNotApprovedError(actionId, action.approval_status);
  }
  if (action.execution_status !== 'pending') {
    throw new EconomyActionAlreadyExecutedError(actionId, action.execution_status);
  }
  const kind = action.action_type.slice(ECONOMY_ACTION_TYPE_PREFIX.length) as EconomyActionKind;
  const payload = (action.result as { proposed_payload?: ProposedPayload } | null)
    ?.proposed_payload;
  if (!payload) throw new EconomyActionNotFoundError(actionId);

  let view: WorkOrderView;
  if (kind === 'accept') {
    const updated = await acceptWorkOrder(
      repo,
      tenantId,
      payload.work_order_id,
      {
        worker_agent_id: payload.agent_id,
        skill_version_id: payload.skill_version_id ?? undefined,
      },
      actorRef,
    );
    view = { ...updated, executions: [], resolution: null };
  } else if (kind === 'deliver') {
    view = await deliverWorkOrder(
      repo,
      tenantId,
      payload.work_order_id,
      {
        proof_id: payload.proof_id ?? undefined,
        result_summary: payload.result_summary ?? undefined,
        ...(payload.outcome_type ? { outcome_type: payload.outcome_type } : {}),
      },
      actorRef,
      traceId,
    );
  } else if (kind === 'dispute') {
    const updated = await disputeWorkOrder(
      repo,
      tenantId,
      payload.work_order_id,
      {
        reason: {
          reason_code: payload.reason_code ?? 'agent_disputed',
          note: payload.note ?? undefined,
        },
      },
      actorRef,
    );
    view = { ...updated, executions: [], resolution: null };
  } else {
    throw new NotAgentProposableError(kind);
  }

  const ts = new Date().toISOString();
  const executed = await repo.updateAgentAction(tenantId, actionId, {
    execution_status: 'completed',
    // Delivery produces the work-order proof; keep the proposal proof otherwise.
    proof_id: kind === 'deliver' && view.proof_id ? view.proof_id : action.proof_id,
    result: {
      ...(action.result as Record<string, unknown>),
      executed: { status: view.status, escrow_status: view.escrow_status, proof_id: view.proof_id },
    },
  });
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'economy.agent_action.executed.v1',
    subject_ref: `agent_action:${actionId}`,
    detail: {
      kind,
      work_order_id: payload.work_order_id,
      agent_id: payload.agent_id,
      work_order_status: view.status,
    },
    occurred_at: ts,
    created_at: ts,
  });
  return { action: executed, work_order: view };
}

/** Economy actions for the console: ledger status + decision feedback. */
export async function listEconomyAgentActions(
  repo: Repository,
  tenantId: string,
): Promise<Array<AgentActionRow & { decisions: Array<{ label: string; detail: unknown }> }>> {
  const actions = await repo.listAgentActions(tenantId);
  const economy = actions.filter((a) => a.action_type.startsWith(ECONOMY_ACTION_TYPE_PREFIX));
  return Promise.all(
    economy.map(async (a) => {
      const labels = await repo.listFeedbackLabels(tenantId, `agent_action:${a.id}`);
      return { ...a, decisions: labels.map((l) => ({ label: l.label, detail: l.detail })) };
    }),
  );
}

export class EconomyPermissionDeniedError extends Error {
  constructor(agentId: string, key: string, state: string) {
    super(
      `agent ${agentId} lacks an explicit allow for ${key} (permission ${state}; deny-by-default)`,
    );
    this.name = 'EconomyPermissionDeniedError';
  }
}
export class NotAgentProposableError extends Error {
  constructor(kind: string) {
    super(`'${kind}' is not agent-proposable — verify/resolve remain human owner decisions`);
    this.name = 'NotAgentProposableError';
  }
}
export class WorkerMismatchError extends Error {
  constructor(agentId: string, workOrderId: string) {
    super(`agent ${agentId} is not the assigned worker for work order ${workOrderId}`);
    this.name = 'WorkerMismatchError';
  }
}
export class EconomyActionNotFoundError extends Error {
  constructor(id: string) {
    super(`economy agent action not found: ${id}`);
    this.name = 'EconomyActionNotFoundError';
  }
}
export class EconomyActionNotApprovedError extends Error {
  constructor(id: string, status: string) {
    super(`economy agent action ${id} is not approved (status: ${status}) — approval required`);
    this.name = 'EconomyActionNotApprovedError';
  }
}
export class EconomyActionAlreadyExecutedError extends Error {
  constructor(id: string, status: string) {
    super(`economy agent action ${id} already executed (status: ${status})`);
    this.name = 'EconomyActionAlreadyExecutedError';
  }
}
