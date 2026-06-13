import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import { registerAgent, issueAtc } from './atc.js';
import { openAccount, transfer, getAccountView } from './credits.js';
import { createProof } from './proofs.js';

/**
 * AGENT-ECONOMY-002 — owner-arbitrated dispute resolution. Held escrow can
 * be released to the worker, refunded to the requester, or split with
 * conserved math; every resolution is an append-only record + a
 * verified_fact resolution proof (0017 trigger refuses anything else);
 * reputation stays honest (refund → negative; vindication → positive ONLY
 * when the delivery proof was verified_fact; split → none).
 */

const TENANT = '11111111-1111-1111-1111-111111111111';

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({ tenantId: TENANT, role, traceId: 'trace-dispute', ...over });
const operator = (over: Partial<ApiRequest> = {}) => asRole('operator', over);
const owner = (over: Partial<ApiRequest> = {}) => asRole('owner', over);

interface Lab {
  repo: InMemoryRepository;
  handlers: ApiHandlers;
  requesterId: string;
  workerId: string;
  requesterAccountId: string;
}

async function makeLab(): Promise<Lab> {
  const repo = new InMemoryRepository();
  const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  const actor = 'user:test';
  const { agent: requester } = await registerAgent(
    repo,
    TENANT,
    { name: 'Requester', slug: 'dispute-requester', kind: 'internal_ops' },
    actor,
    'trace-dispute',
  );
  const { agent: worker } = await registerAgent(
    repo,
    TENANT,
    { name: 'Worker', slug: 'dispute-worker', kind: 'internal_ops' },
    actor,
    'trace-dispute',
  );
  await issueAtc(repo, TENANT, worker.id, { claims: {} }, actor, 'trace-dispute');
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
      idempotency_key: 'grant-dispute',
    },
    actor,
  );
  return {
    repo,
    handlers,
    requesterId: requester.id,
    workerId: worker.id,
    requesterAccountId: requesterAccount.id,
  };
}

/** Propose (100 cr) → accept → deliver with the given proof tag → dispute. */
async function disputedOrder(lab: Lab, deliveryTag: 'verified_fact' | 'likely_inference') {
  const created = await lab.handlers.createWorkOrder(
    operator({
      body: {
        requester_agent_id: lab.requesterId,
        title: `Disputed ${deliveryTag} work`,
        requested_credits: 100,
      },
    }),
  );
  const id = (created.body as { work_order: { id: string } }).work_order.id;
  await lab.handlers.acceptWorkOrder(
    operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
  );
  const proof = await createProof(
    lab.repo,
    TENANT,
    {
      kind: 'skill_demo',
      subject_type: 'work_order',
      subject_id: id,
      evidence_tag: deliveryTag,
      ...(deliveryTag === 'verified_fact'
        ? { evidence_ref: `artifact:${id}`, verifier_ref: 'user:test' }
        : {}),
    },
    'user:test',
    'trace-dispute',
  );
  await lab.handlers.deliverWorkOrder(operator({ params: { id }, body: { proof_id: proof.id } }));
  await lab.handlers.disputeWorkOrder(
    operator({ params: { id }, body: { reason: { reason_code: 'quality_contested' } } }),
  );
  return id;
}

async function workerBalance(lab: Lab): Promise<number> {
  const account = (await lab.repo.listCreditsAccounts(TENANT)).find(
    (a) => a.owner_type === 'agent' && a.owner_id === lab.workerId,
  );
  return account ? (await getAccountView(lab.repo, TENANT, account.id)).balance : 0;
}

describe('Dispute resolution (AGENT-ECONOMY-002)', () => {
  let lab: Lab;
  beforeEach(async () => {
    lab = await makeLab();
  });

  it('release: held escrow goes to the worker; vindication books +reputation when delivery was verified_fact', async () => {
    const id = await disputedOrder(lab, 'verified_fact');
    const res = await lab.handlers.resolveWorkOrder(
      owner({ params: { id }, body: { decision: 'release', reason_code: 'work_was_good' } }),
    );
    const wo = (res.body as { work_order: Record<string, unknown> }).work_order;
    expect(wo.status).toBe('resolved');
    expect(wo.escrow_status).toBe('resolved');
    expect(wo.resolution_proof_id).toBeTruthy();
    const resolution = wo.resolution as {
      decision: string;
      worker_credits: number;
      requester_credits: number;
      proof_id: string;
    };
    expect(resolution.decision).toBe('release');
    expect(resolution.worker_credits).toBe(100);
    expect(resolution.requester_credits).toBe(0);
    expect(await workerBalance(lab)).toBe(100);
    // The resolution proof is a verified_fact about the DECISION.
    const proof = await lab.repo.getProof(TENANT, wo.resolution_proof_id as string);
    expect(proof?.evidence_tag).toBe('verified_fact');
    expect(proof?.evidence_ref).toContain('dispute_resolution:');
    // Vindication reputation against the verified delivery proof.
    const events = await lab.repo.listReputationEvents(TENANT, lab.workerId);
    expect(events).toHaveLength(1);
    expect(events[0]!.delta).toBe(3);
    expect(events[0]!.reason_code).toBe('work_order:resolved:vindicated');
    // Audit trail.
    const audits = await lab.repo.listAuditEvents(TENANT);
    expect(audits.some((a) => a.action === 'economy.work_order.resolved.v1')).toBe(true);
  });

  it('release after a weak delivery proof pays the worker but books NO positive reputation', async () => {
    const id = await disputedOrder(lab, 'likely_inference');
    await lab.handlers.resolveWorkOrder(
      owner({ params: { id }, body: { decision: 'release', reason_code: 'benefit_of_doubt' } }),
    );
    expect(await workerBalance(lab)).toBe(100);
    expect(await lab.repo.listReputationEvents(TENANT, lab.workerId)).toHaveLength(0);
  });

  it('refund: held escrow returns to the requester and books negative reputation', async () => {
    const id = await disputedOrder(lab, 'verified_fact');
    await lab.handlers.resolveWorkOrder(
      owner({ params: { id }, body: { decision: 'refund', reason_code: 'spec_not_met' } }),
    );
    expect((await getAccountView(lab.repo, TENANT, lab.requesterAccountId)).balance).toBe(500);
    expect(await workerBalance(lab)).toBe(0);
    const events = await lab.repo.listReputationEvents(TENANT, lab.workerId);
    expect(events).toHaveLength(1);
    expect(events[0]!.delta).toBeLessThan(0);
    expect(events[0]!.reason_code).toBe('work_order:resolved:against_worker:spec_not_met');
  });

  it('split: conserved amounts settle both sides and move NO reputation; ledger is conserved', async () => {
    const id = await disputedOrder(lab, 'verified_fact');
    const res = await lab.handlers.resolveWorkOrder(
      owner({
        params: { id },
        body: {
          decision: 'split',
          reason_code: 'partial_delivery',
          worker_credits: 60,
          requester_credits: 40,
        },
      }),
    );
    const resolution = (res.body as { work_order: { resolution: Record<string, number> } })
      .work_order.resolution;
    expect(resolution.worker_credits).toBe(60);
    expect(resolution.requester_credits).toBe(40);
    expect(await workerBalance(lab)).toBe(60);
    expect((await getAccountView(lab.repo, TENANT, lab.requesterAccountId)).balance).toBe(440);
    expect(await lab.repo.listReputationEvents(TENANT, lab.workerId)).toHaveLength(0);
    // Conservation: the escrow account ends empty.
    const escrowId = (await lab.repo.getWorkOrder(TENANT, id))!.escrow_account_id!;
    expect((await getAccountView(lab.repo, TENANT, escrowId)).balance).toBe(0);
  });

  it('split math must conserve escrow (422); split requires both amounts (400)', async () => {
    const id = await disputedOrder(lab, 'verified_fact');
    await expect(
      lab.handlers.resolveWorkOrder(
        owner({
          params: { id },
          body: {
            decision: 'split',
            reason_code: 'partial',
            worker_credits: 60,
            requester_credits: 50,
          },
        }),
      ),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      lab.handlers.resolveWorkOrder(
        owner({ params: { id }, body: { decision: 'split', reason_code: 'partial' } }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('resolution is owner-only, only from disputed, and terminal', async () => {
    const id = await disputedOrder(lab, 'verified_fact');
    await expect(
      lab.handlers.resolveWorkOrder(
        operator({ params: { id }, body: { decision: 'release', reason_code: 'x' } }),
      ),
    ).rejects.toMatchObject({ status: 403 });

    // A merely-delivered order cannot be resolved.
    const created = await lab.handlers.createWorkOrder(
      operator({
        body: { requester_agent_id: lab.requesterId, title: 'Undisputed', requested_credits: 50 },
      }),
    );
    const undisputedId = (created.body as { work_order: { id: string } }).work_order.id;
    await expect(
      lab.handlers.resolveWorkOrder(
        owner({ params: { id: undisputedId }, body: { decision: 'refund', reason_code: 'x' } }),
      ),
    ).rejects.toMatchObject({ status: 409 });

    // Resolved is terminal: a second arbitration is refused.
    await lab.handlers.resolveWorkOrder(
      owner({ params: { id }, body: { decision: 'refund', reason_code: 'spec_not_met' } }),
    );
    await expect(
      lab.handlers.resolveWorkOrder(
        owner({ params: { id }, body: { decision: 'release', reason_code: 'changed_mind' } }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      lab.handlers.disputeWorkOrder(
        operator({ params: { id }, body: { reason: { reason_code: 'again' } } }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('summary accounts for resolved escrow; the resolution record is on the work-order view', async () => {
    const id = await disputedOrder(lab, 'verified_fact');
    await lab.handlers.resolveWorkOrder(
      owner({
        params: { id },
        body: {
          decision: 'split',
          reason_code: 'partial_delivery',
          worker_credits: 50,
          requester_credits: 50,
        },
      }),
    );
    const summary = (await lab.handlers.economySummary(operator())).body as {
      work_orders: { by_status: Record<string, number> };
      escrow: Record<string, number | string>;
    };
    expect(summary.work_orders.by_status.resolved).toBe(1);
    expect(summary.escrow.resolved_credits).toBe(100);
    const view = (await lab.handlers.getWorkOrder(operator({ params: { id } }))).body as {
      resolution: { decision: string; reason_code: string } | null;
    };
    expect(view.resolution?.decision).toBe('split');
    expect(view.resolution?.reason_code).toBe('partial_delivery');
  });
});
