import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow, type IntegrationConnectionRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers } from './handlers.js';
import { grantMiraExecution } from './passportTestKit.js';

/**
 * PASS-1 — agent passports + scope grants, end to end. Identity-first
 * execution: every executable action requires an active passport and a live,
 * owner-approved grant covering the exact (action_type, integration) at or
 * above the action's risk — no fallback to the bare agent name. Denials are
 * audited with passport/grant context; the owner approval flow is itself
 * audited; the kill switch outranks valid grants; rollback/preview are
 * intentionally not passport-gated (documented scope decision).
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

function connection(status: string): IntegrationConnectionRow {
  return {
    id: 'conn-1',
    tenant_id: TENANT,
    external_system: 'hubspot',
    status,
    credential_ref: 'cred-1',
    metadata: {},
    created_at: ts,
    updated_at: ts,
  };
}

function makeHandlers(repo: InMemoryRepository): ApiHandlers {
  return new ApiHandlers(
    repo,
    createGtmServices({ repo, v1Mode: true, hubspotClient: new FakeHubspotClient() }),
  );
}

/** Propose via a real run and return one approved, executable action id. */
async function approvedActionId(handlers: ApiHandlers): Promise<string> {
  await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
  const list = await handlers.listAgentActions({ tenantId: TENANT });
  const id = (list.body as { actions: Array<{ id: string }> }).actions[0]!.id;
  await handlers.approveAction({
    tenantId: TENANT,
    role: 'operator',
    params: { id },
    body: { reason: { reason_code: 'meets_playbook' } },
  });
  return id;
}

const exec = (handlers: ApiHandlers, id: string) =>
  handlers.executeAction({ tenantId: TENANT, role: 'operator', params: { id } });

async function lastExecDenial(repo: InMemoryRepository) {
  const audits = await repo.listAuditEvents(TENANT);
  return audits.filter((a) => a.action === 'execution_denied').at(-1);
}

describe('PASS-1 — execution requires a passport + live grant (no fallback)', () => {
  let repo: InMemoryRepository;
  let handlers: ApiHandlers;

  beforeEach(() => {
    repo = new InMemoryRepository();
    repo.seedAccount(account());
    handlers = makeHandlers(repo);
  });

  it('denies with passport_missing when no passport exists — audited with full context', async () => {
    const id = await approvedActionId(handlers);
    const res = await exec(handlers, id);
    expect(res.status).toBe(409);

    const denial = await lastExecDenial(repo);
    expect(denial).toBeDefined();
    expect(denial!.actor_ref).toBe('agent:mira');
    expect(denial!.tenant_id).toBe(TENANT);
    expect(denial!.subject_ref).toBe(`agent_action:${id}`);
    expect(denial!.detail).toMatchObject({
      reason: 'passport_missing',
      agent: 'mira',
      action_type: 'crm.task.create',
      integration: 'hubspot',
      risk_level: 'low',
    });
    // Nothing executed.
    const action = await repo.getAgentAction(TENANT, id);
    expect(action!.execution_status).toBe('pending');
  });

  it('a valid owner-approved grant allows execution', async () => {
    await grantMiraExecution(repo, TENANT);
    const id = await approvedActionId(handlers);
    const res = await exec(handlers, id);
    expect(res.status).toBe(200);
    expect((res.body as { execution_status: string }).execution_status).toBe('executed');
  });

  it('a passport with no grants denies with grant_missing', async () => {
    const { grantIds, passportId } = await grantMiraExecution(repo, TENANT);
    for (const g of grantIds) await repo.revokeScopeGrant(TENANT, g, 'user:owner-test', ts);
    // Revoked grants exist for the matching scope → grant_revoked is reported;
    // a scope nothing was ever granted for reports grant_missing (pure-policy
    // matrix covers wrong action/integration). Here: revoke all, then deny.
    const id = await approvedActionId(handlers);
    const res = await exec(handlers, id);
    expect(res.status).toBe(409);
    const denial = await lastExecDenial(repo);
    expect(denial!.detail).toMatchObject({ reason: 'grant_revoked', passport_id: passportId });
  });

  it('an expired grant denies with grant_expired', async () => {
    await grantMiraExecution(repo, TENANT, { expiresAt: '2020-01-01T00:00:00.000Z' });
    const id = await approvedActionId(handlers);
    const res = await exec(handlers, id);
    expect(res.status).toBe(409);
    expect((await lastExecDenial(repo))!.detail['reason']).toBe('grant_expired');
  });

  it('a grant below the action risk denies with grant_insufficient_risk', async () => {
    await grantMiraExecution(repo, TENANT, { riskMax: 'none' }); // crm.* actions are 'low'
    const id = await approvedActionId(handlers);
    const res = await exec(handlers, id);
    expect(res.status).toBe(409);
    expect((await lastExecDenial(repo))!.detail['reason']).toBe('grant_insufficient_risk');
  });

  it('a revoked passport denies with passport_revoked', async () => {
    const { passportId } = await grantMiraExecution(repo, TENANT);
    await repo.updateAgentPassportStatus(TENANT, passportId, 'revoked');
    const id = await approvedActionId(handlers);
    const res = await exec(handlers, id);
    expect(res.status).toBe(409);
    expect((await lastExecDenial(repo))!.detail['reason']).toBe('passport_revoked');
  });

  it('the kill switch outranks an otherwise-valid grant', async () => {
    await grantMiraExecution(repo, TENANT);
    repo.seedIntegrationConnection(connection('paused'));
    const id = await approvedActionId(handlers);
    const res = await exec(handlers, id);
    expect(res.status).toBe(409);
    expect((await lastExecDenial(repo))!.detail['reason']).toBe('connection_paused');
  });

  it('rollback and preview are intentionally not passport-gated', async () => {
    const { grantIds } = await grantMiraExecution(repo, TENANT);
    const id = await approvedActionId(handlers);
    await exec(handlers, id);
    // Revoke everything AFTER execution — undoing an authorized write must
    // remain possible (it is an operator decision, not new agent scope).
    for (const g of grantIds) await repo.revokeScopeGrant(TENANT, g, 'user:owner-test', ts);
    const preview = await handlers.previewAction({
      tenantId: TENANT,
      role: 'viewer',
      params: { id },
    });
    expect(preview.status).toBe(200);
    const rollback = await handlers.rollbackAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id },
      body: { reason: { reason_code: 'wrong_target' } },
    });
    expect(rollback.status).toBe(200);
  });
});

describe('PASS-1 — owner-reviewed grant approval flow (API)', () => {
  let repo: InMemoryRepository;
  let handlers: ApiHandlers;

  beforeEach(() => {
    repo = new InMemoryRepository();
    repo.seedAccount(account());
    handlers = makeHandlers(repo);
  });

  const owner = { tenantId: TENANT, role: 'owner' as const, userRef: 'olivia' };
  const operator = { tenantId: TENANT, role: 'operator' as const, userRef: 'oscar' };

  it('owner issues passport + grant; execution then succeeds; all of it audited', async () => {
    const created = await handlers.createPassport({ ...owner, body: { agent_id: 'mira' } });
    expect(created.status).toBe(201);
    const passportId = (created.body as { id: string }).id;

    for (const actionType of ['crm.task.create', 'crm.note.create']) {
      const grant = await handlers.issueGrant({
        ...owner,
        params: { id: passportId },
        body: {
          action_type: actionType,
          integration: 'hubspot',
          risk_max: 'medium',
          expires_at: '2099-01-01T00:00:00.000Z',
        },
      });
      expect(grant.status).toBe(201);
      expect((grant.body as { approved_by: string }).approved_by).toBe('user:olivia');
    }

    const id = await approvedActionId(handlers);
    expect((await exec(handlers, id)).status).toBe(200);

    const audits = await repo.listAuditEvents(TENANT);
    expect(
      audits.some((a) => a.action === 'passport_issued' && a.actor_ref === 'user:olivia'),
    ).toBe(true);
    expect(audits.filter((a) => a.action === 'grant_issued')).toHaveLength(2);

    // Governance read surface (viewer-allowed).
    const list = await handlers.listPassports({ tenantId: TENANT, role: 'viewer' });
    const passports = (list.body as { passports: Array<{ grants: unknown[] }> }).passports;
    expect(passports).toHaveLength(1);
    expect(passports[0]!.grants).toHaveLength(2);
  });

  it('non-owner approval is denied (403) — no self/implicit approval path', async () => {
    await expect(
      handlers.createPassport({ ...operator, body: { agent_id: 'mira' } }),
    ).rejects.toMatchObject({ status: 403 });

    const created = await handlers.createPassport({ ...owner, body: { agent_id: 'mira' } });
    const passportId = (created.body as { id: string }).id;
    await expect(
      handlers.issueGrant({
        ...operator,
        params: { id: passportId },
        body: {
          action_type: 'crm.task.create',
          integration: 'hubspot',
          risk_max: 'low',
          expires_at: '2099-01-01T00:00:00.000Z',
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      handlers.revokePassport({ ...operator, params: { id: passportId } }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('revocation through the API is effective immediately and audited', async () => {
    const created = await handlers.createPassport({ ...owner, body: { agent_id: 'mira' } });
    const passportId = (created.body as { id: string }).id;
    const grant = await handlers.issueGrant({
      ...owner,
      params: { id: passportId },
      body: {
        action_type: 'crm.task.create',
        integration: 'hubspot',
        risk_max: 'medium',
        expires_at: '2099-01-01T00:00:00.000Z',
      },
    });
    const grantId = (grant.body as { id: string }).id;

    const revoked = await handlers.revokeGrant({
      ...owner,
      params: { id: passportId, grantId },
    });
    expect(revoked.status).toBe(200);
    expect((revoked.body as { status: string }).status).toBe('revoked');
    expect((revoked.body as { revoked_by: string }).revoked_by).toBe('user:olivia');

    const id = await approvedActionId(handlers);
    const res = await exec(handlers, id);
    expect(res.status).toBe(409);
    expect((await lastExecDenial(repo))!.detail['reason']).toBe('grant_revoked');

    const audits = await repo.listAuditEvents(TENANT);
    expect(audits.some((a) => a.action === 'grant_revoked')).toBe(true);
  });

  it('duplicate passports are refused (409); grants validate their body (400)', async () => {
    await handlers.createPassport({ ...owner, body: { agent_id: 'mira' } });
    const dup = await handlers.createPassport({ ...owner, body: { agent_id: 'mira' } });
    expect(dup.status).toBe(409);

    const created = await handlers.listPassports({ tenantId: TENANT });
    const passportId = (created.body as { passports: Array<{ id: string }> }).passports[0]!.id;
    const bad = await handlers.issueGrant({
      ...owner,
      params: { id: passportId },
      body: { action_type: 'crm.task.create', integration: 'hubspot', risk_max: 'cosmic' },
    });
    expect(bad.status).toBe(400);
  });

  it('requires auth on the read surface', async () => {
    await expect(handlers.listPassports({})).rejects.toMatchObject({ status: 401 });
  });
});
