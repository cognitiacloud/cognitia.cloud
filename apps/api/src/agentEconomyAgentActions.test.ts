import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import { registerAgent, issueAtc } from './atc.js';
import { openAccount, transfer, getAccountView } from './credits.js';
import { createProof } from './proofs.js';
import { ECONOMY_PERMISSION_KEYS } from './agentEconomyActions.js';

/**
 * AGENT-ECONOMY-003 — agent-driven accept/deliver/dispute through the
 * EXISTING Action Ledger. Agents propose (active ATC + explicit allow
 * permission, deny-by-default); humans approve on the same ledger as every
 * other risky action; execution is a separate operator step that runs the
 * safe service path. verify/resolve stay human-owner decisions.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({ tenantId: TENANT, role, traceId: 'trace-agent-econ', ...over });
const operator = (over: Partial<ApiRequest> = {}) => asRole('operator', over);
const owner = (over: Partial<ApiRequest> = {}) => asRole('owner', over);

interface Lab {
  repo: InMemoryRepository;
  handlers: ApiHandlers;
  requesterId: string;
  workerId: string;
  noAtcAgentId: string;
  noPermAgentId: string;
  skillVersionId: string;
  requesterAccountId: string;
}

async function grantEconomyPermissions(repo: InMemoryRepository, agentId: string) {
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

async function makeLab(): Promise<Lab> {
  const repo = new InMemoryRepository();
  const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  const actor = 'user:test';
  const trace = 'trace-agent-econ';

  const { agent: requester } = await registerAgent(
    repo,
    TENANT,
    { name: 'Requester', slug: 'ae3-requester', kind: 'internal_ops' },
    actor,
    trace,
  );
  const { agent: worker } = await registerAgent(
    repo,
    TENANT,
    { name: 'Worker', slug: 'ae3-worker', kind: 'internal_ops' },
    actor,
    trace,
  );
  await issueAtc(repo, TENANT, worker.id, { claims: {} }, actor, trace);
  await grantEconomyPermissions(repo, worker.id);

  // Credentialed but UNPERMISSIONED agent (deny-by-default coverage).
  const { agent: noPerm } = await registerAgent(
    repo,
    TENANT,
    { name: 'No Permission', slug: 'ae3-noperm', kind: 'internal_ops' },
    actor,
    trace,
  );
  await issueAtc(repo, TENANT, noPerm.id, { claims: {} }, actor, trace);
  // Permissioned but UNCREDENTIALED agent (ATC gate coverage).
  const { agent: noAtc } = await registerAgent(
    repo,
    TENANT,
    { name: 'No ATC', slug: 'ae3-noatc', kind: 'other' },
    actor,
    trace,
  );
  await grantEconomyPermissions(repo, noAtc.id);

  const ts = new Date().toISOString();
  const skill = await repo.upsertSkill({
    id: randomUUID(),
    tenant_id: TENANT,
    name: 'Brief Skill',
    slug: 'ae3-brief-skill',
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
      idempotency_key: 'grant-ae3',
    },
    actor,
  );
  return {
    repo,
    handlers,
    requesterId: requester.id,
    workerId: worker.id,
    noAtcAgentId: noAtc.id,
    noPermAgentId: noPerm.id,
    skillVersionId: version.id,
    requesterAccountId: requesterAccount.id,
  };
}

const newOrder = async (lab: Lab, over: Record<string, unknown> = {}) => {
  const res = await lab.handlers.createWorkOrder(
    operator({
      body: {
        requester_agent_id: lab.requesterId,
        title: 'Agent-native research brief',
        skill_version_id: lab.skillVersionId,
        requested_credits: 100,
        ...over,
      },
    }),
  );
  return (res.body as { work_order: { id: string } }).work_order.id;
};

const actionIdOf = (res: { body: unknown }) => (res.body as { action: { id: string } }).action.id;

// Decision reasons come from the CLOSED ledger taxonomy (core agent schemas).
const approve = async (lab: Lab, actionId: string) => {
  const res = await lab.handlers.approveAction(
    operator({ params: { id: actionId }, body: { reason: { reason_code: 'meets_playbook' } } }),
  );
  expect(res.status).toBe(200);
};

describe('Agent-driven economy actions (AGENT-ECONOMY-003)', () => {
  let lab: Lab;
  beforeEach(async () => {
    lab = await makeLab();
  });

  it('full agent-driven loop: propose-accept → approve → execute (escrow once) → propose-deliver → approve → execute (proof linked)', async () => {
    const id = await newOrder(lab);

    // Agent proposes acceptance: ledger row, high risk, approval required,
    // proposal proof, audit event.
    const proposed = await lab.handlers.proposeEconomyAction(
      operator({ params: { id }, body: { agent_id: lab.workerId } }),
      'accept',
    );
    expect(proposed.status).toBe(201);
    const acceptActionId = actionIdOf(proposed);
    const action = (await lab.repo.getAgentAction(TENANT, acceptActionId))!;
    expect(action.action_type).toBe('economy.work_order.accept');
    expect(action.approval_status).toBe('proposed');
    expect(action.risk_level).toBe('high');
    expect(action.simulation).toBe(true);
    expect(action.proof_id).toBeTruthy();
    expect((action.result as { requires_human_approval: boolean }).requires_human_approval).toBe(
      true,
    );
    // Idempotent re-proposal: same ask, no duplicate.
    const replay = await lab.handlers.proposeEconomyAction(
      operator({ params: { id }, body: { agent_id: lab.workerId } }),
      'accept',
    );
    expect(replay.status).toBe(200);
    expect(actionIdOf(replay)).toBe(acceptActionId);

    // Unapproved execution is refused; the work order is untouched.
    await expect(
      lab.handlers.executeEconomyAction(operator({ params: { id: acceptActionId } })),
    ).rejects.toMatchObject({ status: 409 });

    // Human approval on the EXISTING ledger, then operator-gated execution.
    await approve(lab, acceptActionId);
    const executed = await lab.handlers.executeEconomyAction(
      operator({ params: { id: acceptActionId } }),
    );
    const wo1 = (executed.body as { work_order: Record<string, unknown> }).work_order;
    expect(wo1.status).toBe('accepted');
    expect(wo1.worker_agent_id).toBe(lab.workerId);
    expect(wo1.escrow_status).toBe('reserved');
    expect((await getAccountView(lab.repo, TENANT, lab.requesterAccountId)).balance).toBe(400);
    // Credits reserved exactly once: re-execution is refused...
    await expect(
      lab.handlers.executeEconomyAction(operator({ params: { id: acceptActionId } })),
    ).rejects.toMatchObject({ status: 409 });
    expect((await getAccountView(lab.repo, TENANT, lab.requesterAccountId)).balance).toBe(400);

    // Agent proposes delivery; approval; execution runs the SIMULATED skill
    // execution and links the delivery proof onto the ledger action.
    const deliverRes = await lab.handlers.proposeEconomyAction(
      operator({
        params: { id },
        body: { agent_id: lab.workerId, result_summary: 'brief produced' },
      }),
      'deliver',
    );
    const deliverActionId = actionIdOf(deliverRes);
    await approve(lab, deliverActionId);
    const delivered = await lab.handlers.executeEconomyAction(
      operator({ params: { id: deliverActionId } }),
    );
    const wo2 = (delivered.body as { work_order: { status: string; proof_id: string } }).work_order;
    expect(wo2.status).toBe('delivered');
    expect(wo2.proof_id).toBeTruthy();
    const deliverAction = (await lab.repo.getAgentAction(TENANT, deliverActionId))!;
    expect(deliverAction.execution_status).toBe('completed');
    expect(deliverAction.proof_id).toBe(wo2.proof_id);

    // Verification stays a HUMAN owner decision — and still releases escrow.
    await lab.handlers.verifyWorkOrder(owner({ params: { id } }));
    expect(
      (await lab.repo.listReputationEvents(TENANT, lab.workerId)).map((e) => e.reason_code),
    ).toEqual(['work_order:verified']);

    // The audit trail recorded both ledger events.
    const audits = (await lab.repo.listAuditEvents(TENANT)).map((a) => a.action);
    expect(audits).toContain('economy.agent_action.proposed.v1');
    expect(audits).toContain('economy.agent_action.executed.v1');

    // The console list exposes ledger status + who decided.
    const list = (await lab.handlers.listEconomyActions(operator())).body as {
      actions: Array<{ id: string; decisions: Array<{ label: string }> }>;
    };
    const decided = list.actions.find((a) => a.id === acceptActionId)!;
    expect(decided.decisions.map((d) => d.label)).toContain('approved');
  });

  it('trust + permission gates: no ATC → 403, deny-by-default → 403, explicit deny wins → 403', async () => {
    const id = await newOrder(lab);
    await expect(
      lab.handlers.proposeEconomyAction(
        operator({ params: { id }, body: { agent_id: lab.noAtcAgentId } }),
        'accept',
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      lab.handlers.proposeEconomyAction(
        operator({ params: { id }, body: { agent_id: lab.noPermAgentId } }),
        'accept',
      ),
    ).rejects.toMatchObject({ status: 403 });
    // Explicit deny always wins, even after an allow existed.
    const ts = new Date().toISOString();
    await lab.repo.upsertAgentPermission({
      id: randomUUID(),
      tenant_id: TENANT,
      agent_id: lab.workerId,
      action_key: ECONOMY_PERMISSION_KEYS.accept,
      effect: 'deny',
      constraints: {},
      created_at: ts,
      updated_at: ts,
    });
    await expect(
      lab.handlers.proposeEconomyAction(
        operator({ params: { id }, body: { agent_id: lab.workerId } }),
        'accept',
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('verify and resolve are never agent-proposable (owner decisions)', async () => {
    const id = await newOrder(lab);
    for (const kind of ['verify', 'resolve'] as const) {
      await expect(
        lab.handlers.proposeEconomyAction(
          operator({ params: { id }, body: { agent_id: lab.workerId } }),
          kind,
        ),
      ).rejects.toMatchObject({ status: 403 });
    }
  });

  it('rejected proposals cannot execute; the work order stays untouched', async () => {
    const id = await newOrder(lab);
    const proposed = await lab.handlers.proposeEconomyAction(
      operator({ params: { id }, body: { agent_id: lab.workerId } }),
      'accept',
    );
    const actionId = actionIdOf(proposed);
    const rejected = await lab.handlers.rejectAction(
      operator({ params: { id: actionId }, body: { reason: { reason_code: 'policy_or_risk' } } }),
    );
    expect(rejected.status).toBe(200);
    await expect(
      lab.handlers.executeEconomyAction(operator({ params: { id: actionId } })),
    ).rejects.toMatchObject({ status: 409 });
    expect((await lab.repo.getWorkOrder(TENANT, id))!.status).toBe('proposed');
    expect((await getAccountView(lab.repo, TENANT, lab.requesterAccountId)).balance).toBe(500);
  });

  it('yanked skill versions cannot be accepted even via an approved agent action', async () => {
    const id = await newOrder(lab);
    const proposed = await lab.handlers.proposeEconomyAction(
      operator({ params: { id }, body: { agent_id: lab.workerId } }),
      'accept',
    );
    const actionId = actionIdOf(proposed);
    await approve(lab, actionId);
    await lab.repo.yankSkillVersion(TENANT, lab.skillVersionId, 'defective');
    // Execution re-runs every safe-path rule — the yank gate included.
    await expect(
      lab.handlers.executeEconomyAction(operator({ params: { id: actionId } })),
    ).rejects.toMatchObject({ status: 409 });
    expect((await lab.repo.getWorkOrder(TENANT, id))!.status).toBe('proposed');
  });

  it('deliver proposals: worker mismatch 403; proofless skill-less delivery refused at execution; weak proof cannot release escrow', async () => {
    // Skill-less order so delivery needs an explicit proof.
    const id = await newOrder(lab, { skill_version_id: undefined });
    await lab.handlers.acceptWorkOrder(
      operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
    );

    // Only the assigned worker may propose delivery.
    await expect(
      lab.handlers.proposeEconomyAction(
        operator({ params: { id }, body: { agent_id: lab.noPermAgentId } }),
        'deliver',
      ),
    ).rejects.toMatchObject({ status: 403 });

    // Proofless delivery: proposal lands, approval lands, EXECUTION refuses.
    const proofless = await lab.handlers.proposeEconomyAction(
      operator({ params: { id }, body: { agent_id: lab.workerId } }),
      'deliver',
    );
    const prooflessId = actionIdOf(proofless);
    await approve(lab, prooflessId);
    await expect(
      lab.handlers.executeEconomyAction(operator({ params: { id: prooflessId } })),
    ).rejects.toMatchObject({ status: 409 });

    // A REVISED ask carrying a likely_inference proof is a fresh,
    // content-fingerprinted proposal (front-desk precedent): new human
    // decision, then delivery succeeds — but the weak tag can NOT release.
    const weak = await createProof(
      lab.repo,
      TENANT,
      {
        kind: 'skill_demo',
        subject_type: 'work_order',
        subject_id: id,
        evidence_tag: 'likely_inference',
      },
      'user:test',
      'trace-agent-econ',
    );
    const revised = await lab.handlers.proposeEconomyAction(
      operator({ params: { id }, body: { agent_id: lab.workerId, proof_id: weak.id } }),
      'deliver',
    );
    const revisedId = actionIdOf(revised);
    expect(revisedId).not.toBe(prooflessId); // revised content = new ask
    await approve(lab, revisedId);
    await lab.handlers.executeEconomyAction(operator({ params: { id: revisedId } }));
    const wo = (await lab.repo.getWorkOrder(TENANT, id))!;
    expect(wo.status).toBe('delivered');
    expect(wo.evidence_tag).toBe('likely_inference');
    await expect(lab.handlers.verifyWorkOrder(owner({ params: { id } }))).rejects.toMatchObject({
      status: 409,
    }); // weak tags never release escrow
  });

  it('dispute proposals create a ledger ask, never a resolution; the owner still arbitrates', async () => {
    const id = await newOrder(lab);
    await lab.handlers.acceptWorkOrder(
      operator({ params: { id }, body: { worker_agent_id: lab.workerId } }),
    );
    await lab.handlers.deliverWorkOrder(operator({ params: { id }, body: {} }));

    const proposed = await lab.handlers.proposeEconomyAction(
      operator({
        params: { id },
        body: { agent_id: lab.workerId, reason_code: 'requester_unresponsive' },
      }),
      'dispute',
    );
    const actionId = actionIdOf(proposed);
    // Proposal alone changes nothing.
    expect((await lab.repo.getWorkOrder(TENANT, id))!.status).toBe('delivered');
    await approve(lab, actionId);
    await lab.handlers.executeEconomyAction(operator({ params: { id: actionId } }));
    const wo = (await lab.repo.getWorkOrder(TENANT, id))!;
    expect(wo.status).toBe('disputed');
    expect(wo.escrow_status).toBe('disputed');
    // No resolution exists until a human OWNER arbitrates.
    expect(await lab.repo.getDisputeResolutionByWorkOrder(TENANT, id)).toBeNull();
    await expect(
      lab.handlers.resolveWorkOrder(
        operator({ params: { id }, body: { decision: 'refund', reason_code: 'x' } }),
      ),
    ).rejects.toMatchObject({ status: 403 }); // operator cannot arbitrate
    await lab.handlers.resolveWorkOrder(
      owner({ params: { id }, body: { decision: 'refund', reason_code: 'work_unusable' } }),
    );
    expect((await lab.repo.getWorkOrder(TENANT, id))!.status).toBe('resolved');
  });

  it('viewer cannot propose or execute; proposals against missing orders/agents are 404', async () => {
    const id = await newOrder(lab);
    await expect(
      lab.handlers.proposeEconomyAction(
        asRole('viewer', { params: { id }, body: { agent_id: lab.workerId } }),
        'accept',
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      lab.handlers.proposeEconomyAction(
        operator({ params: { id: randomUUID() }, body: { agent_id: lab.workerId } }),
        'accept',
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      lab.handlers.proposeEconomyAction(
        operator({ params: { id }, body: { agent_id: randomUUID() } }),
        'accept',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
