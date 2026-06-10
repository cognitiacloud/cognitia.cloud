import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow, type ContactRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiResponse } from './handlers.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const OTHER_TENANT = '22222222-2222-2222-2222-222222222222';
const ACCOUNT = 'a1000000-0000-0000-0000-000000000001';
const CONTACT = 'a2000000-0000-0000-0000-000000000001';
const ts = '2026-06-06T00:00:00.000Z';

function seedRepo(): InMemoryRepository {
  const repo = new InMemoryRepository();
  const account: AccountRow = {
    id: ACCOUNT,
    tenant_id: TENANT,
    name: 'Target Co',
    domain: 'target.com',
    industry: 'SaaS',
    employee_count: 200,
    region: 'NA',
    fit_score: 0.9,
    timing_score: 0.8,
    attributes: {},
    created_at: ts,
    updated_at: ts,
  };
  const contact: ContactRow = {
    id: CONTACT,
    tenant_id: TENANT,
    account_id: ACCOUNT,
    full_name: 'Ada A',
    title: 'VP Eng',
    persona: 'champion',
    email_hash: 'sha256:ada',
    phone_hash: null,
    is_suppressed: false,
    attributes: {},
    created_at: ts,
    updated_at: ts,
  };
  repo.seedAccount(account);
  repo.seedContact(contact);
  return repo;
}

function makeHandlers() {
  const repo = seedRepo();
  const services = createGtmServices({ repo });
  return { handlers: new ApiHandlers(repo, services), repo };
}

function firstEmailActionId(body: ApiResponse['body']): string {
  const actions = (body as { actions: Array<{ id: string; action_type: string }> }).actions;
  const email = actions.find((a) => a.action_type === 'email.draft.send');
  if (!email) throw new Error('no email action');
  return email.id;
}

describe('API handlers — Mira approval flow', () => {
  let handlers: ApiHandlers;

  beforeEach(() => {
    handlers = makeHandlers().handlers;
  });

  it('GET /health returns ok', async () => {
    const res = await handlers.health();
    expect(res.status).toBe(200);
  });

  it('requires a tenant header (throws HttpError -> 401 at transport)', async () => {
    await expect(handlers.listAccounts({})).rejects.toMatchObject({ status: 401 });
  });

  it('POST /agent-runs/mira creates a run and proposed actions', async () => {
    const res = await handlers.runMira({
      tenantId: TENANT,
      role: 'operator',
      body: { objective: 'outbound' },
    });
    expect(res.status).toBe(201);
    const body = res.body as { runId: string; proposedActionIds: string[] };
    expect(body.proposedActionIds.length).toBeGreaterThan(0);

    const list = await handlers.listAgentActions({
      tenantId: TENANT,
      query: { status: 'proposed' },
    });
    const actions = (list.body as { actions: unknown[] }).actions;
    expect(actions.length).toBe(body.proposedActionIds.length);
  });

  it('GET /agent-actions embeds the draft (with evidence refs)', async () => {
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({
      tenantId: TENANT,
      query: { status: 'proposed' },
    });
    const actions = (
      list.body as {
        actions: Array<{ action_type: string; draft: { evidence_refs: string[] } | null }>;
      }
    ).actions;
    const email = actions.find((a) => a.action_type === 'email.draft.send');
    expect(email?.draft?.evidence_refs.length).toBeGreaterThan(0);
  });

  it('execute is refused (409) until approved, then succeeds', async () => {
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({
      tenantId: TENANT,
      query: { status: 'proposed' },
    });
    const id = firstEmailActionId(list.body);

    // Execute before approval => 409.
    const refused = await handlers.executeAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id },
    });
    expect(refused.status).toBe(409);

    // Approve (with the required structured reason), then execute.
    const approve = await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id },
      body: { reason: { reason_code: 'accurate_and_relevant' } },
    });
    expect(approve.status).toBe(200);
    const exec = await handlers.executeAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id },
    });
    expect(exec.status).toBe(200);
    expect((exec.body as { execution_status: string }).execution_status).toBe('executed');
  });

  it('enforces tenant isolation on the queue', async () => {
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const otherList = await handlers.listAgentActions({
      tenantId: OTHER_TENANT,
      query: { status: 'proposed' },
    });
    expect((otherList.body as { actions: unknown[] }).actions).toHaveLength(0);
  });

  it('duplicate webhook ingest does not duplicate contacts (idempotent)', async () => {
    // The signed-webhook HTTP path is covered in webhookHubspot.test.ts; here we
    // assert the underlying idempotent ingest the handler delegates to.
    const { repo } = makeHandlers();
    const input = {
      tenantId: TENANT,
      externalSystem: 'hubspot',
      externalId: 'hs-123',
      contact: { fullName: 'Ada A', title: 'VP Eng', emailHash: 'sha256:ada' },
    };
    const first = await repo.ingestExternalContact(input);
    const second = await repo.ingestExternalContact(input);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.contactId).toBe(first.contactId);
  });

  it('GET /metrics/outbound reflects approval/execution counts', async () => {
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({
      tenantId: TENANT,
      query: { status: 'proposed' },
    });
    const id = firstEmailActionId(list.body);
    await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id },
      body: { reason: { reason_code: 'accurate_and_relevant' } },
    });
    await handlers.executeAction({ tenantId: TENANT, role: 'operator', params: { id } });

    const metrics = await handlers.metricsOutbound({ tenantId: TENANT });
    const body = metrics.body as { approved: number; executed: number };
    expect(body.approved).toBeGreaterThanOrEqual(1);
    expect(body.executed).toBeGreaterThanOrEqual(1);
  });

  it('RBAC: a viewer cannot run/approve/execute (403)', async () => {
    await expect(
      handlers.runMira({ tenantId: TENANT, role: 'viewer', body: {} }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      handlers.approveAction({ tenantId: TENANT, role: 'viewer', params: { id: 'x' } }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      handlers.executeAction({ tenantId: TENANT, role: 'viewer', params: { id: 'x' } }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('health returns 503 when the DB probe fails', async () => {
    const repo = seedRepo();
    const h = new ApiHandlers(repo, createGtmServices({ repo }), {
      healthCheck: async () => false,
    });
    expect((await h.health()).status).toBe(503);
  });
});
