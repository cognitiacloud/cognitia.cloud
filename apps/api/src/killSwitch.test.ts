import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow, type IntegrationConnectionRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers } from './handlers.js';
import { grantMiraExecution } from './passportTestKit.js';

/**
 * ENF-1 — the tenant kill switch is ENFORCED, not just documented. Any
 * non-'active' connection status halts execution and rollback (409 + audited
 * denial); pause is operator-grade (emergency stop must be cheap), resume is
 * owner-only (recovery is deliberate); every flip is audited.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

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

describe('ENF-1 — enforced tenant kill switch', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;
  let hubspot: FakeHubspotClient;
  let actionId: string;

  beforeEach(async () => {
    repo = new InMemoryRepository();
    await grantMiraExecution(repo, TENANT);
    const account: AccountRow = {
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
    repo.seedAccount(account);
    repo.seedIntegrationConnection(connection('active'));
    hubspot = new FakeHubspotClient();
    handlers = new ApiHandlers(
      repo,
      createGtmServices({ repo, v1Mode: true, hubspotClient: hubspot }),
    );
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    actionId = (list.body as { actions: Array<{ id: string }> }).actions[0]!.id;
    await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: { reason: { reason_code: 'meets_playbook' } },
    });
  });

  it('paused connection halts execution: 409 + audited denial + event, no CRM write', async () => {
    const paused = await handlers.pauseIntegration({
      tenantId: TENANT,
      role: 'operator',
      params: { system: 'hubspot' },
    });
    expect(paused.status).toBe(200);

    const res = await handlers.executeAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
    });
    expect(res.status).toBe(409);
    expect(hubspot.writeLog).toHaveLength(0); // the write never happened

    const audits = await repo.listAuditEvents(TENANT);
    const denial = audits.find(
      (a) => a.action === 'execution_denied' && a.detail['reason'] === 'connection_paused',
    );
    expect(denial).toBeDefined();
    const events = await repo.listEvents(TENANT);
    expect(
      events.some(
        (e) =>
          e.event_name === 'agent.action.execution_denied.v1' &&
          (e.payload as { reason?: string }).reason === 'connection_paused',
      ),
    ).toBe(true);
  });

  it('paused connection also halts rollback (audited as rollback_denied)', async () => {
    await handlers.executeAction({ tenantId: TENANT, role: 'operator', params: { id: actionId } });
    await handlers.pauseIntegration({
      tenantId: TENANT,
      role: 'operator',
      params: { system: 'hubspot' },
    });
    const res = await handlers.rollbackAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: { reason: { reason_code: 'wrong_target' } },
    });
    expect(res.status).toBe(409);
    expect(hubspot.archiveLog).toHaveLength(0);
    const audits = await repo.listAuditEvents(TENANT);
    expect(
      audits.some(
        (a) =>
          a.action === 'rollback_denied' &&
          String(a.detail['reason']).includes('connection_paused'),
      ),
    ).toBe(true);
  });

  it("an 'error' status halts too — any non-active status is a halt", async () => {
    await repo.updateIntegrationConnectionStatus(TENANT, 'hubspot', 'error');
    const res = await handlers.executeAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
    });
    expect(res.status).toBe(409);
    const audits = await repo.listAuditEvents(TENANT);
    expect(audits.some((a) => a.detail['reason'] === 'connection_error')).toBe(true);
  });

  it('resume is owner-only: operator 403; owner restores execution', async () => {
    await handlers.pauseIntegration({
      tenantId: TENANT,
      role: 'operator',
      params: { system: 'hubspot' },
    });
    await expect(
      handlers.resumeIntegration({
        tenantId: TENANT,
        role: 'operator',
        params: { system: 'hubspot' },
      }),
    ).rejects.toMatchObject({ status: 403 });

    const resumed = await handlers.resumeIntegration({
      tenantId: TENANT,
      role: 'owner',
      params: { system: 'hubspot' },
    });
    expect(resumed.status).toBe(200);
    const res = await handlers.executeAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
    });
    expect(res.status).toBe(200);
    expect(hubspot.writeLog).toHaveLength(1);
  });

  it('pause/resume flips are themselves audited', async () => {
    await handlers.pauseIntegration({
      tenantId: TENANT,
      role: 'operator',
      params: { system: 'hubspot' },
    });
    await handlers.resumeIntegration({
      tenantId: TENANT,
      role: 'owner',
      params: { system: 'hubspot' },
    });
    const audits = await repo.listAuditEvents(TENANT);
    const paused = audits.find((a) => a.action === 'integration_paused');
    const resumed = audits.find((a) => a.action === 'integration_resumed');
    expect(paused?.subject_ref).toBe('integration:hubspot');
    expect(paused?.actor_ref).toBe('user:operator');
    expect(resumed?.actor_ref).toBe('user:owner');
  });

  it('status endpoint reflects the switch; no connection row means no gate (dev mode)', async () => {
    const before = await handlers.integrationStatus({ tenantId: TENANT, role: 'viewer' });
    expect(before.body).toMatchObject({
      status: 'active',
      kill_switch: { enforced: true, halted: false },
    });
    await handlers.pauseIntegration({
      tenantId: TENANT,
      role: 'operator',
      params: { system: 'hubspot' },
    });
    const after = await handlers.integrationStatus({ tenantId: TENANT });
    expect(after.body).toMatchObject({
      status: 'paused',
      kill_switch: { halted: true },
    });

    // Dev mode: a repo with no connection row does not gate execution.
    const bareRepo = new InMemoryRepository();
    await grantMiraExecution(bareRepo, TENANT);
    bareRepo.seedAccount({
      id: 'acc-1',
      tenant_id: TENANT,
      name: 'Acme',
      domain: null,
      industry: 'SaaS',
      employee_count: 100,
      region: 'NA',
      fit_score: 0.9,
      timing_score: 0.8,
      attributes: {},
      created_at: ts,
      updated_at: ts,
    });
    const bare = new ApiHandlers(bareRepo, createGtmServices({ repo: bareRepo, v1Mode: true }));
    await bare.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await bare.listAgentActions({ tenantId: TENANT });
    const id = (list.body as { actions: Array<{ id: string }> }).actions[0]!.id;
    await bare.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id },
      body: { reason: { reason_code: 'meets_playbook' } },
    });
    const res = await bare.executeAction({ tenantId: TENANT, role: 'operator', params: { id } });
    expect(res.status).toBe(200);
  });

  it('pausing a tenant with no connection row is a 404, not a silent no-op', async () => {
    const bareRepo = new InMemoryRepository();
    const bare = new ApiHandlers(bareRepo, createGtmServices({ repo: bareRepo, v1Mode: true }));
    const res = await bare.pauseIntegration({
      tenantId: TENANT,
      role: 'operator',
      params: { system: 'hubspot' },
    });
    expect(res.status).toBe(404);
  });
});
