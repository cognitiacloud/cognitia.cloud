import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers } from './handlers.js';
import { buildServer } from './server.js';
import { HmacSessionVerifier, signSession } from './auth.js';
import { grantMiraExecution } from './passportTestKit.js';

/**
 * SEC-1 — security-hardening regression tests. Each test pins a vulnerability
 * found in the hardening audit so it can never silently return:
 *
 *  1. A rolled-back action could be re-executed via its stale 'approved'
 *     status — no fresh approval required (undo was not final).
 *  2. approve/reject had no state machine: a rejected action could be flipped
 *     to approved, and repeat decisions wrote duplicate feedback labels.
 *  3. Audit actor refs recorded only the ROLE (user:operator), not the person.
 *  4. /webhooks/inbound-lead and /jobs/crm-sync returned fake success (202)
 *     while doing nothing, unauthenticated.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

function account(): AccountRow {
  return {
    id: 'acc-1',
    tenant_id: TENANT,
    name: 'Acme',
    domain: 'acme.com',
    industry: 'SaaS',
    employee_count: 100,
    region: 'NA',
    fit_score: 0.9,
    timing_score: 0.8,
    attributes: {},
    created_at: ts,
    updated_at: ts,
  };
}

describe('SEC-1 — ledger state machine fails closed', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;
  let actionId: string;
  const approveReason = { reason: { reason_code: 'meets_playbook' } };
  const rejectReason = { reason: { reason_code: 'wrong_target' } };

  beforeEach(async () => {
    repo = new InMemoryRepository();
    await grantMiraExecution(repo, TENANT);
    repo.seedAccount(account());
    handlers = new ApiHandlers(
      repo,
      createGtmServices({ repo, v1Mode: true, hubspotClient: new FakeHubspotClient() }),
    );
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    actionId = (list.body as { actions: Array<{ id: string }> }).actions[0]!.id;
  });

  const decide = (kind: 'approveAction' | 'rejectAction' | 'rollbackAction', body: unknown) =>
    handlers[kind]({ tenantId: TENANT, role: 'operator', params: { id: actionId }, body });

  it('a rolled-back action can NOT be re-executed on its stale approval', async () => {
    await decide('approveAction', approveReason);
    await handlers.executeAction({ tenantId: TENANT, role: 'operator', params: { id: actionId } });
    await decide('rollbackAction', rejectReason);

    // The vulnerability: approval_status is still 'approved' after rollback.
    const res = await handlers.executeAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
    });
    expect(res.status).toBe(409); // refused (Conflict) — not re-run
    const action = await repo.getAgentAction(TENANT, actionId);
    expect(action!.execution_status).toBe('rolled_back'); // state unchanged

    // The refusal is an auditable fact with the specific reason.
    const audits = await repo.listAuditEvents(TENANT);
    const denial = audits.find(
      (a) => a.action === 'execution_denied' && a.detail['reason'] === 'rolled_back',
    );
    expect(denial).toBeDefined();
  });

  it('a rejected action can NOT be flipped to approved', async () => {
    await decide('rejectAction', rejectReason);
    const flip = await decide('approveAction', approveReason);
    expect(flip.status).toBe(400);

    const action = await repo.getAgentAction(TENANT, actionId);
    expect(action!.approval_status).toBe('rejected'); // the denial stands

    const audits = await repo.listAuditEvents(TENANT);
    const denied = audits.find(
      (a) => a.action === 'decision_denied' && a.detail['attempted'] === 'approve',
    );
    expect(denied).toBeDefined();
  });

  it('repeat decisions are refused — exactly one feedback label per decision', async () => {
    await decide('approveAction', approveReason);
    const again = await decide('approveAction', approveReason);
    expect(again.status).toBe(400);
    const labels = await repo.listFeedbackLabels(TENANT, `agent_action:${actionId}`);
    expect(labels).toHaveLength(1); // no duplicate labels corrupting scorecards
  });
});

describe('SEC-1 — audit actor attribution is the verified user, end to end', () => {
  it('an approval via a signed session audits user:<userRef>, not the role', async () => {
    const repo = new InMemoryRepository();
    repo.seedAccount(account());
    const handlers = new ApiHandlers(
      repo,
      createGtmServices({ repo, v1Mode: true, hubspotClient: new FakeHubspotClient() }),
    );
    const secret = 'test-session-secret';
    const app = buildServer(handlers, { verifier: new HmacSessionVerifier(secret) });
    const token = signSession(
      secret,
      { tenantId: TENANT, userRef: 'alice@example-org', role: 'operator' },
      3_600_000,
    );
    const auth = { authorization: `Bearer ${token}` };

    await app.inject({ method: 'POST', url: '/agent-runs/mira', headers: auth, payload: {} });
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    const id = (list.body as { actions: Array<{ id: string }> }).actions[0]!.id;
    const res = await app.inject({
      method: 'POST',
      url: `/agent-actions/${id}/approve`,
      headers: auth,
      payload: { reason: { reason_code: 'meets_playbook' } },
    });
    expect(res.statusCode).toBe(200);

    const audits = await repo.listAuditEvents(TENANT);
    const approval = audits.find((a) => a.action === 'approved');
    expect(approval!.actor_ref).toBe('user:alice@example-org');

    // The decision label carries the same person.
    const labels = await repo.listFeedbackLabels(TENANT, `agent_action:${id}`);
    expect(labels[0]!.detail['approver_ref']).toBe('user:alice@example-org');
    await app.close();
  });
});

describe('SEC-1 — GET /audit/verify (tamper-evident chain, viewer-allowed)', () => {
  it('verifies a real governed flow end to end and requires auth', async () => {
    const repo = new InMemoryRepository();
    await grantMiraExecution(repo, TENANT);
    repo.seedAccount(account());
    const handlers = new ApiHandlers(
      repo,
      createGtmServices({ repo, v1Mode: true, hubspotClient: new FakeHubspotClient() }),
    );
    // Generate real audit history: propose → approve → execute.
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    const id = (list.body as { actions: Array<{ id: string }> }).actions[0]!.id;
    await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id },
      body: { reason: { reason_code: 'meets_playbook' } },
    });
    await handlers.executeAction({ tenantId: TENANT, role: 'operator', params: { id } });

    const res = await handlers.verifyAudit({ tenantId: TENANT, role: 'viewer' });
    expect(res.status).toBe(200);
    const body = res.body as { ok: boolean; events: number; verified: number };
    expect(body.ok).toBe(true);
    expect(body.events).toBeGreaterThanOrEqual(3); // proposed + approved + executed
    expect(body.verified).toBe(body.events);

    await expect(handlers.verifyAudit({})).rejects.toMatchObject({ status: 401 });
    // Tenant-scoped: another tenant has an empty (trivially valid) chain.
    const other = await handlers.verifyAudit({
      tenantId: '22222222-2222-2222-2222-222222222222',
    });
    expect((other.body as { events: number }).events).toBe(0);
  });
});

describe('SEC-1 — unimplemented seams fail truthfully (no fake success)', () => {
  it('inbound-lead and crm-sync return 501, never a fake 202', async () => {
    const repo = new InMemoryRepository();
    const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
    const lead = await handlers.webhookInboundLead({});
    const sync = await handlers.crmSyncJob({});
    expect(lead.status).toBe(501);
    expect(sync.status).toBe(501);
    expect((lead.body as { error: string }).error).toBe('not_implemented');
    expect((sync.body as { error: string }).error).toBe('not_implemented');
  });
});
