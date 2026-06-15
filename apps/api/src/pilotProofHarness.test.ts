import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import { registerAgent, issueAtc } from './atc.js';
import { openAccount, transfer, getAccountView } from './credits.js';
import { createProof } from './proofs.js';
import { ECONOMY_PERMISSION_KEYS } from './agentEconomyActions.js';

/**
 * PILOT-001 (mainline) — Tenant Zero / Demandara proof harness.
 *
 * This rehearses the human and AI-agent operation paths through Cognitia using
 * the REAL mainline primitives — ATC, Proof Registry, SkillProof, Reputation,
 * the Credits ledger, Work Orders, the simulated Escrow, Dispute Resolution,
 * the Agent Action Ledger, the Internal Marketplace, the Agent Fabric Lab, and
 * the public `/public/trust-feed`. It deliberately builds NO parallel system:
 * every step goes through `ApiHandlers` and the existing services, so the
 * harness proves the actual stack, not a stand-in.
 *
 * Safety posture (asserted, not assumed): internal credits are the only rail;
 * escrow releases only on a verified_fact proof; agents propose but never
 * self-approve / verify / release; the fabric executes nothing for real; the
 * public feed is safe-empty unless a tenant is configured server-side. No
 * production DB, no real SMS, no real payments, no token, no external API
 * credentials, no remote execution.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const PUBLIC_TENANT_ENV = 'COGNITIA_PUBLIC_TENANT_ID';

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({ tenantId: TENANT, role, traceId: 'trace-pilot-001', ...over });
const operator = (over: Partial<ApiRequest> = {}) => asRole('operator', over);
const owner = (over: Partial<ApiRequest> = {}) => asRole('owner', over);

interface Lab {
  repo: InMemoryRepository;
  handlers: ApiHandlers;
  requesterId: string;
  workerId: string;
  skillId: string;
  skillVersionId: string;
  requesterAccountId: string;
  workerAccountId: string;
}

/** Grant the worker the explicit, approval-gated economy permissions. */
async function grantEconomyPermissions(repo: InMemoryRepository, agentId: string): Promise<void> {
  const ts = new Date().toISOString();
  for (const key of [
    ECONOMY_PERMISSION_KEYS.accept,
    ECONOMY_PERMISSION_KEYS.deliver,
    ECONOMY_PERMISSION_KEYS.dispute,
  ]) {
    await repo.upsertAgentPermission({
      id: randomUUID(),
      tenant_id: TENANT,
      agent_id: agentId,
      action_key: key,
      effect: 'allow',
      constraints: { requires_human_approval: true },
      created_at: ts,
      updated_at: ts,
    });
  }
}

/**
 * Two agents (worker holds an active ATC + economy permissions), one active
 * skill version owned by the worker, and a 500-credit grant to the requester
 * from the system treasury. Mirrors the existing economy-lab test fixtures so
 * the harness rides the same fixtures the mainline tests trust.
 */
async function makeLab(): Promise<Lab> {
  const repo = new InMemoryRepository();
  const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  const actor = 'user:pilot';
  const trace = 'trace-pilot-001';

  const { agent: requester } = await registerAgent(
    repo,
    TENANT,
    { name: 'Requester Agent', slug: 'pilot-requester', kind: 'internal_ops' },
    actor,
    trace,
  );
  const { agent: worker } = await registerAgent(
    repo,
    TENANT,
    { name: 'Worker Agent', slug: 'pilot-worker', kind: 'internal_ops' },
    actor,
    trace,
  );
  await issueAtc(repo, TENANT, worker.id, { claims: { scope: ['skill.execute'] } }, actor, trace);
  await grantEconomyPermissions(repo, worker.id);

  const ts = new Date().toISOString();
  const skill = await repo.upsertSkill({
    id: randomUUID(),
    tenant_id: TENANT,
    name: 'Research Brief',
    slug: `pilot-research-brief-${randomUUID().slice(0, 8)}`,
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
  const workerAccount = await openAccount(
    repo,
    TENANT,
    { owner_type: 'agent', owner_id: worker.id },
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
      idempotency_key: 'grant-pilot',
    },
    actor,
  );

  return {
    repo,
    handlers,
    requesterId: requester.id,
    workerId: worker.id,
    skillId: skill.id,
    skillVersionId: version.id,
    requesterAccountId: requesterAccount.id,
    workerAccountId: workerAccount.id,
  };
}

const orderId = (res: { body: unknown }) =>
  (res.body as { work_order: { id: string } }).work_order.id;
const actionId = (res: { body: unknown }) => (res.body as { action: { id: string } }).action.id;
const balance = (lab: Lab, accountId: string) =>
  getAccountView(lab.repo, TENANT, accountId).then((v) => v.balance);
const reputationCodes = (lab: Lab, agentId: string) =>
  lab.repo.listReputationEvents(TENANT, agentId).then((es) => es.map((e) => e.reason_code));

/** Create a direct work order (operator), optionally skill-less / repriced. */
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

const approve = (lab: Lab, id: string) =>
  lab.handlers.approveAction(
    operator({ params: { id }, body: { reason: { reason_code: 'meets_playbook' } } }),
  );

describe('PILOT-001 mainline proof harness', () => {
  let lab: Lab;
  beforeEach(async () => {
    lab = await makeLab();
  });
  afterEach(() => {
    delete process.env[PUBLIC_TENANT_ENV];
  });

  // --- Scenario 1: human operator path (marketplace → escrow → proof → release)
  it('human operator path: marketplace listing → work order → escrow → verified release + reputation', async () => {
    // Internal Marketplace listing for the worker's skill version.
    const listingRes = await lab.handlers.createMarketplaceListing(
      operator({
        body: {
          agent_id: lab.workerId,
          skill_version_id: lab.skillVersionId,
          price_credits: 100,
          summary: 'Research brief, internal only',
        },
      }),
    );
    expect(listingRes.status).toBe(201);
    const listingId = (listingRes.body as { listing: { id: string; visibility: string } }).listing
      .id;
    expect((listingRes.body as { listing: { visibility: string } }).listing.visibility).toBe(
      'internal',
    );

    // Order straight off the listing (price + skill come from the listing).
    const orderRes = await lab.handlers.orderFromListing(
      operator({
        params: { id: listingId },
        body: { requester_agent_id: lab.requesterId, file_accept_ask: false },
      }),
    );
    expect(orderRes.status).toBe(201);
    const id = orderId(orderRes);

    // Accept reserves credits into the work-order escrow (one balanced pair).
    const accepted = await lab.handlers.acceptWorkOrder(
      operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
    );
    const acceptedWo = (accepted.body as { work_order: Record<string, unknown> }).work_order;
    expect(acceptedWo.status).toBe('accepted');
    expect(acceptedWo.escrow_status).toBe('reserved');
    expect(await balance(lab, lab.requesterAccountId)).toBe(400);

    // Deliver: the simulated skill execution produces a verified_fact proof.
    const delivered = await lab.handlers.deliverWorkOrder(
      operator({ params: { id }, body: { result_summary: 'brief produced' } }),
    );
    const deliveredWo = (delivered.body as { work_order: { status: string; evidence_tag: string } })
      .work_order;
    expect(deliveredWo.status).toBe('delivered');
    expect(deliveredWo.evidence_tag).toBe('verified_fact');

    // Owner verify releases escrow to the worker and books reputation.
    const verified = await lab.handlers.verifyWorkOrder(owner({ params: { id } }));
    const verifiedWo = (verified.body as { work_order: { status: string; escrow_status: string } })
      .work_order;
    expect(verifiedWo.status).toBe('verified');
    expect(verifiedWo.escrow_status).toBe('released');
    expect(await balance(lab, lab.workerAccountId)).toBe(100);
    expect(await balance(lab, lab.requesterAccountId)).toBe(400);
    expect(await reputationCodes(lab, lab.workerId)).toEqual(['work_order:verified']);

    const audits = (await lab.repo.listAuditEvents(TENANT)).map((a) => a.action);
    expect(audits).toContain('economy.work_order.verified.v1');
  });

  // --- Scenario 2: AI agent path (propose → human approve → execute) ----------
  it('AI agent path: agent proposes through the Action Ledger, human approves; agent cannot self-approve/verify/release', async () => {
    const created = await createOrder(lab);
    const id = orderId(created);

    // Agent proposes acceptance on the EXISTING Action Ledger.
    const proposed = await lab.handlers.proposeEconomyAction(
      operator({ params: { id }, body: { agent_id: lab.workerId } }),
      'accept',
    );
    expect(proposed.status).toBe(201);
    const acceptActionId = actionId(proposed);
    const action = (await lab.repo.getAgentAction(TENANT, acceptActionId))!;
    expect(action.action_type).toBe('economy.work_order.accept');
    expect(action.approval_status).toBe('proposed');
    expect(action.risk_level).toBe('high');
    expect(action.simulation).toBe(true);
    expect((action.result as { requires_human_approval: boolean }).requires_human_approval).toBe(
      true,
    );

    // A viewer (no mutating role) cannot propose at all.
    await expect(
      lab.handlers.proposeEconomyAction(
        asRole('viewer', { params: { id }, body: { agent_id: lab.workerId } }),
        'accept',
      ),
    ).rejects.toMatchObject({ status: 403 });

    // verify / resolve are NEVER agent-proposable — they stay owner decisions.
    for (const kind of ['verify', 'resolve'] as const) {
      await expect(
        lab.handlers.proposeEconomyAction(
          operator({ params: { id }, body: { agent_id: lab.workerId } }),
          kind,
        ),
      ).rejects.toMatchObject({ status: 403 });
    }

    // Unapproved execution is refused — the proposal alone moves nothing.
    await expect(
      lab.handlers.executeEconomyAction(operator({ params: { id: acceptActionId } })),
    ).rejects.toMatchObject({ status: 409 });
    expect(await balance(lab, lab.requesterAccountId)).toBe(500);

    // Human approval on the ledger, then operator-gated execution.
    expect((await approve(lab, acceptActionId)).status).toBe(200);
    const executed = await lab.handlers.executeEconomyAction(
      operator({ params: { id: acceptActionId } }),
    );
    const wo1 = (executed.body as { work_order: Record<string, unknown> }).work_order;
    expect(wo1.status).toBe('accepted');
    expect(wo1.escrow_status).toBe('reserved');
    expect(await balance(lab, lab.requesterAccountId)).toBe(400);

    // Agent proposes delivery; approve; execute runs the simulated execution.
    const deliverRes = await lab.handlers.proposeEconomyAction(
      operator({ params: { id }, body: { agent_id: lab.workerId, result_summary: 'done' } }),
      'deliver',
    );
    const deliverActionId = actionId(deliverRes);
    await approve(lab, deliverActionId);
    const delivered = await lab.handlers.executeEconomyAction(
      operator({ params: { id: deliverActionId } }),
    );
    const wo2 = (delivered.body as { work_order: { status: string; proof_id: string } }).work_order;
    expect(wo2.status).toBe('delivered');
    expect(wo2.proof_id).toBeTruthy();

    // Release stays a HUMAN owner decision: an operator cannot verify.
    await expect(lab.handlers.verifyWorkOrder(operator({ params: { id } }))).rejects.toMatchObject({
      status: 403,
    });
    // Owner verifies → escrow releases, reputation books once.
    await lab.handlers.verifyWorkOrder(owner({ params: { id } }));
    expect(await reputationCodes(lab, lab.workerId)).toEqual(['work_order:verified']);

    const audits = (await lab.repo.listAuditEvents(TENANT)).map((a) => a.action);
    expect(audits).toContain('economy.agent_action.proposed.v1');
    expect(audits).toContain('economy.agent_action.executed.v1');
  });

  // --- Scenario 3: weak proof path (likely_inference / unknown cannot release)
  it('weak proof path: likely_inference and unknown proofs cannot release escrow', async () => {
    for (const tag of ['likely_inference', 'unknown'] as const) {
      const created = await createOrder(lab, { skill_version_id: undefined });
      const id = orderId(created);
      await lab.handlers.acceptWorkOrder(
        operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
      );

      const weak = await createProof(
        lab.repo,
        TENANT,
        { kind: 'skill_demo', subject_type: 'work_order', subject_id: id, evidence_tag: tag },
        'user:pilot',
        'trace-pilot-001',
      );
      const delivered = await lab.handlers.deliverWorkOrder(
        operator({ params: { id }, body: { proof_id: weak.id } }),
      );
      expect(
        (delivered.body as { work_order: { evidence_tag: string } }).work_order.evidence_tag,
      ).toBe(tag);

      // Owner verify is refused: only verified_fact releases escrow.
      await expect(lab.handlers.verifyWorkOrder(owner({ params: { id } }))).rejects.toMatchObject({
        status: 409,
      });
      // Escrow stayed reserved; no positive reputation was booked.
      expect((await lab.repo.getWorkOrder(TENANT, id))!.escrow_status).toBe('reserved');
      expect(await reputationCodes(lab, lab.workerId)).toEqual([]);
    }
  });

  // --- Scenario 4: dispute path (refund + split; reputation semantics) --------
  it('dispute path: held escrow resolves to refund or conserved split; reputation stays honest', async () => {
    // Refund branch.
    {
      const created = await createOrder(lab);
      const id = orderId(created);
      await lab.handlers.acceptWorkOrder(
        operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
      );
      await lab.handlers.deliverWorkOrder(operator({ params: { id }, body: {} }));
      const disputed = await lab.handlers.disputeWorkOrder(
        operator({ params: { id }, body: { reason: { reason_code: 'work_unusable' } } }),
      );
      const dWo = (disputed.body as { work_order: { status: string; escrow_status: string } })
        .work_order;
      expect(dWo.status).toBe('disputed');
      expect(dWo.escrow_status).toBe('disputed'); // held — neither side paid

      // An operator cannot arbitrate; only the owner resolves.
      await expect(
        lab.handlers.resolveWorkOrder(
          operator({ params: { id }, body: { decision: 'refund', reason_code: 'x' } }),
        ),
      ).rejects.toMatchObject({ status: 403 });

      const resolved = await lab.handlers.resolveWorkOrder(
        owner({ params: { id }, body: { decision: 'refund', reason_code: 'work_unusable' } }),
      );
      expect((resolved.body as { work_order: { status: string } }).work_order.status).toBe(
        'resolved',
      );
      expect(await balance(lab, lab.requesterAccountId)).toBe(500); // fully refunded
      // Refund books a negative reputation event against the worker.
      expect(await reputationCodes(lab, lab.workerId)).toEqual([
        'work_order:resolved:against_worker:work_unusable',
      ]);
    }

    // Split branch — fresh lab so balances/reputation are independent.
    {
      const lab2 = await makeLab();
      const created = await lab2.handlers.createWorkOrder(
        operator({
          body: {
            requester_agent_id: lab2.requesterId,
            title: 'split case',
            skill_version_id: lab2.skillVersionId,
            requested_credits: 100,
          },
        }),
      );
      const id = (created.body as { work_order: { id: string } }).work_order.id;
      await lab2.handlers.acceptWorkOrder(
        operator({ params: { id }, body: { worker_agent_id: lab2.workerId } }),
      );
      await lab2.handlers.deliverWorkOrder(operator({ params: { id }, body: {} }));
      await lab2.handlers.disputeWorkOrder(
        operator({ params: { id }, body: { reason: { reason_code: 'partial' } } }),
      );
      const resolved = await lab2.handlers.resolveWorkOrder(
        owner({
          params: { id },
          body: {
            decision: 'split',
            reason_code: 'partial_value',
            worker_credits: 40,
            requester_credits: 60,
          },
        }),
      );
      expect((resolved.body as { work_order: { status: string } }).work_order.status).toBe(
        'resolved',
      );
      expect(
        await getAccountView(lab2.repo, TENANT, lab2.workerAccountId).then((v) => v.balance),
      ).toBe(40);
      expect(
        await getAccountView(lab2.repo, TENANT, lab2.requesterAccountId).then((v) => v.balance),
      ).toBe(460); // 400 left after reserve + 60 returned
      // Splits move NO reputation — partial fault earns nobody credit.
      expect(
        await lab2.repo.listReputationEvents(TENANT, lab2.workerId).then((e) => e.length),
      ).toBe(0);
    }
  });

  // --- Scenario 5: Agent Fabric path (route → simulated receipt → deliver) ----
  it('agent fabric path: route decision → simulated receipt proof → delivery; no remote execution; quarantine kill switch', async () => {
    const created = await createOrder(lab);
    const id = orderId(created);
    await lab.handlers.acceptWorkOrder(
      operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
    );

    // Register a fabric node (registry metadata only) and route to it.
    const reg = await lab.handlers.registerFabricNode(
      operator({
        body: {
          agent_id: lab.workerId,
          label: 'mac-mini-1',
          platform: 'macos',
          capabilities: [{ skill: 'code.test.run', tier: 2 }],
        },
      }),
    );
    expect(reg.status).toBe(201);
    const nodeId = (reg.body as { node: { id: string; status: string } }).node.id;

    const decision = (
      await lab.handlers.routeFabricWorkOrder(
        operator({ query: { skill: 'code.test.run', min_tier: '2' } }),
      )
    ).body as { chosen: { node_id: string; label: string } | null; candidates: unknown[] };
    expect(decision.chosen?.node_id).toBe(nodeId);

    // Simulated execution records a verified_fact RECEIPT proof and delivers.
    const sim = await lab.handlers.simulateFabricExecute(
      operator({ body: { node_id: nodeId, work_order_id: id } }),
    );
    expect(sim.status).toBe(201);
    const simBody = sim.body as {
      node_id: string;
      proof_id: string;
      work_order: { status: string; evidence_tag: string };
    };
    expect(simBody.work_order.status).toBe('delivered');
    expect(simBody.work_order.evidence_tag).toBe('verified_fact');

    // The receipt proof is explicitly a simulation — no network / process / shell.
    const proof = (await lab.repo.getProof(TENANT, simBody.proof_id))!;
    expect(proof.evidence_ref).toMatch(/^fabric-node:/);
    expect((proof.details_private as { simulated?: boolean }).simulated).toBe(true);
    const fabricView = (await lab.handlers.getFabric(operator())).body as { note: string };
    expect(fabricView.note).toMatch(/executes nothing for real/);

    // Human verify still releases escrow + reputation (fabric never does).
    await lab.handlers.verifyWorkOrder(owner({ params: { id } }));
    expect(await reputationCodes(lab, lab.workerId)).toEqual(['work_order:verified']);

    // Quarantine is the per-node kill switch: a quarantined node executes nothing.
    await lab.handlers.setFabricNodeStatus(operator({ params: { id: nodeId } }), 'quarantined');
    const created2 = await createOrder(lab);
    const id2 = orderId(created2);
    await lab.handlers.acceptWorkOrder(
      operator({ params: { id: id2 }, body: { worker_agent_id: lab.workerId } }),
    );
    await expect(
      lab.handlers.simulateFabricExecute(
        operator({ body: { node_id: nodeId, work_order_id: id2 } }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  // --- Scenario 6: public trust feed (safe-empty unless configured) -----------
  it('public trust feed path: safe-empty unless configured; aggregate-only reputation; no private proof bodies', async () => {
    const SAFE_EMPTY = { agents_with_reputation: 0, total_events: 0, positive_events: 0 };
    const publicReq: ApiRequest = { traceId: 'trace-public' }; // no tenant, no role

    // Unconfigured: deny-by-default empty feed, never an error.
    delete process.env[PUBLIC_TENANT_ENV];
    const off = await lab.handlers.publicTrustFeed(publicReq);
    expect(off.status).toBe(200);
    const offBody = off.body as { configured: boolean; proofs: unknown[]; reputation: unknown };
    expect(offBody.configured).toBe(false);
    expect(offBody.proofs).toEqual([]);
    expect(offBody.reputation).toEqual(SAFE_EMPTY);

    // Seed a public-safe, redaction-passed proof carrying secret internals.
    const seededAt = new Date().toISOString();
    await lab.repo.insertProof({
      id: randomUUID(),
      tenant_id: TENANT,
      kind: 'skill_demo',
      subject_type: 'skill',
      subject_id: randomUUID(),
      evidence_tag: 'verified_fact',
      evidence_ref: 'secret-evidence-ref',
      verifier_ref: 'secret-verifier-ref',
      summary_public: 'Public-safe summary.',
      details_private: { secret: 'do-not-leak' },
      public_safe: true,
      redaction_check_passed_at: seededAt,
      supersedes_proof_id: null,
      external_attestation_ref: null,
      created_at: seededAt,
    });

    // Configure the public tenant server-side ONLY (never from the request).
    process.env[PUBLIC_TENANT_ENV] = TENANT;
    const on = await lab.handlers.publicTrustFeed(publicReq);
    expect(on.status).toBe(200);
    const onBody = on.body as {
      configured: boolean;
      proofs: Array<Record<string, unknown>>;
      reputation: Record<string, number>;
    };
    expect(onBody.configured).toBe(true);
    expect(onBody.proofs.length).toBe(1);

    // Public projection only — no private bodies / refs / ids leak.
    const pub = onBody.proofs[0]!;
    expect(pub.summary_public).toBe('Public-safe summary.');
    for (const leaked of [
      'details_private',
      'evidence_ref',
      'verifier_ref',
      'subject_id',
      'tenant_id',
      'public_safe',
    ]) {
      expect(pub).not.toHaveProperty(leaked);
    }
    // Reputation is aggregate counts only — keys present, no agent ids.
    expect(Object.keys(onBody.reputation).sort()).toEqual(
      ['agents_with_reputation', 'positive_events', 'total_events'].sort(),
    );
    expect(JSON.stringify(onBody.reputation)).not.toContain(lab.workerId);
  });

  // --- Cross-cutting guards: internal-only rail, no token/payment surface -----
  it('guardrails: internal credits are the only rail; no public token surface; no production creds needed', async () => {
    const summary = (await lab.handlers.economySummary(operator())).body as {
      escrow: { rail: string };
      token_public_status: string;
      legal_gate: string;
      marketplace: { visibility: string };
    };
    expect(summary.escrow.rail).toBe('internal_credits');
    expect(summary.token_public_status).toBe('disabled');
    expect(summary.legal_gate).toBe('not_passed');
    expect(summary.marketplace.visibility).toBe('internal');

    // The whole harness runs with no production env configured.
    expect(process.env.DATABASE_URL).toBeUndefined();
    expect(process.env[PUBLIC_TENANT_ENV]).toBeUndefined();
  });
});
