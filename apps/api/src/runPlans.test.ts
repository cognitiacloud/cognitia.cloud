import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers } from './handlers.js';
import { buildRunPlans } from './runPlans.js';
import type { AgentRunRow, AgentActionRow } from '@cognitia/db';

/**
 * RUN-1 — run/plan rollups. A run's proposed actions are reviewable as one
 * unit with a governance rollup; `fully_reviewed` flips only when nothing is
 * still awaiting a decision.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

function run(id: string): AgentRunRow {
  return {
    id,
    tenant_id: TENANT,
    agent: 'mira',
    objective: 'build outbound pipeline',
    input_refs: [],
    status: 'completed',
    trace_id: 't',
    created_at: ts,
    updated_at: ts,
  };
}

function action(over: Partial<AgentActionRow>): AgentActionRow {
  return {
    id: 'a',
    tenant_id: TENANT,
    agent_run_id: 'run-1',
    action_type: 'crm.task.create',
    risk_level: 'low',
    idempotency_key: 'k',
    approval_status: 'proposed',
    execution_status: 'pending',
    target_ref: 'account:x',
    evidence_refs: [],
    payload_ref: null,
    guardrail_results: [],
    result: null,
    created_at: ts,
    updated_at: ts,
    ...over,
  };
}

describe('buildRunPlans (pure)', () => {
  it('rolls up each run’s actions by approval/execution and action type', () => {
    const runs = [run('run-1')];
    const actions = [
      action({
        id: 'a1',
        action_type: 'crm.task.create',
        approval_status: 'approved',
        execution_status: 'executed',
      }),
      action({
        id: 'a2',
        action_type: 'crm.note.create',
        approval_status: 'approved',
        execution_status: 'executed',
      }),
      action({ id: 'a3', action_type: 'crm.task.create', approval_status: 'rejected' }),
    ];
    const plans = buildRunPlans(runs, actions);
    expect(plans).toHaveLength(1);
    const p = plans[0]!;
    expect(p.rollup).toMatchObject({
      total: 3,
      approved: 2,
      rejected: 1,
      executed: 2,
      proposed: 0,
    });
    expect(p.rollup.action_types).toEqual({ 'crm.task.create': 2, 'crm.note.create': 1 });
    expect(p.fully_reviewed).toBe(true); // nothing still proposed
  });

  it('fully_reviewed is false while any action is still awaiting a decision', () => {
    const plans = buildRunPlans(
      [run('run-1')],
      [
        action({ id: 'a1', approval_status: 'approved' }),
        action({ id: 'a2', approval_status: 'proposed' }),
      ],
    );
    expect(plans[0]!.rollup.proposed).toBe(1);
    expect(plans[0]!.fully_reviewed).toBe(false);
  });

  it('a run with no actions is not fully_reviewed (nothing to act on)', () => {
    const plans = buildRunPlans([run('run-empty')], []);
    expect(plans[0]!.rollup.total).toBe(0);
    expect(plans[0]!.fully_reviewed).toBe(false);
  });
});

describe('GET /agent-runs (RUN-1)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;

  beforeEach(async () => {
    repo = new InMemoryRepository();
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
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  });

  it('lists runs with a governance rollup (viewer-allowed, tenant-scoped)', async () => {
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const res = await handlers.listRunPlans({ tenantId: TENANT, role: 'viewer' });
    expect(res.status).toBe(200);
    const runs = (res.body as { runs: Array<{ rollup: { total: number; proposed: number } }> })
      .runs;
    expect(runs).toHaveLength(1);
    // One fit account → one task + one grounded note, both awaiting review.
    expect(runs[0]!.rollup.total).toBe(2);
    expect(runs[0]!.rollup.proposed).toBe(2);

    await expect(handlers.listRunPlans({})).rejects.toMatchObject({ status: 401 });
    const other = await handlers.listRunPlans({
      tenantId: '22222222-2222-2222-2222-222222222222',
    });
    expect((other.body as { runs: unknown[] }).runs).toEqual([]);
  });

  it('the rollup reflects decisions as the operator reviews the run', async () => {
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    const ids = (list.body as { actions: Array<{ id: string }> }).actions.map((a) => a.id);
    await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: ids[0]! },
      body: { reason: { reason_code: 'meets_playbook' } },
    });
    await handlers.rejectAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: ids[1]! },
      body: { reason: { reason_code: 'wrong_target' } },
    });
    const res = await handlers.listRunPlans({ tenantId: TENANT });
    const plan = (
      res.body as { runs: Array<{ rollup: Record<string, number>; fully_reviewed: boolean }> }
    ).runs[0]!;
    expect(plan.rollup).toMatchObject({ approved: 1, rejected: 1, proposed: 0 });
    expect(plan.fully_reviewed).toBe(true);
  });
});
