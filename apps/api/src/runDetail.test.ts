import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers } from './handlers.js';

/**
 * RUN-2 — run detail/timeline. GET /agent-runs/:id returns the run plus its
 * proposed actions (ordered) and the governance rollup. Read-only,
 * viewer-allowed, tenant-scoped; reuses the ledger (no new write paths).
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
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

describe('RUN-2 — run detail/timeline (GET /agent-runs/:id)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryRepository();
    repo.seedAccount(account());
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  });

  async function makeRun(): Promise<string> {
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const runs = await repo.listAgentRuns(TENANT);
    return runs[0]!.id;
  }

  it('returns the run with its action timeline and rollup (viewer-allowed)', async () => {
    const runId = await makeRun();
    const res = await handlers.getAgentRun({
      tenantId: TENANT,
      role: 'viewer',
      params: { id: runId },
    });
    expect(res.status).toBe(200);
    const body = res.body as {
      run: { id: string };
      rollup: { total: number; proposed: number };
      actions: Array<{ agent_run_id: string; created_at: string }>;
    };
    expect(body.run.id).toBe(runId);
    // One fit account → one task + one grounded note, both awaiting review.
    expect(body.rollup.total).toBe(2);
    expect(body.rollup.proposed).toBe(2);
    expect(body.actions).toHaveLength(2);
    // Every action in the timeline belongs to this run.
    expect(body.actions.every((a) => a.agent_run_id === runId)).toBe(true);
    // Timeline is ordered by created_at (non-decreasing).
    const times = body.actions.map((a) => a.created_at);
    expect([...times].sort()).toEqual(times);
  });

  it('404s for an unknown run id', async () => {
    const res = await handlers.getAgentRun({ tenantId: TENANT, params: { id: 'nope' } });
    expect(res.status).toBe(404);
  });

  it('requires auth and is tenant-scoped', async () => {
    const runId = await makeRun();
    await expect(handlers.getAgentRun({ params: { id: runId } })).rejects.toMatchObject({
      status: 401,
    });
    // Another tenant cannot see this run.
    const other = await handlers.getAgentRun({ tenantId: OTHER, params: { id: runId } });
    expect(other.status).toBe(404);
  });
});
