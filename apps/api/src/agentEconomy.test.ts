import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import { registerAgent, issueAtc } from './atc.js';
import { openAccount, transfer, getAccountView } from './credits.js';
import { createProof } from './proofs.js';

/**
 * AGENT-ECONOMY-001 — Agent Economy Lab. The closed loop on the existing
 * primitives: agent requests work → another agent (active ATC) accepts →
 * internal credits RESERVED into escrow → simulated skill execution →
 * proof → escrow released/refunded/disputed → reputation only on
 * verified_fact. Internal credits only; simulation only; no public surface.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({ tenantId: TENANT, role, traceId: 'trace-economy', ...over });
const operator = (over: Partial<ApiRequest> = {}) => asRole('operator', over);
const owner = (over: Partial<ApiRequest> = {}) => asRole('owner', over);

interface Lab {
  repo: InMemoryRepository;
  handlers: ApiHandlers;
  requesterId: string;
  workerId: string;
  noAtcAgentId: string;
  skillVersionId: string;
  requesterAccountId: string;
}

/** Two agents (worker holds an active ATC), one active skill version, and a
 *  500-credit grant from the system treasury to the requester agent. */
async function makeLab(): Promise<Lab> {
  const repo = new InMemoryRepository();
  const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  const actor = 'user:test';
  const trace = 'trace-economy';

  const { agent: requester } = await registerAgent(
    repo,
    TENANT,
    { name: 'Requester Agent', slug: 'requester-agent', kind: 'internal_ops' },
    actor,
    trace,
  );
  const { agent: worker } = await registerAgent(
    repo,
    TENANT,
    { name: 'Worker Agent', slug: 'worker-agent', kind: 'internal_ops' },
    actor,
    trace,
  );
  await issueAtc(repo, TENANT, worker.id, { claims: { scope: ['skill.execute'] } }, actor, trace);
  const { agent: noAtc } = await registerAgent(
    repo,
    TENANT,
    { name: 'Uncredentialed Agent', slug: 'uncredentialed-agent', kind: 'other' },
    actor,
    trace,
  );

  const ts = new Date().toISOString();
  const skill = await repo.upsertSkill({
    id: randomUUID(),
    tenant_id: TENANT,
    name: 'Research Brief',
    slug: 'research-brief',
    category: 'analysis',
    description: null,
    visibility: 'internal',
    namespace: 'cognitia.core',
    source_path: null,
    owner_agent_id: worker.id,
    created_at: ts,
    updated_at: ts,
  });
  const version = await repo.insertSkillVersion({
    id: randomUUID(),
    tenant_id: TENANT,
    skill_id: skill.id,
    version: '1.0.0',
    spec: {},
    status: 'active',
    manifest_hash: null,
    content_hash: null,
    metadata: {},
    proof_tier: 0,
    yanked: false,
    yank_reason: null,
    created_at: ts,
    updated_at: ts,
  });

  // Fund the requester from the system treasury (the internal grant source).
  const treasury = await openAccount(
    repo,
    TENANT,
    { owner_type: 'system', owner_id: randomUUID() },
    actor,
  );
  const requesterAccount = await openAccount(
    repo,
    TENANT,
    { owner_type: 'agent', owner_id: requester.id },
    actor,
  );
  await transfer(
    repo,
    TENANT,
    {
      from_account_id: treasury.id,
      to_account_id: requesterAccount.id,
      amount: 500,
      reason_code: 'grant',
      idempotency_key: 'grant-1',
    },
    actor,
  );

  return {
    repo,
    handlers,
    requesterId: requester.id,
    workerId: worker.id,
    noAtcAgentId: noAtc.id,
    skillVersionId: version.id,
    requesterAccountId: requesterAccount.id,
  };
}

const createOrder = (lab: Lab, over: Record<string, unknown> = {}) =>
  lab.handlers.createWorkOrder(
    operator({
      body: {
        requester_agent_id: lab.requesterId,
        title: 'Produce an evidence-tagged research brief',
        skill_version_id: lab.skillVersionId,
        requested_credits: 100,
        ...over,
      },
    }),
  );
const orderId = (res: { body: unknown }) =>
  (res.body as { work_order: { id: string } }).work_order.id;

describe('Agent Economy Lab (AGENT-ECONOMY-001)', () => {
  let lab: Lab;
  beforeEach(async () => {
    lab = await makeLab();
  });

  it('runs the full loop: propose → accept (escrow reserved) → deliver (simulated execution + proof) → verify (release + reputation)', async () => {
    const id = orderId(await createOrder(lab));

    // Accept: trust-gated, reserves 100 credits into escrow.
    const accepted = await lab.handlers.acceptWorkOrder(
      operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
    );
    const acceptedOrder = (accepted.body as { work_order: Record<string, unknown> }).work_order;
    expect(acceptedOrder.status).toBe('accepted');
    expect(acceptedOrder.escrow_status).toBe('reserved');
    expect((await getAccountView(lab.repo, TENANT, lab.requesterAccountId)).balance).toBe(400);
    const escrowView = await getAccountView(
      lab.repo,
      TENANT,
      acceptedOrder.escrow_account_id as string,
    );
    expect(escrowView.owner_type).toBe('escrow');
    expect(escrowView.balance).toBe(100);

    // Deliver: a SIMULATED skill execution runs and creates the proof.
    const delivered = await lab.handlers.deliverWorkOrder(
      operator({ params: { id }, body: { result_summary: 'brief produced' } }),
    );
    const deliveredOrder = delivered.body as {
      work_order: {
        status: string;
        proof_id: string;
        evidence_tag: string;
        executions: Array<{ status: string; simulation: boolean; proof_id: string }>;
      };
    };
    expect(deliveredOrder.work_order.status).toBe('delivered');
    expect(deliveredOrder.work_order.proof_id).toBeTruthy();
    expect(deliveredOrder.work_order.evidence_tag).toBe('verified_fact');
    expect(deliveredOrder.work_order.executions).toHaveLength(1);
    expect(deliveredOrder.work_order.executions[0]!.simulation).toBe(true);
    expect(deliveredOrder.work_order.executions[0]!.status).toBe('succeeded');
    // The execution proof links the skill version (subject) + worker (details).
    const proof = await lab.repo.getProof(TENANT, deliveredOrder.work_order.proof_id);
    expect(proof?.subject_type).toBe('skill_version');
    expect(proof?.subject_id).toBe(lab.skillVersionId);
    expect(proof?.verifier_ref).toBe('verifier:economy-lab');

    // Verify (owner): escrow releases to the worker; reputation moves.
    const verified = await lab.handlers.verifyWorkOrder(owner({ params: { id } }));
    const verifiedOrder = (verified.body as { work_order: Record<string, unknown> }).work_order;
    expect(verifiedOrder.status).toBe('verified');
    expect(verifiedOrder.escrow_status).toBe('released');
    const workerAccounts = await lab.repo.listCreditsAccounts(TENANT);
    const workerAccount = workerAccounts.find(
      (a) => a.owner_type === 'agent' && a.owner_id === lab.workerId,
    )!;
    expect((await getAccountView(lab.repo, TENANT, workerAccount.id)).balance).toBe(100);
    const reputation = await lab.repo.listReputationEvents(TENANT, lab.workerId);
    expect(reputation).toHaveLength(1);
    expect(reputation[0]!.delta).toBe(3);
    expect(reputation[0]!.reason_code).toBe('work_order:verified');

    // Terminal: nothing moves a verified order again.
    await expect(lab.handlers.cancelWorkOrder(operator({ params: { id } }))).rejects.toMatchObject({
      status: 409,
    });
  });

  it('escrow does NOT release on likely_inference or unknown proofs — and reputation does not move', async () => {
    for (const tag of ['likely_inference', 'unknown'] as const) {
      const id = orderId(await createOrder(lab, { skill_version_id: undefined }));
      await lab.handlers.acceptWorkOrder(
        operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
      );
      const weakProof = await createProof(
        lab.repo,
        TENANT,
        {
          kind: 'skill_demo',
          subject_type: 'work_order',
          subject_id: id,
          evidence_tag: tag,
        },
        'user:test',
        'trace-economy',
      );
      await lab.handlers.deliverWorkOrder(
        operator({ params: { id }, body: { proof_id: weakProof.id } }),
      );
      await expect(lab.handlers.verifyWorkOrder(owner({ params: { id } }))).rejects.toMatchObject({
        status: 409,
      });
      // Order remains delivered; escrow remains reserved; no reputation.
      const view = await lab.handlers.getWorkOrder(operator({ params: { id } }));
      expect((view.body as { status: string; escrow_status: string }).status).toBe('delivered');
      expect((view.body as { escrow_status: string }).escrow_status).toBe('reserved');
    }
    expect(await lab.repo.listReputationEvents(TENANT, lab.workerId)).toHaveLength(0);
  });

  it('delivery requires a proof: proof_required orders without skill or linked proof are refused', async () => {
    const id = orderId(await createOrder(lab, { skill_version_id: undefined }));
    await lab.handlers.acceptWorkOrder(
      operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
    );
    await expect(
      lab.handlers.deliverWorkOrder(operator({ params: { id }, body: {} })),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('acceptance is trust-gated: no active ATC → 403; self-acceptance → 409', async () => {
    const id = orderId(await createOrder(lab));
    await expect(
      lab.handlers.acceptWorkOrder(
        operator({ params: { id }, body: { worker_agent_id: lab.noAtcAgentId } }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      lab.handlers.acceptWorkOrder(
        operator({ params: { id }, body: { worker_agent_id: lab.requesterId } }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('insufficient credits block acceptance (only system accounts may go negative)', async () => {
    const id = orderId(await createOrder(lab, { requested_credits: 10_000 }));
    await expect(
      lab.handlers.acceptWorkOrder(
        operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('rejection refunds escrow and books NEGATIVE reputation; disputes hold escrow and move none', async () => {
    // Reject path.
    const rejectId = orderId(await createOrder(lab));
    await lab.handlers.acceptWorkOrder(
      operator({ params: { id: rejectId }, body: { worker_agent_id: lab.workerId } }),
    );
    await lab.handlers.deliverWorkOrder(operator({ params: { id: rejectId }, body: {} }));
    const rejected = await lab.handlers.rejectWorkOrder(
      operator({ params: { id: rejectId }, body: { reason: { reason_code: 'spec_not_met' } } }),
    );
    expect(
      (rejected.body as { work_order: { escrow_status: string } }).work_order.escrow_status,
    ).toBe('refunded');
    expect((await getAccountView(lab.repo, TENANT, lab.requesterAccountId)).balance).toBe(500);
    const afterReject = await lab.repo.listReputationEvents(TENANT, lab.workerId);
    expect(afterReject).toHaveLength(1);
    expect(afterReject[0]!.delta).toBeLessThan(0);

    // Dispute path: escrow held, no NEW reputation, feedback label recorded.
    const disputeId = orderId(await createOrder(lab));
    await lab.handlers.acceptWorkOrder(
      operator({ params: { id: disputeId }, body: { worker_agent_id: lab.workerId } }),
    );
    await lab.handlers.deliverWorkOrder(operator({ params: { id: disputeId }, body: {} }));
    const disputed = await lab.handlers.disputeWorkOrder(
      operator({
        params: { id: disputeId },
        body: { reason: { reason_code: 'quality_contested' } },
      }),
    );
    expect(
      (disputed.body as { work_order: { escrow_status: string } }).work_order.escrow_status,
    ).toBe('disputed');
    expect(await lab.repo.listReputationEvents(TENANT, lab.workerId)).toHaveLength(1); // unchanged
    const labels = await lab.repo.listFeedbackLabels(TENANT, `work_order:${disputeId}`);
    expect(labels.map((l) => l.label)).toContain('disputed');
    // No positive reputation came out of either path.
    expect(
      (await lab.repo.listReputationEvents(TENANT, lab.workerId)).every((e) => e.delta < 0),
    ).toBe(true);
  });

  it('yanked skill versions take no new work', async () => {
    await lab.repo.yankSkillVersion(TENANT, lab.skillVersionId, 'broken output');
    await expect(createOrder(lab)).rejects.toMatchObject({ status: 409 });
  });

  it('cancellation refunds reserved escrow and is terminal', async () => {
    const id = orderId(await createOrder(lab));
    await lab.handlers.acceptWorkOrder(
      operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
    );
    const canceled = await lab.handlers.cancelWorkOrder(operator({ params: { id } }));
    expect(
      (canceled.body as { work_order: { escrow_status: string } }).work_order.escrow_status,
    ).toBe('refunded');
    expect((await getAccountView(lab.repo, TENANT, lab.requesterAccountId)).balance).toBe(500);
    await expect(
      lab.handlers.acceptWorkOrder(
        operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('RBAC + isolation: viewer cannot write, verification is owner-only, other tenants see nothing', async () => {
    const id = orderId(await createOrder(lab));
    await expect(
      lab.handlers.createWorkOrder(asRole('viewer', { body: {} })),
    ).rejects.toMatchObject({ status: 403 });
    await lab.handlers.acceptWorkOrder(
      operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
    );
    await lab.handlers.deliverWorkOrder(operator({ params: { id }, body: {} }));
    await expect(lab.handlers.verifyWorkOrder(operator({ params: { id } }))).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      lab.handlers.getWorkOrder(operator({ tenantId: TENANT_B, params: { id } })),
    ).rejects.toMatchObject({ status: 404 });
    const otherSummary = await lab.handlers.economySummary(operator({ tenantId: TENANT_B }));
    expect((otherSummary.body as { work_orders: { total: number } }).work_orders.total).toBe(0);
  });

  it('summary reports the lab state with the public-token posture locked', async () => {
    const id = orderId(await createOrder(lab));
    await lab.handlers.acceptWorkOrder(
      operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
    );
    const summary = (await lab.handlers.economySummary(operator())).body as {
      work_orders: { total: number; by_status: Record<string, number> };
      escrow: Record<string, unknown>;
      token_public_status: string;
      legal_gate: string;
    };
    expect(summary.work_orders.total).toBe(1);
    expect(summary.work_orders.by_status.accepted).toBe(1);
    expect(summary.escrow.rail).toBe('internal_credits');
    expect(summary.escrow.reserved_credits).toBe(100);
    expect(summary.token_public_status).toBe('disabled');
    expect(summary.legal_gate).toBe('not_passed');
  });

  it('no real-payment or token-transfer route exists on the economy surface (#doctrine)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const serverSource = readFileSync(join(here, 'server.ts'), 'utf8');
    const routes = [...serverSource.matchAll(/app\.(?:get|post|put|delete)\('([^']+)'/g)].map(
      (m) => m[1]!,
    );
    expect(routes).toContain('/agent-economy/work-orders');
    expect(routes).toContain('/agent-economy/summary');
    const banned = ['pay', 'payment', 'payout', 'withdraw', 'swap', 'stake'];
    const tokenTransfer = ['token', 'transfer'].join('-'); // assembled, never a literal route
    for (const route of routes) {
      for (const word of banned) {
        expect(route.toLowerCase()).not.toContain(word);
      }
      expect(route.toLowerCase()).not.toContain(tokenTransfer);
    }
    // The ONLY transfer route is the internal credits ledger (rail-locked).
    expect(routes.filter((r) => r.includes('transfer'))).toEqual(['/credits/transfer']);
  });
});
