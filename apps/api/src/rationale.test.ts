import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow, type ContactRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers } from './handlers.js';
import { buildActionRationale, type DecisionRationale } from './rationale.js';
import type { AgentActionRow } from '@cognitia/db';

/**
 * WHY-1 — decision rationale. The operator sees, before approving: the
 * fit/timing score, the grounding CRM facts (the SAME canonical evidence the
 * agent used), and data freshness with a stale-since-proposal warning.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';

function account(over: Partial<AccountRow> = {}): AccountRow {
  return {
    id: 'acc-1',
    tenant_id: TENANT,
    name: 'Acme',
    domain: 'acme.com',
    industry: 'SaaS',
    employee_count: 200,
    region: 'NA',
    fit_score: 0.9,
    timing_score: 0.8,
    attributes: {},
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

function action(over: Partial<AgentActionRow> = {}): AgentActionRow {
  return {
    id: 'a1',
    tenant_id: TENANT,
    agent_run_id: 'run-1',
    action_type: 'crm.task.create',
    risk_level: 'low',
    idempotency_key: 'k1',
    approval_status: 'proposed',
    execution_status: 'pending',
    target_ref: 'account:acc-1',
    evidence_refs: ['ev-industry-acc-1', 'ev-size-acc-1'],
    payload_ref: null,
    guardrail_results: [],
    result: null,
    created_at: '2026-06-05T00:00:00.000Z',
    updated_at: '2026-06-05T00:00:00.000Z',
    ...over,
  };
}

describe('buildActionRationale (pure)', () => {
  it('surfaces the deterministic score and the grounding CRM facts', () => {
    const now = new Date('2026-06-10T00:00:00.000Z');
    const r = buildActionRationale(action(), account(), [], now);
    // score recomputed from the account's signal columns (no ICP → fit_score).
    expect(r.score).toEqual({ fit: 0.9, timing: 0.8, combined: 0.86 });
    // canonical evidence — actual human-readable claims, not just refs.
    expect(r.evidence.map((e) => e.claim)).toEqual([
      'Acme operates in SaaS',
      'Acme has roughly 200 employees',
    ]);
    expect(r.evidence_refs_on_action).toBe(2);
  });

  it('reports data freshness in whole days from the account update time', () => {
    const now = new Date('2026-06-10T00:00:00.000Z'); // account updated 2026-06-01
    const r = buildActionRationale(action(), account(), [], now);
    expect(r.freshness?.age_days).toBe(9);
    expect(r.freshness?.stale_since_proposal).toBe(false); // updated before proposal
  });

  it('flags stale_since_proposal when the account changed AFTER the proposal', () => {
    const now = new Date('2026-06-10T00:00:00.000Z');
    // account updated 2026-06-07, proposal created 2026-06-05 → drift.
    const r = buildActionRationale(
      action(),
      account({ updated_at: '2026-06-07T00:00:00.000Z' }),
      [],
      now,
    );
    expect(r.freshness?.stale_since_proposal).toBe(true);
  });

  it('includes a champion contact fact when present', () => {
    const contact: ContactRow = {
      id: 'ct-1',
      tenant_id: TENANT,
      account_id: 'acc-1',
      full_name: 'Ada A',
      title: 'VP Eng',
      persona: 'champion',
      email_hash: 'sha256:ada',
      phone_hash: null,
      is_suppressed: false,
      attributes: {},
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    };
    const r = buildActionRationale(action(), account(), [contact]);
    expect(r.evidence.some((e) => e.claim.includes('VP Eng'))).toBe(true);
  });

  it('degrades gracefully when the target account is gone', () => {
    const r = buildActionRationale(action({ target_ref: 'account:missing' }), null, []);
    expect(r.account).toBeNull();
    expect(r.score).toBeNull();
    expect(r.freshness).toBeNull();
    expect(r.evidence_refs_on_action).toBe(2); // still reports what the action recorded
  });
});

describe('GET /agent-actions/:id/rationale (WHY-1)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;
  let actionId: string;

  beforeEach(async () => {
    repo = new InMemoryRepository();
    repo.seedAccount(account());
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    actionId = (list.body as { actions: Array<{ id: string }> }).actions[0]!.id;
  });

  it('returns the rationale for a proposed action (viewer-allowed)', async () => {
    const res = await handlers.actionRationale({
      tenantId: TENANT,
      role: 'viewer',
      params: { id: actionId },
    });
    expect(res.status).toBe(200);
    const r = res.body as DecisionRationale;
    expect(r.account?.name).toBe('Acme');
    expect(r.score?.combined).toBeGreaterThan(0);
    expect(r.evidence.length).toBeGreaterThanOrEqual(1);
    expect(r.freshness).not.toBeNull();
  });

  it('404 on unknown action; 401 without principal', async () => {
    const missing = await handlers.actionRationale({ tenantId: TENANT, params: { id: 'nope' } });
    expect(missing.status).toBe(404);
    await expect(handlers.actionRationale({ params: { id: actionId } })).rejects.toMatchObject({
      status: 401,
    });
  });

  it('is tenant-scoped (other tenant cannot read this action)', async () => {
    const other = await handlers.actionRationale({
      tenantId: '22222222-2222-2222-2222-222222222222',
      params: { id: actionId },
    });
    expect(other.status).toBe(404);
  });
});
