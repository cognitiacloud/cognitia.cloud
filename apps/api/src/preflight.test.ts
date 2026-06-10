import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow, type ContactRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers } from './handlers.js';
import type { PreflightReport } from './preflight.js';

/**
 * SIM-1 — preflight simulation. The load-bearing guarantee: the live
 * repository is byte-for-byte untouched (no actions, no runs, no events, no
 * audit entries), while the report shows exactly what a live run would do.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

function account(id: string, name: string): AccountRow {
  return {
    id,
    tenant_id: TENANT,
    name,
    domain: `${name.toLowerCase()}.com`,
    industry: 'SaaS',
    employee_count: 120,
    region: 'NA',
    fit_score: 0.9,
    timing_score: 0.8,
    attributes: {},
    created_at: ts,
    updated_at: ts,
  };
}

function contact(id: string, accountId: string, suppressed: boolean): ContactRow {
  return {
    id,
    tenant_id: TENANT,
    account_id: accountId,
    full_name: 'Pat Preflight',
    title: 'CTO',
    persona: 'champion',
    email_hash: `sha256:${id}`,
    phone_hash: null,
    is_suppressed: suppressed,
    attributes: {},
    created_at: ts,
    updated_at: ts,
  };
}

describe('POST /agent-runs/mira/preflight (SIM-1)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryRepository();
    repo.seedAccount(account('acc-1', 'Acme'));
    repo.seedAccount(account('acc-2', 'Globex'));
    repo.seedContact(contact('ct-1', 'acc-1', false));
    repo.seedContact(contact('ct-2', 'acc-2', true)); // suppressed
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  });

  it('reports would-be proposals with full GOV-1 write plans', async () => {
    const res = await handlers.preflightMira({ tenantId: TENANT, role: 'operator', body: {} });
    expect(res.status).toBe(200);
    const r = res.body as PreflightReport;
    expect(r.simulated).toBe(true);
    expect(r.writes_performed).toBe(0);
    expect(r.accounts_considered).toBe(2);
    expect(r.proposals.length).toBe(2); // one CRM task per fit account
    for (const p of r.proposals) {
      expect(p.action_type).toBe('crm.task.create');
      expect(p.plan.object).toBe('tasks');
      expect(p.plan.properties['hs_task_subject']).toBeDefined();
      expect(p.plan.properties['cognitia_idempotency_key']).toBe(p.plan.idempotency_key);
    }
    expect(r.excluded_suppressed).toContain('contact:ct-2');
    expect(r.ranked_accounts.length).toBe(2);
  });

  it('leaves the live repository completely untouched', async () => {
    await handlers.preflightMira({ tenantId: TENANT, role: 'operator', body: {} });
    expect(await repo.listAgentActions(TENANT)).toHaveLength(0);
    expect(await repo.listEvents(TENANT)).toHaveLength(0);
    expect(await repo.listAuditEvents(TENANT)).toHaveLength(0);
    // And the queue the operator sees is still empty.
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    expect((list.body as { actions: unknown[] }).actions).toHaveLength(0);
  });

  it('is repeatable: two preflights agree and still write nothing', async () => {
    const a = (await handlers.preflightMira({ tenantId: TENANT, role: 'operator', body: {} }))
      .body as PreflightReport;
    const b = (await handlers.preflightMira({ tenantId: TENANT, role: 'operator', body: {} }))
      .body as PreflightReport;
    expect(a.proposals.map((p) => p.target_ref).sort()).toEqual(
      b.proposals.map((p) => p.target_ref).sort(),
    );
    expect(await repo.listAgentActions(TENANT)).toHaveLength(0);
  });

  it('honors icp/maxAccounts inputs like a live run', async () => {
    const res = await handlers.preflightMira({
      tenantId: TENANT,
      role: 'operator',
      body: { maxAccounts: 1 },
    });
    expect((res.body as PreflightReport).proposals).toHaveLength(1);
  });

  it('requires a mutating role (viewer 403, missing 401)', async () => {
    await expect(
      handlers.preflightMira({ tenantId: TENANT, role: 'viewer', body: {} }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(handlers.preflightMira({ body: {} })).rejects.toMatchObject({ status: 401 });
  });
});
