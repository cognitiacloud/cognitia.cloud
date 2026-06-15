import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow, type OpportunityRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers } from './handlers.js';

/**
 * EVID-1 — evidence-interface read models: integration sync history and
 * opportunities visibility. Read-only, viewer-allowed, tenant-scoped; both
 * reuse existing domain data (no new write paths).
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

function account(id: string): AccountRow {
  return {
    id,
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

function opportunity(id: string, accountId: string): OpportunityRow {
  return {
    id,
    tenant_id: TENANT,
    account_id: accountId,
    name: 'Acme Expansion',
    stage: 'qualified',
    amount: 50000,
    owner_ref: 'owner:1',
    attributes: {},
    created_at: ts,
    updated_at: ts,
  };
}

describe('EVID-1 — opportunities visibility', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryRepository();
    repo.seedAccount(account('acc-1'));
    repo.seedOpportunity(opportunity('opp-1', 'acc-1'));
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  });

  it('GET /opportunities lists the tenant opportunities (viewer-allowed, tenant-scoped)', async () => {
    const res = await handlers.listOpportunities({ tenantId: TENANT, role: 'viewer' });
    expect(res.status).toBe(200);
    const opps = (res.body as { opportunities: OpportunityRow[] }).opportunities;
    expect(opps).toHaveLength(1);
    expect(opps[0]!.name).toBe('Acme Expansion');

    await expect(handlers.listOpportunities({})).rejects.toMatchObject({ status: 401 });
    const other = await handlers.listOpportunities({
      tenantId: '22222222-2222-2222-2222-222222222222',
    });
    expect((other.body as { opportunities: unknown[] }).opportunities).toEqual([]);
  });

  it('account context now includes the account’s opportunities', async () => {
    const res = await handlers.getAccountContext({ tenantId: TENANT, params: { id: 'acc-1' } });
    expect(res.status).toBe(200);
    const body = res.body as { opportunities: OpportunityRow[] };
    expect(body.opportunities).toHaveLength(1);
  });
});

describe('EVID-1 — integration sync history', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryRepository();
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  });

  it('GET /integrations/sync-history lists sync runs newest-first (viewer-allowed)', async () => {
    const first = await repo.createSyncRun({ tenantId: TENANT, status: 'running' });
    await repo.updateSyncRun(TENANT, first.id, {
      status: 'completed',
      finished_at: ts,
      stats: { companies: 3, contacts: 5, deals: 2 },
    });
    await repo.createSyncRun({ tenantId: TENANT, status: 'failed' });

    const res = await handlers.listSyncRuns({ tenantId: TENANT, role: 'viewer' });
    expect(res.status).toBe(200);
    const runs = (res.body as { sync_runs: Array<{ status: string; stats: unknown }> }).sync_runs;
    expect(runs).toHaveLength(2);
    // The completed run carries its entity stats — the audit evidence.
    const completed = runs.find((r) => r.status === 'completed');
    expect(completed?.stats).toMatchObject({ companies: 3, contacts: 5, deals: 2 });
  });

  it('is tenant-scoped and requires auth', async () => {
    await repo.createSyncRun({ tenantId: TENANT, status: 'completed' });
    await expect(handlers.listSyncRuns({})).rejects.toMatchObject({ status: 401 });
    const other = await handlers.listSyncRuns({
      tenantId: '22222222-2222-2222-2222-222222222222',
    });
    expect((other.body as { sync_runs: unknown[] }).sync_runs).toEqual([]);
  });
});
