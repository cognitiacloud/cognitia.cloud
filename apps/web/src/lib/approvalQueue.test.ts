import { describe, it, expect } from 'vitest';
import { ApiClient, type AgentActionView, type FetchLike } from './apiClient.js';
import { toApprovalQueueView } from './approvalQueue.js';

function action(over: Partial<AgentActionView> = {}): AgentActionView {
  return {
    id: 'a1',
    action_type: 'email.draft.send',
    risk_level: 'high',
    approval_status: 'proposed',
    execution_status: 'pending',
    target_ref: 'contact:abc',
    evidence_refs: ['e1', 'e2'],
    draft: { subject_line: 'Hi', body: 'Reply STOP to opt out.', evidence_refs: ['e1', 'e2'] },
    ...over,
  };
}

describe('approval queue view-model', () => {
  it('maps actions to rows and sorts by risk (high first)', () => {
    const rows = toApprovalQueueView([
      action({ id: 'low', action_type: 'crm.task.create', risk_level: 'low', draft: null }),
      action({ id: 'high', risk_level: 'high' }),
    ]);
    expect(rows[0]!.id).toBe('high');
    expect(rows[0]!.channel).toBe('Email');
    expect(rows[0]!.evidenceCount).toBe(2);
    expect(rows[1]!.channel).toBe('CRM task');
  });

  it('derives status + approvable flags', () => {
    expect(toApprovalQueueView([action()])[0]!.status).toBe('Awaiting approval');
    expect(toApprovalQueueView([action({ approval_status: 'approved' })])[0]!.approvable).toBe(
      false,
    );
    expect(toApprovalQueueView([action({ execution_status: 'executed' })])[0]!.status).toBe('Sent');
  });
});

describe('ApiClient', () => {
  it('sends tenant header and parses the proposed queue', async () => {
    const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
    const fakeFetch: FetchLike = async (url, init) => {
      calls.push({ url, headers: init?.headers });
      return { status: 200, json: async () => ({ actions: [action()] }) };
    };
    const client = new ApiClient({ baseUrl: 'http://api', tenantId: 'tenant-1', fetch: fakeFetch });
    const res = await client.listProposed();
    expect(res.actions).toHaveLength(1);
    expect(calls[0]!.url).toBe('http://api/agent-actions?status=proposed');
    expect(calls[0]!.headers?.['x-tenant-id']).toBe('tenant-1');
  });

  it('listActions hits the unfiltered queue and omits x-tenant-id when no tenant given', async () => {
    const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
    const fakeFetch: FetchLike = async (url, init) => {
      calls.push({ url, headers: init?.headers });
      return { status: 200, json: async () => ({ actions: [] }) };
    };
    // Session-auth console: tenant comes from the session, not a header.
    const client = new ApiClient({ baseUrl: 'http://api', fetch: fakeFetch });
    await client.listActions();
    await client.listActions('approved');
    expect(calls[0]!.url).toBe('http://api/agent-actions');
    expect(calls[1]!.url).toBe('http://api/agent-actions?status=approved');
    expect(calls[0]!.headers).not.toHaveProperty('x-tenant-id');
  });

  it('throws ApiError on 4xx', async () => {
    const fakeFetch: FetchLike = async () => ({
      status: 409,
      json: async () => ({ error: 'not approved' }),
    });
    const client = new ApiClient({ baseUrl: 'http://api', tenantId: 't', fetch: fakeFetch });
    await expect(client.execute('a1')).rejects.toMatchObject({ status: 409 });
  });

  it('batchApprove posts ids + shared reason and returns per-id results (UX-2)', async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    const fakeFetch: FetchLike = async (url, init) => {
      calls.push({ url, body: init?.body });
      return {
        status: 200,
        json: async () => ({
          kind: 'approve',
          requested: 2,
          succeeded: 2,
          results: [
            { id: 'a1', ok: true, status: 200 },
            { id: 'a2', ok: true, status: 200 },
          ],
        }),
      };
    };
    const client = new ApiClient({ baseUrl: 'http://api', fetch: fakeFetch });
    const res = await client.batchApprove(['a1', 'a2'], { reason_code: 'meets_playbook' });
    expect(calls[0]!.url).toBe('http://api/agent-actions/batch-approve');
    expect(JSON.parse(calls[0]!.body!)).toEqual({
      ids: ['a1', 'a2'],
      reason: { reason_code: 'meets_playbook' },
    });
    expect(res.succeeded).toBe(2);
  });

  it('batchReject does not throw on 207 (partial failure surfaced in body)', async () => {
    const fakeFetch: FetchLike = async () => ({
      status: 207,
      json: async () => ({
        kind: 'reject',
        requested: 2,
        succeeded: 1,
        results: [
          { id: 'a1', ok: true, status: 200 },
          { id: 'bad', ok: false, status: 404, error: 'not found' },
        ],
      }),
    });
    const client = new ApiClient({ baseUrl: 'http://api', fetch: fakeFetch });
    const res = await client.batchReject(['a1', 'bad'], { reason_code: 'wrong_target' });
    expect(res.requested - res.succeeded).toBe(1);
    expect(res.results.find((r) => !r.ok)?.status).toBe(404);
  });

  it('listAllDecisions hits the tenant-wide decisions endpoint', async () => {
    const calls: string[] = [];
    const fakeFetch: FetchLike = async (url) => {
      calls.push(url);
      return { status: 200, json: async () => ({ decisions: [] }) };
    };
    const client = new ApiClient({ baseUrl: 'http://api', fetch: fakeFetch });
    await client.listAllDecisions();
    expect(calls[0]).toBe('http://api/decisions');
  });

  it('actionRationale hits the WHY-1 endpoint and parses the rationale', async () => {
    const calls: string[] = [];
    const fakeFetch: FetchLike = async (url) => {
      calls.push(url);
      return {
        status: 200,
        json: async () => ({
          action_id: 'a1',
          target_ref: 'account:acc-1',
          account: {
            id: 'acc-1',
            name: 'Acme',
            industry: 'SaaS',
            employee_count: 200,
            region: 'NA',
          },
          score: { fit: 0.9, timing: 0.8, combined: 0.86 },
          evidence: [
            { claim: 'Acme operates in SaaS', source_ref: 'account:acc-1#industry', score: 0.9 },
          ],
          evidence_refs_on_action: 2,
          freshness: {
            data_updated_at: '2026-06-01T00:00:00.000Z',
            age_days: 9,
            proposed_at: '2026-06-05T00:00:00.000Z',
            stale_since_proposal: false,
          },
        }),
      };
    };
    const client = new ApiClient({ baseUrl: 'http://api', fetch: fakeFetch });
    const r = await client.actionRationale('a1');
    expect(calls[0]).toBe('http://api/agent-actions/a1/rationale');
    expect(r.score?.combined).toBe(0.86);
    expect(r.evidence[0]!.claim).toContain('SaaS');
    expect(r.freshness?.stale_since_proposal).toBe(false);
  });

  it('previewAction hits the GOV-1 preview endpoint', async () => {
    const calls: string[] = [];
    const fakeFetch: FetchLike = async (url) => {
      calls.push(url);
      return {
        status: 200,
        json: async () => ({
          action_id: 'a1',
          would_execute: false,
          denial_reason: 'not_approved',
          idempotent_replay_expected: false,
          plan: { object: 'tasks', properties: { hs_task_subject: 'x' }, idempotency_key: 'k' },
        }),
      };
    };
    const client = new ApiClient({ baseUrl: 'http://api', fetch: fakeFetch });
    const p = await client.previewAction('a1');
    expect(calls[0]).toBe('http://api/agent-actions/a1/preview');
    expect(p.plan.object).toBe('tasks');
    expect(p.would_execute).toBe(false);
  });

  it('ENF-1 endpoints: status/pause/resume/governance/audit hit the right routes', async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    const fakeFetch: FetchLike = async (url, init) => {
      calls.push({ url, method: init?.method });
      return { status: 200, json: async () => ({ events: [], total: 0 }) };
    };
    const client = new ApiClient({ baseUrl: 'http://api', fetch: fakeFetch });
    await client.integrationStatus();
    await client.pauseIntegration();
    await client.resumeIntegration();
    await client.governance();
    await client.auditTrail(50);
    expect(calls.map((c) => `${c.method ?? 'GET'} ${c.url}`)).toEqual([
      'GET http://api/integrations/status',
      'POST http://api/integrations/hubspot/pause',
      'POST http://api/integrations/hubspot/resume',
      'GET http://api/governance',
      'GET http://api/audit?limit=50',
    ]);
  });

  it('RDY-1: integrationReadiness GETs /integrations/readiness', async () => {
    const calls: string[] = [];
    const fakeFetch: FetchLike = async (url) => {
      calls.push(url);
      return { status: 200, json: async () => ({ ready: true, checks: [] }) };
    };
    const client = new ApiClient({ baseUrl: 'http://api', fetch: fakeFetch });
    const r = await client.integrationReadiness();
    expect(calls[0]).toBe('http://api/integrations/readiness');
    expect(r.ready).toBe(true);
  });

  it('rollback POSTs the structured reason to the UNDO-1 endpoint', async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    const fakeFetch: FetchLike = async (url, init) => {
      calls.push({ url, body: init?.body });
      return { status: 200, json: async () => ({ id: 'a1', execution_status: 'rolled_back' }) };
    };
    const client = new ApiClient({ baseUrl: 'http://api', fetch: fakeFetch });
    await client.rollback('a1', { reason_code: 'wrong_target' });
    expect(calls[0]!.url).toBe('http://api/agent-actions/a1/rollback');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ reason: { reason_code: 'wrong_target' } });
  });

  it('preflight POSTs to the SIM-1 endpoint and parses the report', async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    const fakeFetch: FetchLike = async (url, init) => {
      calls.push({ url, method: init?.method });
      return {
        status: 200,
        json: async () => ({
          simulated: true,
          writes_performed: 0,
          objective: 'x',
          accounts_considered: 2,
          ranked_accounts: [],
          proposals: [],
          excluded_suppressed: [],
        }),
      };
    };
    const client = new ApiClient({ baseUrl: 'http://api', fetch: fakeFetch });
    const r = await client.preflight();
    expect(calls[0]).toEqual({ url: 'http://api/agent-runs/mira/preflight', method: 'POST' });
    expect(r.simulated).toBe(true);
    expect(r.writes_performed).toBe(0);
  });

  it('trustMetrics hits the MET-1 endpoint and parses the strip payload', async () => {
    const calls: string[] = [];
    const fakeFetch: FetchLike = async (url) => {
      calls.push(url);
      return {
        status: 200,
        json: async () => ({
          actions: {
            proposed: 1,
            approved: 3,
            rejected: 1,
            executed: 2,
            failed: 0,
            rolled_back: 0,
          },
          approval_rate: 0.75,
          approve_reasons: { meets_playbook: 3 },
          reject_reasons: { wrong_target: 1 },
          median_decision_seconds: 42,
          duplicate_writes_prevented: 1,
        }),
      };
    };
    const client = new ApiClient({ baseUrl: 'http://api', fetch: fakeFetch });
    const m = await client.trustMetrics();
    expect(calls[0]).toBe('http://api/metrics/trust');
    expect(m.approval_rate).toBe(0.75);
    expect(m.duplicate_writes_prevented).toBe(1);
  });
});
