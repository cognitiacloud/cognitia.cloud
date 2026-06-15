import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { InMemoryRepository, type EventRow, type AgentActionRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import {
  buildOpsOverview,
  DEFAULT_HEARTBEAT_STALE_MINUTES,
  type OpsOverview,
} from './opsOverview.js';

/**
 * OBS-1 — operations overview + worker heartbeat. Failure events, sync_run
 * health, action status mix, and worker liveness (staleness fails closed: no
 * heartbeat ⇒ stale). The crm-sync job emits a heartbeat even when the sync
 * fails — liveness and sync success are separate signals.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const NOW = '2026-06-13T12:00:00.000Z';
const minutesBefore = (m: number) => new Date(Date.parse(NOW) - m * 60_000).toISOString();

function event(name: string, occurredAt: string, worker?: string): EventRow {
  return {
    id: randomUUID(),
    tenant_id: TENANT,
    event_name: name,
    entity_type: name.startsWith('worker.') ? 'worker' : 'agent_action',
    entity_id: randomUUID(),
    source: 'test',
    occurred_at: occurredAt,
    ingested_at: occurredAt,
    payload: worker ? { worker, job: `crm-sync:${TENANT}` } : {},
    trace_id: 'trace-ops',
    created_at: occurredAt,
  };
}

function action(id: string, executionStatus: string, approvalStatus: string): AgentActionRow {
  return {
    id,
    tenant_id: TENANT,
    agent_run_id: 'run-1',
    action_type: 'crm.task.create',
    risk_level: 'low',
    idempotency_key: `idem-${id}`,
    approval_status: approvalStatus,
    execution_status: executionStatus,
    target_ref: 'contact:ct-1',
    evidence_refs: [],
    payload_ref: null,
    guardrail_results: [],
    result: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

describe('OBS-1 — buildOpsOverview', () => {
  let repo: InMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryRepository();
  });

  it('counts failure events by name and lists recent ones (refs only)', async () => {
    await repo.insertEvent(event('agent.action.failed.v1', minutesBefore(5)));
    await repo.insertEvent(event('agent.action.failed.v1', minutesBefore(4)));
    await repo.insertEvent(event('agent.run.failed.v1', minutesBefore(3)));
    await repo.insertEvent(event('agent.action.execution_denied.v1', minutesBefore(2)));
    await repo.insertEvent(event('agent.action.executed.v1', minutesBefore(1))); // not a failure

    const o = await buildOpsOverview(repo, TENANT, { now: NOW });
    expect(o.failures.total).toBe(4);
    expect(o.failures.by_event).toEqual({
      'agent.action.failed.v1': 2,
      'agent.run.failed.v1': 1,
      'agent.action.execution_denied.v1': 1,
    });
    // Newest first; refs only — no payload field in the projection.
    expect(o.failures.recent[0]!.event_name).toBe('agent.action.execution_denied.v1');
    expect(Object.keys(o.failures.recent[0]!)).not.toContain('payload');
  });

  it('summarizes sync_run health with failure rate and last timestamps', async () => {
    const r1 = await repo.createSyncRun({ tenantId: TENANT, status: 'completed' });
    await repo.updateSyncRun(TENANT, r1.id, { finished_at: minutesBefore(30) });
    const r2 = await repo.createSyncRun({ tenantId: TENANT, status: 'failed' });
    await repo.updateSyncRun(TENANT, r2.id, { finished_at: minutesBefore(10) });
    await repo.createSyncRun({ tenantId: TENANT, status: 'running' });

    const o = await buildOpsOverview(repo, TENANT, { now: NOW });
    expect(o.sync.total_runs).toBe(3);
    expect(o.sync.by_status).toEqual({ completed: 1, failed: 1, running: 1 });
    expect(o.sync.failure_rate).toBeCloseTo(0.5);
    expect(o.sync.last_completed_at).toBe(minutesBefore(30));
    expect(o.sync.last_failed_at).toBe(minutesBefore(10));
  });

  it('reports the action ledger status mix', async () => {
    await repo.createAgentAction(action('a1', 'executed', 'approved'));
    await repo.createAgentAction(action('a2', 'failed', 'approved'));
    await repo.createAgentAction(action('a3', 'pending', 'proposed'));

    const o = await buildOpsOverview(repo, TENANT, { now: NOW });
    expect(o.actions.total).toBe(3);
    expect(o.actions.by_execution_status).toEqual({ executed: 1, failed: 1, pending: 1 });
    expect(o.actions.by_approval_status).toEqual({ approved: 2, proposed: 1 });
  });

  it('worker liveness: fresh heartbeat ⇒ not stale; old or missing ⇒ stale (fails closed)', async () => {
    // No heartbeat at all → stale.
    let o = await buildOpsOverview(repo, TENANT, { now: NOW });
    expect(o.worker.stale).toBe(true);
    expect(o.worker.last_heartbeat_at).toBeNull();
    expect(o.worker.stale_after_minutes).toBe(DEFAULT_HEARTBEAT_STALE_MINUTES);

    // Fresh heartbeat (5 min ago, threshold 15) → alive.
    await repo.insertEvent(
      event('worker.heartbeat.recorded.v1', minutesBefore(5), 'crm-sync-worker'),
    );
    o = await buildOpsOverview(repo, TENANT, { now: NOW });
    expect(o.worker.stale).toBe(false);
    expect(o.worker.worker).toBe('crm-sync-worker');
    expect(o.worker.last_heartbeat_at).toBe(minutesBefore(5));

    // Same heartbeat against a 3-minute threshold → stale again.
    o = await buildOpsOverview(repo, TENANT, { now: NOW, staleAfterMinutes: 3 });
    expect(o.worker.stale).toBe(true);
  });

  it('is tenant-scoped: another tenant sees nothing', async () => {
    await repo.insertEvent(event('agent.action.failed.v1', minutesBefore(5)));
    const o = await buildOpsOverview(repo, '22222222-2222-2222-2222-222222222222', { now: NOW });
    expect(o.failures.total).toBe(0);
    expect(o.worker.stale).toBe(true);
  });
});

describe('OBS-1 — ops overview endpoint', () => {
  const req = (over: Partial<ApiRequest> = {}): ApiRequest => ({
    tenantId: TENANT,
    role: 'viewer',
    ...over,
  });

  it('is viewer-allowed (read-only) and returns the overview', async () => {
    const repo = new InMemoryRepository();
    const handlers = new ApiHandlers(
      repo,
      createGtmServices({ repo, v1Mode: true, hubspotClient: new FakeHubspotClient() }),
    );
    const res = await handlers.opsOverview(req());
    expect(res.status).toBe(200);
    const body = res.body as OpsOverview;
    expect(body.worker.stale).toBe(true); // empty tenant: fails closed
    expect(body.failures.total).toBe(0);
  });
});
