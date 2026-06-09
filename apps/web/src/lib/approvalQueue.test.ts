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
});
