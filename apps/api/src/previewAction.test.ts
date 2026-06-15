import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient, PROVENANCE_PROPERTIES } from '@cognitia/integrations';
import { ApiHandlers } from './handlers.js';
import { grantMiraExecution } from './passportTestKit.js';

/**
 * GOV-1 — execution preview + audited denials, end to end through the API:
 * propose → preview (pre-approval) → approve → preview (approver visible) →
 * execute → the logged write content matches the previewed plan; and a
 * refused execution leaves an audit artifact.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

interface PreviewBody {
  would_execute: boolean;
  denial_reason?: string;
  idempotent_replay_expected: boolean;
  plan: { object: string; properties: Record<string, unknown>; idempotency_key: string };
}

describe('GET /agent-actions/:id/preview (GOV-1)', () => {
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
    hubspot = new FakeHubspotClient();
    handlers = new ApiHandlers(
      repo,
      createGtmServices({ repo, v1Mode: true, hubspotClient: hubspot }),
    );
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    actionId = (list.body as { actions: Array<{ id: string }> }).actions[0]!.id;
  });

  it('shows the typed plan pre-approval: no approver, would_execute=false', async () => {
    const res = await handlers.previewAction({
      tenantId: TENANT,
      role: 'viewer', // read-only — viewers may inspect
      params: { id: actionId },
    });
    expect(res.status).toBe(200);
    const p = res.body as PreviewBody;
    expect(p.would_execute).toBe(false);
    expect(p.denial_reason).toBe('not_approved');
    expect(p.plan.object).toBe('tasks');
    expect(p.plan.properties['hs_task_subject']).toBeDefined();
    expect(p.plan.properties['cognitia_idempotency_key']).toBe(p.plan.idempotency_key);
    expect(p.plan.properties[PROVENANCE_PROPERTIES.agentActionId]).toBe(actionId);
    expect(p.plan.properties).not.toHaveProperty(PROVENANCE_PROPERTIES.approvedBy);
  });

  it('after approval the approver is in the plan; after execution the logged write matches it', async () => {
    await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: { reason: { reason_code: 'meets_playbook' } },
    });
    const approvedPreview = await handlers.previewAction({
      tenantId: TENANT,
      params: { id: actionId },
    });
    const plan = (approvedPreview.body as PreviewBody).plan;
    expect((approvedPreview.body as PreviewBody).would_execute).toBe(true);
    expect(plan.properties[PROVENANCE_PROPERTIES.approvedBy]).toBe('user:operator');

    await handlers.executeAction({ tenantId: TENANT, role: 'operator', params: { id: actionId } });
    // The adapter sent exactly the previewed content (content subset of plan).
    const logged = hubspot.writeLog[0]!;
    expect(logged.kind).toBe('task');
    for (const [k, v] of Object.entries(logged.input.payload)) {
      expect(plan.properties[k]).toEqual(v);
    }
    expect(logged.input.idempotencyKey).toBe(plan.idempotency_key);

    const post = await handlers.previewAction({ tenantId: TENANT, params: { id: actionId } });
    expect((post.body as PreviewBody).idempotent_replay_expected).toBe(true);
  });

  it('audits refused executions (execution_denied)', async () => {
    const res = await handlers.executeAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
    });
    expect(res.status).toBe(409);
    const audits = await repo.listAuditEvents(TENANT);
    const denial = audits.find((a) => a.action === 'execution_denied');
    expect(denial).toBeDefined();
    expect(denial!.subject_ref).toBe(`agent_action:${actionId}`);
    expect(denial!.detail['reason']).toBe('not_approved');
  });

  it('404 on unknown action; 401 without principal', async () => {
    const missing = await handlers.previewAction({ tenantId: TENANT, params: { id: 'nope' } });
    expect(missing.status).toBe(404);
    await expect(handlers.previewAction({ params: { id: actionId } })).rejects.toMatchObject({
      status: 401,
    });
  });
});
