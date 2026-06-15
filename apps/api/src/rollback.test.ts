import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers } from './handlers.js';
import type { TrustMetrics } from './trustMetrics.js';
import { grantMiraExecution } from './passportTestKit.js';

/**
 * UNDO-1 — typed rollback, end to end: execute → undo archives the external
 * object, transitions the action to rolled_back, and leaves the same
 * accountability trail as execution (label + event + audit). Refusals are
 * 409s with a rollback_denied audit entry.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

describe('POST /agent-actions/:id/rollback (UNDO-1)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;
  let hubspot: FakeHubspotClient;
  let actionId: string;

  const reason = { reason: { reason_code: 'wrong_target' } };

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
    hubspot = new FakeHubspotClient();
    handlers = new ApiHandlers(
      repo,
      createGtmServices({ repo, v1Mode: true, hubspotClient: hubspot }),
    );
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    actionId = (list.body as { actions: Array<{ id: string }> }).actions[0]!.id;
  });

  async function approveAndExecute(): Promise<void> {
    await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: { reason: { reason_code: 'meets_playbook' } },
    });
    await handlers.executeAction({ tenantId: TENANT, role: 'operator', params: { id: actionId } });
  }

  it('archives the external object and records label + event + audit', async () => {
    await approveAndExecute();
    const res = await handlers.rollbackAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: reason,
    });
    expect(res.status).toBe(200);
    const action = res.body as {
      execution_status: string;
      result: { rolled_back?: boolean; external_ref?: string };
    };
    expect(action.execution_status).toBe('rolled_back');
    expect(action.result.rolled_back).toBe(true);
    // The external object created at execute time is the one archived.
    expect(hubspot.archiveLog).toHaveLength(1);
    expect(`hubspot:${hubspot.archiveLog[0]!.object}`).toContain('hubspot:task');
    // Accountability trail mirrors execution.
    const labels = await repo.listFeedbackLabels(TENANT, `agent_action:${actionId}`);
    const rb = labels.find((l) => l.label === 'rolled_back');
    expect(rb?.detail['reason_code']).toBe('wrong_target');
    const audits = await repo.listAuditEvents(TENANT);
    expect(audits.some((a) => a.action === 'rolled_back')).toBe(true);
    const events = await repo.listEvents(TENANT);
    expect(events.some((e) => e.event_name === 'agent.action.rolled_back.v1')).toBe(true);
  });

  it('is idempotent: a second rollback returns the row without re-archiving', async () => {
    await approveAndExecute();
    await handlers.rollbackAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: reason,
    });
    const second = await handlers.rollbackAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: reason,
    });
    expect(second.status).toBe(200);
    expect(hubspot.archiveLog).toHaveLength(1);
    const labels = await repo.listFeedbackLabels(TENANT, `agent_action:${actionId}`);
    expect(labels.filter((l) => l.label === 'rolled_back')).toHaveLength(1);
  });

  it('refuses to roll back an unexecuted action (409 + rollback_denied audit)', async () => {
    const res = await handlers.rollbackAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: reason,
    });
    expect(res.status).toBe(409);
    const audits = await repo.listAuditEvents(TENANT);
    const denial = audits.find((a) => a.action === 'rollback_denied');
    expect(denial).toBeDefined();
    expect(String(denial!.detail['reason'])).toContain('not executed');
    expect(hubspot.archiveLog).toHaveLength(0);
  });

  it('requires a structured reason (400) and a mutating role (403)', async () => {
    await approveAndExecute();
    const noReason = await handlers.rollbackAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: {},
    });
    expect(noReason.status).toBe(400);
    await expect(
      handlers.rollbackAction({
        tenantId: TENANT,
        role: 'viewer',
        params: { id: actionId },
        body: reason,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('does not skew trust metrics: rolled_back is not counted as a rejection', async () => {
    await approveAndExecute();
    await handlers.rollbackAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: reason,
    });
    const metrics = await handlers.metricsTrust({ tenantId: TENANT });
    const m = metrics.body as TrustMetrics;
    expect(m.actions.rejected).toBe(0);
    expect(m.approval_rate).toBe(1);
    expect(m.reject_reasons).toEqual({});
  });
});
