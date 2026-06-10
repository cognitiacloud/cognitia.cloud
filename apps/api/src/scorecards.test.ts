import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers } from './handlers.js';
import { computeScorecards, AUTONOMY_THRESHOLDS, type ScorecardReport } from './scorecards.js';
import type { AgentActionRow, FeedbackLabelRow } from '@cognitia/db';

/**
 * LEARN-1 — per-segment scorecards. The segmented numbers must equal the same
 * computation as the aggregate, segment by action_type × risk; and the
 * read-only autonomy indicator must be conservative and falsifiable (a single
 * policy/risk rejection or rollback disqualifies a segment).
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

function action(over: Partial<AgentActionRow>): AgentActionRow {
  return {
    id: 'a',
    tenant_id: TENANT,
    agent_run_id: 'run-1',
    action_type: 'crm.task.create',
    risk_level: 'low',
    idempotency_key: 'k',
    approval_status: 'approved',
    execution_status: 'executed',
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
    id: 'l',
    tenant_id: TENANT,
    subject_ref: 'agent_action:a',
    label: 'approved',
    detail: { reason_code: 'meets_playbook' },
    created_at: '2026-06-10T00:00:30.000Z',
    updated_at: '2026-06-10T00:00:30.000Z',
    ...over,
  };
}

describe('computeScorecards (pure)', () => {
  it('splits metrics by action_type × risk and matches the aggregate per segment', () => {
    const actions = [
      action({
        id: 'a1',
        action_type: 'crm.task.create',
        risk_level: 'low',
        approval_status: 'approved',
      }),
      action({
        id: 'a2',
        action_type: 'crm.task.create',
        risk_level: 'low',
        approval_status: 'rejected',
      }),
      action({
        id: 'a3',
        action_type: 'crm.note.create',
        risk_level: 'medium',
        approval_status: 'approved',
      }),
    ];
    const labels = [
      label({ id: 'l1', subject_ref: 'agent_action:a1', label: 'approved' }),
      label({
        id: 'l2',
        subject_ref: 'agent_action:a2',
        label: 'rejected',
        detail: { reason_code: 'wrong_target' },
      }),
      label({ id: 'l3', subject_ref: 'agent_action:a3', label: 'approved' }),
    ];
    const r = computeScorecards(actions, labels);
    expect(r.overall.actions.approved).toBe(2);
    const task = r.segments.find(
      (s) => s.action_type === 'crm.task.create' && s.risk_level === 'low',
    )!;
    expect(task.metrics.actions.approved).toBe(1);
    expect(task.metrics.actions.rejected).toBe(1);
    expect(task.metrics.approval_rate).toBe(0.5);
    expect(task.metrics.reject_reasons).toEqual({ wrong_target: 1 });
    const note = r.segments.find((s) => s.action_type === 'crm.note.create')!;
    expect(note.metrics.actions.approved).toBe(1);
    expect(note.metrics.approval_rate).toBe(1);
  });

  it('autonomy indicator is conservative: needs volume AND a high approval rate', () => {
    // 25 approvals, 0 rejections, no rollbacks → clears the bar.
    const actions = Array.from({ length: 25 }, (_, i) =>
      action({ id: `a${i}`, approval_status: 'approved', execution_status: 'executed' }),
    );
    const labels = actions.map((a) =>
      label({ id: `l${a.id}`, subject_ref: `agent_action:${a.id}`, label: 'approved' }),
    );
    const seg = computeScorecards(actions, labels).segments[0]!;
    expect(seg.autonomy_indicator.meets_threshold).toBe(true);
    expect(seg.autonomy_indicator.reasons).toEqual([]);
  });

  it('a single policy_or_risk rejection disqualifies the segment (falsifiable)', () => {
    const actions = Array.from({ length: 25 }, (_, i) =>
      action({ id: `a${i}`, approval_status: 'approved' }),
    );
    actions.push(action({ id: 'bad', approval_status: 'rejected' }));
    const labels: FeedbackLabelRow[] = actions.map((a) =>
      a.id === 'bad'
        ? label({
            id: 'lbad',
            subject_ref: 'agent_action:bad',
            label: 'rejected',
            detail: { reason_code: 'policy_or_risk' },
          })
        : label({ id: `l${a.id}`, subject_ref: `agent_action:${a.id}`, label: 'approved' }),
    );
    const seg = computeScorecards(actions, labels).segments[0]!;
    expect(seg.autonomy_indicator.meets_threshold).toBe(false);
    expect(seg.autonomy_indicator.reasons.some((r) => r.includes('policy_or_risk'))).toBe(true);
  });

  it('a rolled-back execution disqualifies the segment', () => {
    const actions = Array.from({ length: 25 }, (_, i) =>
      action({
        id: `a${i}`,
        approval_status: 'approved',
        execution_status: i === 0 ? 'rolled_back' : 'executed',
      }),
    );
    const labels = actions.map((a) =>
      label({ id: `l${a.id}`, subject_ref: `agent_action:${a.id}`, label: 'approved' }),
    );
    const seg = computeScorecards(actions, labels).segments[0]!;
    expect(seg.autonomy_indicator.meets_threshold).toBe(false);
    expect(seg.autonomy_indicator.reasons.some((r) => r.includes('rolled-back'))).toBe(true);
  });

  it('a low-volume perfect segment does NOT clear the bar (no premature autonomy)', () => {
    const actions = [action({ id: 'a1', approval_status: 'approved' })];
    const labels = [label({ id: 'l1', subject_ref: 'agent_action:a1', label: 'approved' })];
    const seg = computeScorecards(actions, labels).segments[0]!;
    expect(seg.autonomy_indicator.meets_threshold).toBe(false);
    expect(AUTONOMY_THRESHOLDS.minDecisions).toBeGreaterThan(1);
  });

  it('empty tenant yields no segments and a null overall approval rate', () => {
    const r = computeScorecards([], []);
    expect(r.segments).toEqual([]);
    expect(r.overall.approval_rate).toBeNull();
  });
});

describe('GET /metrics/scorecards + trust-packet embedding (LEARN-1)', () => {
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
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    const id = (list.body as { actions: Array<{ id: string }> }).actions[0]!.id;
    await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id },
      body: { reason: { reason_code: 'meets_playbook' } },
    });
  });

  it('serves segmented scorecards (viewer-allowed, tenant-scoped)', async () => {
    const res = await handlers.metricsScorecards({ tenantId: TENANT, role: 'viewer' });
    expect(res.status).toBe(200);
    const r = res.body as ScorecardReport;
    expect(r.overall.actions.approved).toBe(1);
    const seg = r.segments.find((s) => s.action_type === 'crm.task.create');
    expect(seg).toBeDefined();
    expect(seg!.metrics.actions.approved).toBe(1);
    expect(seg!.autonomy_indicator.meets_threshold).toBe(false); // 1 decision < threshold

    await expect(handlers.metricsScorecards({})).rejects.toMatchObject({ status: 401 });
    const other = await handlers.metricsScorecards({
      tenantId: '22222222-2222-2222-2222-222222222222',
    });
    expect((other.body as ScorecardReport).segments).toEqual([]);
  });

  it('the trust packet embeds the scorecards section', async () => {
    const res = await handlers.trustPacket({ tenantId: TENANT });
    const packet = res.body as { scorecards: ScorecardReport };
    expect(packet.scorecards.overall.actions.approved).toBe(1);
    expect(packet.scorecards.segments.length).toBeGreaterThanOrEqual(1);
  });
});
