import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow, type ContactRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers } from './handlers.js';
import { computeTrustMetrics, type TrustMetrics } from './trustMetrics.js';
import type { AgentActionRow, FeedbackLabelRow } from '@cognitia/db';

/**
 * MET-1 — trust metrics. Unit tests for the pure computation, plus an
 * end-to-end flow proving the endpoint reflects real ledger activity.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

function action(over: Partial<AgentActionRow>): AgentActionRow {
  return {
    id: 'a1',
    tenant_id: TENANT,
    agent_run_id: 'run-1',
    action_type: 'crm.task.create',
    risk_level: 'low',
    idempotency_key: 'k1',
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

function label(over: Partial<FeedbackLabelRow>): FeedbackLabelRow {
  return {
    id: 'l1',
    tenant_id: TENANT,
    subject_ref: 'agent_action:a1',
    label: 'approved',
    detail: { reason_code: 'meets_playbook' },
    created_at: '2026-06-10T00:00:30.000Z',
    updated_at: '2026-06-10T00:00:30.000Z',
    ...over,
  };
}

describe('computeTrustMetrics (pure)', () => {
  it('returns nulls and zeros on an empty tenant', () => {
    const m = computeTrustMetrics([], []);
    expect(m.approval_rate).toBeNull();
    expect(m.median_decision_seconds).toBeNull();
    expect(m.duplicate_writes_prevented).toBe(0);
    expect(m.actions).toEqual({
      proposed: 0,
      approved: 0,
      rejected: 0,
      executed: 0,
      failed: 0,
      rolled_back: 0,
    });
  });

  it('computes approval rate over decided actions only', () => {
    const m = computeTrustMetrics(
      [
        action({ id: 'a1', approval_status: 'approved' }),
        action({ id: 'a2', approval_status: 'approved' }),
        action({ id: 'a3', approval_status: 'rejected' }),
        action({ id: 'a4', approval_status: 'proposed' }), // undecided — excluded
      ],
      [],
    );
    expect(m.approval_rate).toBeCloseTo(2 / 3);
    expect(m.actions.proposed).toBe(1);
  });

  it('aggregates reason mixes per decision kind and decision latency (median)', () => {
    const actions = [
      action({ id: 'a1', approval_status: 'approved', created_at: ts }),
      action({ id: 'a2', approval_status: 'rejected', created_at: ts }),
      action({ id: 'a3', approval_status: 'rejected', created_at: ts }),
    ];
    const labels = [
      label({ id: 'l1', subject_ref: 'agent_action:a1', created_at: '2026-06-10T00:00:10.000Z' }),
      label({
        id: 'l2',
        subject_ref: 'agent_action:a2',
        label: 'rejected',
        detail: { reason_code: 'wrong_target' },
        created_at: '2026-06-10T00:00:30.000Z',
      }),
      label({
        id: 'l3',
        subject_ref: 'agent_action:a3',
        label: 'rejected',
        detail: { reason_code: 'wrong_target' },
        created_at: '2026-06-10T00:01:40.000Z',
      }),
    ];
    const m = computeTrustMetrics(actions, labels);
    expect(m.approve_reasons).toEqual({ meets_playbook: 1 });
    expect(m.reject_reasons).toEqual({ wrong_target: 2 });
    // Latencies: 10s, 30s, 100s → median 30s.
    expect(m.median_decision_seconds).toBe(30);
  });

  it('counts idempotent replays as duplicate writes prevented', () => {
    const m = computeTrustMetrics(
      [
        action({
          id: 'a1',
          approval_status: 'approved',
          execution_status: 'executed',
          result: { ok: true, idempotent_replay: true },
        }),
        action({
          id: 'a2',
          approval_status: 'approved',
          execution_status: 'executed',
          result: { ok: true, idempotent_replay: false },
        }),
      ],
      [],
    );
    expect(m.duplicate_writes_prevented).toBe(1);
    expect(m.actions.executed).toBe(2);
  });

  it('ignores labels with unknown subjects or missing codes without crashing', () => {
    const m = computeTrustMetrics(
      [action({ id: 'a1', approval_status: 'approved' })],
      [
        label({ subject_ref: 'agent_action:ghost' }),
        label({ id: 'l2', detail: {} }),
        label({ id: 'l3', subject_ref: 'conversation:c1' }),
      ],
    );
    expect(m.approve_reasons).toEqual({ meets_playbook: 2 });
    expect(m.median_decision_seconds).toBe(30); // only the matching a1 label counts
  });
});

describe('GET /metrics/trust — end to end', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;

  beforeEach(() => {
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
      created_at: ts,
      updated_at: ts,
    };
    repo.seedAccount(account);
    repo.seedContact(contact);
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  });

  it('reflects a real run → approve → execute flow', async () => {
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({
      tenantId: TENANT,
      query: { status: 'proposed' },
    });
    const id = (list.body as { actions: Array<{ id: string }> }).actions[0]!.id;
    await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id },
      body: { reason: { reason_code: 'high_value_target' } },
    });
    await handlers.executeAction({ tenantId: TENANT, role: 'operator', params: { id } });

    const res = await handlers.metricsTrust({ tenantId: TENANT, role: 'viewer' });
    expect(res.status).toBe(200);
    const m = res.body as TrustMetrics;
    expect(m.actions.approved).toBe(1);
    expect(m.actions.executed).toBe(1);
    expect(m.approval_rate).toBe(1);
    expect(m.approve_reasons).toEqual({ high_value_target: 1 });
    expect(m.median_decision_seconds).not.toBeNull();
  });

  it('is tenant-scoped and requires auth (401 without principal)', async () => {
    await expect(handlers.metricsTrust({})).rejects.toMatchObject({ status: 401 });
    const other = await handlers.metricsTrust({
      tenantId: '22222222-2222-2222-2222-222222222222',
    });
    expect((other.body as TrustMetrics).actions.proposed).toBe(0);
  });
});
