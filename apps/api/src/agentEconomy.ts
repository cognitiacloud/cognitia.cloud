import { randomUUID } from 'node:crypto';
import type {
  Repository,
  WorkOrderRow,
  SkillExecutionOrderRow,
  DisputeResolutionRow,
  ProofRow,
} from '@cognitia/db';
import {
  workOrderCreate,
  workOrderAccept,
  workOrderDeliver,
  workOrderDecisionReason,
  disputeResolutionCreate,
} from '@cognitia/core';
import { transfer } from './credits.js';
import { createProof } from './proofs.js';
import { SkillVersionYankedError } from './skillproof.js';
import { AgentNotFoundError } from './atc.js';

/**
 * AGENT-ECONOMY-001 — Agent Economy Lab service. The first closed-loop agent
 * economy on the existing primitives (ATC, Proof Registry, SkillProof,
 * Reputation, Credits ledger):
 *
 *   agent requests work → another agent accepts (active ATC required) →
 *   internal credits are RESERVED into escrow → work is delivered as a
 *   SIMULATED skill execution order → a proof is submitted → escrow is
 *   released / refunded / disputed → reputation moves only on verified_fact.
 *
 * Doctrine (in three places, as always):
 *   - escrow release requires a verified_fact proof: 0016 trigger (DB),
 *     in-memory mirror, and this service;
 *   - executions are simulation-locked: 0016 CHECK, memory mirror, zod literal;
 *   - internal credits are the only rail (0012 — untouched);
 *   - yanked skill versions cannot take new work;
 *   - no real payments, no token transfers, no public economy surface.
 */

const RELEASE_REPUTATION_DELTA = 3;
const REJECT_REPUTATION_DELTA = -2;

export interface WorkOrderView extends WorkOrderRow {
  executions: SkillExecutionOrderRow[];
  /** AGENT-ECONOMY-002: the arbitration record, when the dispute resolved. */
  resolution: DisputeResolutionRow | null;
}

async function getOrThrow(repo: Repository, tenantId: string, id: string): Promise<WorkOrderRow> {
  const row = await repo.getWorkOrder(tenantId, id);
  if (!row) throw new WorkOrderNotFoundError(id);
  return row;
}

async function requireActiveAgent(repo: Repository, tenantId: string, agentId: string) {
  const agent = await repo.getAgent(tenantId, agentId);
  if (!agent) throw new AgentNotFoundError(agentId);
  return agent;
}

async function requireNotYanked(repo: Repository, tenantId: string, skillVersionId: string) {
  const version = await repo.getSkillVersion(tenantId, skillVersionId);
  if (!version) throw new SkillVersionNotFoundForWorkError(skillVersionId);
  // Yanked versions take NO new work — economy mirror of the SkillProof rule.
  if (version.yanked) throw new SkillVersionYankedError(skillVersionId);
  return version;
}

async function audit(
  repo: Repository,
  tenantId: string,
  actorRef: string,
  action: string,
  workOrderId: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const ts = new Date().toISOString();
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action,
    subject_ref: `work_order:${workOrderId}`,
    detail,
    occurred_at: ts,
    created_at: ts,
  });
}

/** Open-or-get the credits account for an owner (idempotent upsert). */
async function ensureAccount(
  repo: Repository,
  tenantId: string,
  ownerType: 'agent' | 'escrow',
  ownerId: string,
): Promise<string> {
  const ts = new Date().toISOString();
  const account = await repo.upsertCreditsAccount({
    id: randomUUID(),
    tenant_id: tenantId,
    owner_type: ownerType,
    owner_id: ownerId,
    status: 'active',
    created_at: ts,
    updated_at: ts,
  });
  return account.id;
}

/** An agent requests work, priced in internal credits. */
export async function createWorkOrder(
  repo: Repository,
  tenantId: string,
  body: unknown,
  actorRef: string,
): Promise<WorkOrderRow> {
  const input = workOrderCreate.parse({
    ...(body as Record<string, unknown>),
    tenant_id: tenantId,
  });
  await requireActiveAgent(repo, tenantId, input.requester_agent_id);
  if (input.skill_version_id) await requireNotYanked(repo, tenantId, input.skill_version_id);

  const ts = new Date().toISOString();
  const row = await repo.insertWorkOrder({
    id: randomUUID(),
    tenant_id: tenantId,
    requester_agent_id: input.requester_agent_id,
    worker_agent_id: null,
    skill_version_id: input.skill_version_id ?? null,
    title: input.title,
    description: input.description ?? null,
    status: 'proposed',
    requested_credits: input.requested_credits,
    escrow_status: 'none',
    escrow_account_id: null,
    proof_required: input.proof_required,
    proof_id: null,
    outcome_type: null,
    evidence_tag: null,
    resolution_proof_id: null,
    listing_id: null,
    created_at: ts,
    updated_at: ts,
  });
  await audit(repo, tenantId, actorRef, 'economy.work_order.proposed.v1', row.id, {
    requested_credits: input.requested_credits,
    proof_required: input.proof_required,
  });
  return row;
}

/**
 * A worker agent accepts: trust gate (active ATC) + skill gate (not yanked),
 * then the requester's credits are RESERVED into the work order's escrow
 * account — one balanced, idempotent ledger pair (reserveCreditsForWorkOrder).
 */
export async function acceptWorkOrder(
  repo: Repository,
  tenantId: string,
  id: string,
  body: unknown,
  actorRef: string,
): Promise<WorkOrderRow> {
  const input = workOrderAccept.parse(body ?? {});
  const wo = await getOrThrow(repo, tenantId, id);
  if (wo.status !== 'proposed') {
    throw new IllegalWorkOrderTransitionError(wo.status, 'accepted');
  }
  if (input.worker_agent_id === wo.requester_agent_id) {
    throw new SelfAcceptError(id);
  }
  await requireActiveAgent(repo, tenantId, input.worker_agent_id);
  // Trust gate: the worker must hold an ACTIVE Agent Trust Credential.
  const atcs = await repo.listAtcsByAgent(tenantId, input.worker_agent_id);
  if (!atcs.some((a) => a.status === 'active')) {
    throw new WorkerAtcRequiredError(input.worker_agent_id);
  }
  const skillVersionId = input.skill_version_id ?? wo.skill_version_id;
  if (skillVersionId) await requireNotYanked(repo, tenantId, skillVersionId);

  const escrowAccountId = await reserveCreditsForWorkOrder(repo, tenantId, wo, actorRef);
  const updated = await repo.updateWorkOrder(tenantId, id, {
    status: 'accepted',
    worker_agent_id: input.worker_agent_id,
    skill_version_id: skillVersionId ?? null,
    escrow_status: 'reserved',
    escrow_account_id: escrowAccountId,
  });
  await audit(repo, tenantId, actorRef, 'economy.work_order.accepted.v1', id, {
    worker_agent_id: input.worker_agent_id,
    escrow: 'reserved',
    amount: wo.requested_credits,
  });
  return updated!;
}

/** requester agent account → work-order escrow account (idempotent pair). */
export async function reserveCreditsForWorkOrder(
  repo: Repository,
  tenantId: string,
  wo: WorkOrderRow,
  actorRef: string,
): Promise<string> {
  const requesterAccount = await ensureAccount(repo, tenantId, 'agent', wo.requester_agent_id);
  const escrowAccount = await ensureAccount(repo, tenantId, 'escrow', wo.id);
  await transfer(
    repo,
    tenantId,
    {
      from_account_id: requesterAccount,
      to_account_id: escrowAccount,
      amount: wo.requested_credits,
      reason_code: 'work_order:reserve',
      idempotency_key: `wo:${wo.id}:reserve`,
    },
    actorRef,
  );
  return escrowAccount;
}

/** escrow → worker agent account. Callers must have checked verified_fact. */
export async function releaseCreditsForWorkOrder(
  repo: Repository,
  tenantId: string,
  wo: WorkOrderRow,
  actorRef: string,
): Promise<void> {
  const workerAccount = await ensureAccount(repo, tenantId, 'agent', wo.worker_agent_id!);
  await transfer(
    repo,
    tenantId,
    {
      from_account_id: wo.escrow_account_id!,
      to_account_id: workerAccount,
      amount: wo.requested_credits,
      reason_code: 'work_order:release',
      idempotency_key: `wo:${wo.id}:release`,
    },
    actorRef,
  );
}

/** escrow → back to the requester agent account. */
export async function refundCreditsForWorkOrder(
  repo: Repository,
  tenantId: string,
  wo: WorkOrderRow,
  actorRef: string,
): Promise<void> {
  const requesterAccount = await ensureAccount(repo, tenantId, 'agent', wo.requester_agent_id);
  await transfer(
    repo,
    tenantId,
    {
      from_account_id: wo.escrow_account_id!,
      to_account_id: requesterAccount,
      amount: wo.requested_credits,
      reason_code: 'work_order:refund',
      idempotency_key: `wo:${wo.id}:refund`,
    },
    actorRef,
  );
}

/**
 * Deliver the work. When a SkillProof skill version is attached, a SIMULATED
 * skill execution order runs and its proof is created (verified_fact about
 * the simulation having run, verified by the lab automation). Otherwise the
 * caller must link an existing proof. proof_required orders cannot be
 * delivered proofless — every delivered work order creates or links proof.
 */
export async function deliverWorkOrder(
  repo: Repository,
  tenantId: string,
  id: string,
  body: unknown,
  actorRef: string,
  traceId: string,
): Promise<WorkOrderView> {
  const input = workOrderDeliver.parse(body ?? {});
  const wo = await getOrThrow(repo, tenantId, id);
  if (wo.status !== 'accepted' && wo.status !== 'in_progress') {
    throw new IllegalWorkOrderTransitionError(wo.status, 'delivered');
  }

  let proofId = input.proof_id ?? null;
  let proof: ProofRow | null = proofId ? await repo.getProof(tenantId, proofId) : null;
  if (proofId && !proof) throw new WorkOrderProofError(`proof not found: ${proofId}`);

  if (wo.skill_version_id) {
    await requireNotYanked(repo, tenantId, wo.skill_version_id);
    await repo.updateWorkOrder(tenantId, id, { status: 'in_progress' });
    const ts = new Date().toISOString();
    const execution = await repo.insertSkillExecutionOrder({
      id: randomUUID(),
      tenant_id: tenantId,
      work_order_id: id,
      worker_agent_id: wo.worker_agent_id!,
      skill_version_id: wo.skill_version_id,
      status: 'running',
      simulation: true,
      result: {},
      proof_id: null,
      started_at: ts,
      finished_at: null,
      created_at: ts,
      updated_at: ts,
    });
    const finished = new Date().toISOString();
    if (!proof) {
      // The execution proof: a verified fact ABOUT the simulation —
      // evidence is the execution record, verifier is the lab automation.
      proof = await createProof(
        repo,
        tenantId,
        {
          kind: 'skill_demo',
          subject_type: 'skill_version',
          subject_id: wo.skill_version_id,
          evidence_tag: 'verified_fact',
          evidence_ref: `execution:${execution.id}`,
          verifier_ref: 'verifier:economy-lab',
          summary_public: 'Simulated skill execution completed in the Agent Economy Lab.',
          details_private: {
            work_order_id: id,
            worker_agent_id: wo.worker_agent_id,
            result_summary: input.result_summary ?? 'simulated execution succeeded',
          },
        },
        actorRef,
        traceId,
      );
      proofId = proof.id;
    }
    await repo.updateSkillExecutionOrder(tenantId, execution.id, {
      status: 'succeeded',
      result: { simulated: true, summary: input.result_summary ?? 'ok' },
      proof_id: proofId,
      finished_at: finished,
    });
  }

  if (!proofId && wo.proof_required) {
    throw new WorkOrderProofError(
      `work order ${id} requires a proof to be delivered — link one or attach a skill version`,
    );
  }

  const updated = await repo.updateWorkOrder(tenantId, id, {
    status: 'delivered',
    proof_id: proofId,
    outcome_type: input.outcome_type,
    evidence_tag: proof ? proof.evidence_tag : null,
  });
  await audit(repo, tenantId, actorRef, 'economy.work_order.delivered.v1', id, {
    proof_id: proofId,
    evidence_tag: proof?.evidence_tag ?? null,
    outcome_type: input.outcome_type,
  });
  return {
    ...updated!,
    executions: await repo.listSkillExecutionOrders(tenantId, id),
    resolution: null,
  };
}

/**
 * Verify delivered work: escrow releases ONLY against a verified_fact proof
 * (checked here, mirrored in memory, and enforced by the 0016 DB trigger).
 * Releasing also books the positive reputation event — the only positive
 * reputation path in the lab.
 */
export async function verifyWorkOrder(
  repo: Repository,
  tenantId: string,
  id: string,
  actorRef: string,
): Promise<WorkOrderRow> {
  const wo = await getOrThrow(repo, tenantId, id);
  if (wo.status !== 'delivered') {
    throw new IllegalWorkOrderTransitionError(wo.status, 'verified');
  }
  if (!wo.proof_id) throw new EscrowReleaseRefusedError('no proof linked');
  const proof = await repo.getProof(tenantId, wo.proof_id);
  if (!proof || proof.evidence_tag !== 'verified_fact') {
    throw new EscrowReleaseRefusedError(
      `escrow release requires a verified_fact proof (got ${proof?.evidence_tag ?? 'none'})`,
    );
  }

  await releaseCreditsForWorkOrder(repo, tenantId, wo, actorRef);
  const updated = await repo.updateWorkOrder(tenantId, id, {
    status: 'verified',
    escrow_status: 'released',
    evidence_tag: 'verified_fact',
  });
  // Positive reputation: verified_fact proof only (0010 trigger backs this).
  await repo.insertReputationEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    agent_id: wo.worker_agent_id!,
    proof_id: wo.proof_id,
    delta: RELEASE_REPUTATION_DELTA,
    reason_code: 'work_order:verified',
    created_at: new Date().toISOString(),
  });
  await audit(repo, tenantId, actorRef, 'economy.work_order.verified.v1', id, {
    escrow: 'released',
    amount: wo.requested_credits,
    proof_id: wo.proof_id,
  });
  return updated!;
}

/** Reject delivered work: escrow refunds, negative reputation is booked. */
export async function rejectWorkOrder(
  repo: Repository,
  tenantId: string,
  id: string,
  body: unknown,
  actorRef: string,
): Promise<WorkOrderRow> {
  const reason = workOrderDecisionReason.parse((body as { reason?: unknown })?.reason ?? body);
  const wo = await getOrThrow(repo, tenantId, id);
  if (wo.status !== 'delivered') {
    throw new IllegalWorkOrderTransitionError(wo.status, 'rejected');
  }
  await refundCreditsForWorkOrder(repo, tenantId, wo, actorRef);
  const updated = await repo.updateWorkOrder(tenantId, id, {
    status: 'rejected',
    escrow_status: 'refunded',
  });
  // Negative deltas are admissible against any proof tag (bad news is always
  // admissible — 0010); skipped when the order carried no proof at all.
  if (wo.proof_id && wo.worker_agent_id) {
    await repo.insertReputationEvent({
      id: randomUUID(),
      tenant_id: tenantId,
      agent_id: wo.worker_agent_id,
      proof_id: wo.proof_id,
      delta: REJECT_REPUTATION_DELTA,
      reason_code: `work_order:rejected:${reason.reason_code}`,
      created_at: new Date().toISOString(),
    });
  }
  await audit(repo, tenantId, actorRef, 'economy.work_order.rejected.v1', id, {
    escrow: 'refunded',
    reason_code: reason.reason_code,
  });
  return updated!;
}

/**
 * Dispute delivered work: escrow is HELD (neither side gets paid), no
 * reputation moves, and the dispute lands as a feedback label. Resolution
 * happens ONLY through resolveWorkOrderDispute (owner arbitration,
 * AGENT-ECONOMY-002) — disputes never silently resolve.
 */
export async function disputeWorkOrder(
  repo: Repository,
  tenantId: string,
  id: string,
  body: unknown,
  actorRef: string,
): Promise<WorkOrderRow> {
  const reason = workOrderDecisionReason.parse((body as { reason?: unknown })?.reason ?? body);
  const wo = await getOrThrow(repo, tenantId, id);
  if (wo.status !== 'delivered') {
    throw new IllegalWorkOrderTransitionError(wo.status, 'disputed');
  }
  const updated = await repo.updateWorkOrder(tenantId, id, {
    status: 'disputed',
    escrow_status: 'disputed',
  });
  const ts = new Date().toISOString();
  await repo.insertFeedbackLabel({
    id: randomUUID(),
    tenant_id: tenantId,
    subject_ref: `work_order:${id}`,
    label: 'disputed',
    detail: { reason_code: reason.reason_code, note: reason.note ?? null },
    created_at: ts,
    updated_at: ts,
  });
  await audit(repo, tenantId, actorRef, 'economy.work_order.disputed.v1', id, {
    escrow: 'held',
    reason_code: reason.reason_code,
  });
  return updated!;
}

/** Cancel before delivery: refunds escrow when one was reserved. Terminal. */
export async function cancelWorkOrder(
  repo: Repository,
  tenantId: string,
  id: string,
  actorRef: string,
): Promise<WorkOrderRow> {
  const wo = await getOrThrow(repo, tenantId, id);
  if (wo.status !== 'proposed' && wo.status !== 'accepted') {
    throw new IllegalWorkOrderTransitionError(wo.status, 'canceled');
  }
  if (wo.escrow_status === 'reserved') {
    await refundCreditsForWorkOrder(repo, tenantId, wo, actorRef);
  }
  const updated = await repo.updateWorkOrder(tenantId, id, {
    status: 'canceled',
    escrow_status: wo.escrow_status === 'reserved' ? 'refunded' : wo.escrow_status,
  });
  await audit(repo, tenantId, actorRef, 'economy.work_order.canceled.v1', id, {
    escrow: wo.escrow_status === 'reserved' ? 'refunded' : 'none',
  });
  return updated!;
}

/**
 * AGENT-ECONOMY-002 — owner-arbitrated dispute resolution. The arbiter
 * decides where HELD escrow goes:
 *
 *   release → everything to the worker;
 *   refund  → everything back to the requester;
 *   split   → explicit conserved amounts (worker + requester = escrow).
 *
 * The decision lands as an append-only dispute_resolutions record and a
 * verified_fact RESOLUTION proof (a fact about the arbitration decision,
 * verified by the arbiter) — the 0017 trigger refuses status=resolved
 * without it. Reputation stays honest: a refund (against the worker) books
 * a negative event; vindication books a positive event ONLY when the
 * underlying DELIVERY proof was verified_fact (0010 rule, never bent);
 * splits move no reputation — partial fault earns nobody credit.
 */
export async function resolveWorkOrderDispute(
  repo: Repository,
  tenantId: string,
  id: string,
  body: unknown,
  actorRef: string,
  traceId: string,
): Promise<WorkOrderView> {
  const input = disputeResolutionCreate.parse(body ?? {});
  const wo = await getOrThrow(repo, tenantId, id);
  if (wo.status !== 'disputed') {
    throw new IllegalWorkOrderTransitionError(wo.status, 'resolved');
  }

  const total = Number(wo.requested_credits);
  const workerCredits =
    input.decision === 'release' ? total : input.decision === 'refund' ? 0 : input.worker_credits!;
  const requesterCredits =
    input.decision === 'release'
      ? 0
      : input.decision === 'refund'
        ? total
        : input.requester_credits!;
  if (workerCredits + requesterCredits !== total) {
    throw new DisputeSplitError(workerCredits, requesterCredits, total);
  }

  // The resolution proof: a verified fact ABOUT the arbitration decision.
  const resolutionId = randomUUID();
  const proof = await createProof(
    repo,
    tenantId,
    {
      kind: 'system',
      subject_type: 'work_order',
      subject_id: id,
      evidence_tag: 'verified_fact',
      evidence_ref: `dispute_resolution:${resolutionId}`,
      verifier_ref: actorRef,
      summary_public: `Dispute resolved by owner arbitration (decision: ${input.decision}).`,
      details_private: {
        decision: input.decision,
        reason_code: input.reason_code,
        note: input.note ?? null,
        worker_credits: workerCredits,
        requester_credits: requesterCredits,
      },
    },
    actorRef,
    traceId,
  );

  // Append the arbitration record while the order is still 'disputed' (the
  // 0017 insert trigger + memory mirror check exactly that, plus the math).
  const resolution = await repo.insertDisputeResolution({
    id: resolutionId,
    tenant_id: tenantId,
    work_order_id: id,
    decision: input.decision,
    reason_code: input.reason_code,
    note: input.note ?? null,
    worker_credits: workerCredits,
    requester_credits: requesterCredits,
    resolved_by: actorRef,
    proof_id: proof.id,
    created_at: new Date().toISOString(),
  });

  // Move the held escrow per the decision (balanced, idempotent, audited
  // pairs — distinct keys from verify/reject so paths can never collide).
  if (workerCredits > 0) {
    const workerAccount = await ensureAccount(repo, tenantId, 'agent', wo.worker_agent_id!);
    await transfer(
      repo,
      tenantId,
      {
        from_account_id: wo.escrow_account_id!,
        to_account_id: workerAccount,
        amount: workerCredits,
        reason_code: `work_order:resolve:${input.decision}`,
        idempotency_key: `wo:${id}:resolve:worker`,
      },
      actorRef,
    );
  }
  if (requesterCredits > 0) {
    const requesterAccount = await ensureAccount(repo, tenantId, 'agent', wo.requester_agent_id);
    await transfer(
      repo,
      tenantId,
      {
        from_account_id: wo.escrow_account_id!,
        to_account_id: requesterAccount,
        amount: requesterCredits,
        reason_code: `work_order:resolve:${input.decision}`,
        idempotency_key: `wo:${id}:resolve:requester`,
      },
      actorRef,
    );
  }

  const updated = await repo.updateWorkOrder(tenantId, id, {
    status: 'resolved',
    escrow_status: 'resolved',
    resolution_proof_id: proof.id,
  });

  // Reputation semantics (see doc comment above).
  if (wo.worker_agent_id) {
    if (input.decision === 'refund') {
      await repo.insertReputationEvent({
        id: randomUUID(),
        tenant_id: tenantId,
        agent_id: wo.worker_agent_id,
        proof_id: wo.proof_id ?? proof.id,
        delta: REJECT_REPUTATION_DELTA,
        reason_code: `work_order:resolved:against_worker:${input.reason_code}`,
        created_at: new Date().toISOString(),
      });
    } else if (input.decision === 'release' && wo.proof_id) {
      const deliveryProof = await repo.getProof(tenantId, wo.proof_id);
      if (deliveryProof?.evidence_tag === 'verified_fact') {
        await repo.insertReputationEvent({
          id: randomUUID(),
          tenant_id: tenantId,
          agent_id: wo.worker_agent_id,
          proof_id: wo.proof_id,
          delta: RELEASE_REPUTATION_DELTA,
          reason_code: 'work_order:resolved:vindicated',
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  await audit(repo, tenantId, actorRef, 'economy.work_order.resolved.v1', id, {
    decision: input.decision,
    reason_code: input.reason_code,
    worker_credits: workerCredits,
    requester_credits: requesterCredits,
    resolution_id: resolution.id,
    proof_id: proof.id,
  });
  return getWorkOrderView(repo, tenantId, id);
}

export async function getWorkOrderView(
  repo: Repository,
  tenantId: string,
  id: string,
): Promise<WorkOrderView> {
  const wo = await getOrThrow(repo, tenantId, id);
  const [executions, resolution] = await Promise.all([
    repo.listSkillExecutionOrders(tenantId, id),
    repo.getDisputeResolutionByWorkOrder(tenantId, id),
  ]);
  return { ...wo, executions, resolution };
}

/**
 * The lab summary — also the internal "marketplace skeleton" read: who can
 * work (agents + reputation), what can be ordered (skills + tiers), what is
 * moving (work orders + escrow), and the locked public-token posture.
 */
export async function buildEconomySummary(repo: Repository, tenantId: string) {
  const [orders, agents, skills, reputationEvents, bindings] = await Promise.all([
    repo.listWorkOrders(tenantId),
    repo.listAgents(tenantId),
    repo.listSkills(tenantId),
    repo.listReputationEvents(tenantId),
    repo.listWalletBindings(tenantId),
  ]);
  const byStatus: Record<string, number> = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  const escrowTotal = (status: string) =>
    orders
      .filter((o) => o.escrow_status === status)
      .reduce((sum, o) => sum + Number(o.requested_credits), 0);
  const economyReputation = reputationEvents.filter((e) => e.reason_code.startsWith('work_order:'));

  return {
    work_orders: { total: orders.length, by_status: byStatus },
    escrow: {
      rail: 'internal_credits',
      reserved_credits: escrowTotal('reserved'),
      released_credits: escrowTotal('released'),
      refunded_credits: escrowTotal('refunded'),
      disputed_credits: escrowTotal('disputed'),
      resolved_credits: escrowTotal('resolved'),
    },
    agents: { total: agents.length },
    skills: { total: skills.length },
    reputation: {
      economy_events: economyReputation.length,
      economy_delta_sum: economyReputation.reduce((sum, e) => sum + Number(e.delta), 0),
    },
    wallet_placeholders: {
      total: bindings.length,
      // Placeholders stay inert: counts only, never keys/chains/activity.
      statuses: bindings.map((b) => b.status),
    },
    token_public_status: 'disabled',
    legal_gate: 'not_passed',
  };
}

export class WorkOrderNotFoundError extends Error {
  constructor(id: string) {
    super(`work order not found: ${id}`);
    this.name = 'WorkOrderNotFoundError';
  }
}
export class IllegalWorkOrderTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`illegal work order transition: ${from} → ${to}`);
    this.name = 'IllegalWorkOrderTransitionError';
  }
}
export class WorkerAtcRequiredError extends Error {
  constructor(agentId: string) {
    super(`agent ${agentId} has no active Agent Trust Credential — cannot accept work`);
    this.name = 'WorkerAtcRequiredError';
  }
}
export class SelfAcceptError extends Error {
  constructor(id: string) {
    super(`work order ${id}: the requester agent cannot accept its own order`);
    this.name = 'SelfAcceptError';
  }
}
export class WorkOrderProofError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkOrderProofError';
  }
}
export class DisputeSplitError extends Error {
  constructor(worker: number, requester: number, total: number) {
    super(
      `dispute split must conserve escrow: worker ${worker} + requester ${requester} != ${total}`,
    );
    this.name = 'DisputeSplitError';
  }
}
export class EscrowReleaseRefusedError extends Error {
  constructor(detail: string) {
    super(`escrow release refused: ${detail}`);
    this.name = 'EscrowReleaseRefusedError';
  }
}
export class SkillVersionNotFoundForWorkError extends Error {
  constructor(id: string) {
    super(`skill version not found: ${id}`);
    this.name = 'SkillVersionNotFoundForWorkError';
  }
}
