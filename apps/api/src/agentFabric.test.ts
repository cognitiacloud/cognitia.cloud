import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import { registerAgent, issueAtc } from './atc.js';
import { openAccount, transfer, getAccountView } from './credits.js';

/**
 * LEGEND-001 — Agent Fabric Lab. Routing + SIMULATED execution wired into the
 * existing Agent Economy: a fabric node "runs" a work order (in-process
 * simulation only), records a verified_fact receipt proof, delivers via the
 * economy path; a human verify then releases escrow + reputation. Quarantine is
 * the per-node kill switch. No network, no remote execution.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const operator = (over: Partial<ApiRequest> = {}): ApiRequest => ({
  tenantId: TENANT,
  role: 'operator',
  traceId: 'trace-fabric',
  ...over,
});
const owner = (over: Partial<ApiRequest> = {}): ApiRequest => ({
  tenantId: TENANT,
  role: 'owner',
  traceId: 'trace-fabric',
  ...over,
});

interface Lab {
  repo: InMemoryRepository;
  handlers: ApiHandlers;
  requesterId: string;
  workerId: string;
  skillVersionId: string;
  requesterAccountId: string;
}

async function makeLab(): Promise<Lab> {
  const repo = new InMemoryRepository();
  const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  const actor = 'user:test';
  const trace = 'trace-fabric';
  const { agent: requester } = await registerAgent(
    repo,
    TENANT,
    { name: 'Requester', slug: 'fab-requester', kind: 'internal_ops' },
    actor,
    trace,
  );
  const { agent: worker } = await registerAgent(
    repo,
    TENANT,
    { name: 'Worker', slug: 'fab-worker', kind: 'internal_ops' },
    actor,
    trace,
  );
  await issueAtc(repo, TENANT, worker.id, { claims: {} }, actor, trace);
  const ts = new Date().toISOString();
  const skill = await repo.upsertSkill({
    id: randomUUID(),
    tenant_id: TENANT,
    name: 'Research Brief',
    slug: `research-brief-${randomUUID().slice(0, 8)}`,
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
    skillVersionId: version.id,
    requesterAccountId: requesterAccount.id,
  };
}

async function acceptedOrder(lab: Lab): Promise<string> {
  const created = await lab.handlers.createWorkOrder(
    operator({
      body: {
        requester_agent_id: lab.requesterId,
        title: 'Fabric-routed work',
        skill_version_id: lab.skillVersionId,
        requested_credits: 100,
      },
    }),
  );
  const id = (created.body as { work_order: { id: string } }).work_order.id;
  await lab.handlers.acceptWorkOrder(
    operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
  );
  return id;
}

async function registerNode(
  lab: Lab,
  over: Record<string, unknown> = {},
): Promise<{ status: number; body: unknown }> {
  return lab.handlers.registerFabricNode(
    operator({
      body: {
        agent_id: lab.workerId,
        label: 'mac-mini-1',
        platform: 'macos',
        capabilities: [{ skill: 'code.test.run', tier: 2 }],
        ...over,
      },
    }),
  );
}

describe('Agent Fabric Lab (LEGEND-001)', () => {
  let lab: Lab;
  beforeEach(async () => {
    lab = await makeLab();
  });

  it('registers a node and validates platform + agent existence', async () => {
    const res = await registerNode(lab);
    expect(res.status).toBe(201);
    const node = (res.body as { node: { id: string; status: string } }).node;
    expect(node.status).toBe('active');
    // Bad platform → 400.
    await expect(registerNode(lab, { label: 'x', platform: 'toaster' })).rejects.toMatchObject({
      status: 400,
    });
    // Unknown agent → 404.
    await expect(registerNode(lab, { label: 'y', agent_id: randomUUID() })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('routes to an eligible active node, excludes ineligible + quarantined (fail-closed)', async () => {
    await registerNode(lab); // tier-2 node for code.test.run
    // A second node that only declares a lower tier.
    await registerNode(lab, {
      label: 'linux-box',
      platform: 'linux',
      capabilities: [{ skill: 'code.test.run', tier: 1 }],
    });

    const decision = (
      await lab.handlers.routeFabricWorkOrder(
        operator({ query: { skill: 'code.test.run', min_tier: '2' } }),
      )
    ).body as { chosen: { label: string } | null; candidates: unknown[] };
    expect(decision.chosen?.label).toBe('mac-mini-1');
    expect(decision.candidates.length).toBe(2);

    // No node declares this skill → fail-closed (chosen null).
    const none = (
      await lab.handlers.routeFabricWorkOrder(operator({ query: { skill: 'nonexistent.skill' } }))
    ).body as { chosen: unknown };
    expect(none.chosen).toBeNull();
  });

  it('full loop: route → simulate-execute (delivers w/ verified_fact receipt) → verify releases escrow', async () => {
    const nodeRes = await registerNode(lab);
    const nodeId = (nodeRes.body as { node: { id: string } }).node.id;
    const id = await acceptedOrder(lab);

    // Escrow reserved on accept.
    const beforeReq = await getAccountView(lab.repo, TENANT, lab.requesterAccountId);
    expect(beforeReq.balance).toBe(400);

    // Simulated execution delivers the work order with a fabric receipt proof.
    const exec = await lab.handlers.simulateFabricExecute(
      operator({ body: { node_id: nodeId, work_order_id: id } }),
    );
    expect(exec.status).toBe(201);
    const execBody = exec.body as {
      proof_id: string;
      work_order: { status: string; evidence_tag: string };
    };
    expect(execBody.proof_id).toBeTruthy();
    expect(execBody.work_order.status).toBe('delivered');
    expect(execBody.work_order.evidence_tag).toBe('verified_fact');

    // The receipt proof is a verified_fact with a fabric-node evidence ref.
    const proof = await lab.repo.getProof(TENANT, execBody.proof_id);
    expect(proof?.evidence_tag).toBe('verified_fact');
    expect(proof?.evidence_ref).toMatch(/^fabric-node:/);

    // Human verify (owner-gated) releases escrow + books reputation — NOT the fabric.
    const verified = await lab.handlers.verifyWorkOrder(owner({ params: { id } }));
    expect(
      (verified.body as { work_order: { escrow_status: string } }).work_order.escrow_status,
    ).toBe('released');
    const repEvents = await lab.repo.listReputationEvents(TENANT, lab.workerId);
    expect(repEvents.some((e) => Number(e.delta) > 0)).toBe(true);
  });

  it('quarantine is the per-node kill switch: no routing, no execution', async () => {
    const nodeRes = await registerNode(lab);
    const nodeId = (nodeRes.body as { node: { id: string } }).node.id;
    const id = await acceptedOrder(lab);

    await lab.handlers.setFabricNodeStatus(operator({ params: { id: nodeId } }), 'quarantined');

    // Quarantined node is excluded from routing.
    const decision = (
      await lab.handlers.routeFabricWorkOrder(
        operator({ query: { skill: 'code.test.run', min_tier: '2' } }),
      )
    ).body as { chosen: unknown };
    expect(decision.chosen).toBeNull();

    // And cannot execute → 409.
    await expect(
      lab.handlers.simulateFabricExecute(
        operator({ body: { node_id: nodeId, work_order_id: id } }),
      ),
    ).rejects.toMatchObject({ status: 409 });

    // Restore re-enables it.
    await lab.handlers.setFabricNodeStatus(operator({ params: { id: nodeId } }), 'active');
    const after = (
      await lab.handlers.routeFabricWorkOrder(
        operator({ query: { skill: 'code.test.run', min_tier: '2' } }),
      )
    ).body as { chosen: { node_id: string } | null };
    expect(after.chosen?.node_id).toBe(nodeId);
  });
});
