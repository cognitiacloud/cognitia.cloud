import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ActionProvenance, ApprovedAgentAction } from '@cognitia/core';
import {
  buildHubspotWritePlan,
  engagementContent,
  DEFAULT_IDEMPOTENCY_PROPERTY,
  PROVENANCE_PROPERTIES,
  type PlannableAction,
} from '../index.js';
import { StubHubspotAdapter } from './adapter.js';
import { HttpHubspotClient, type HttpFetch, type HttpResponse } from './httpClient.js';

/**
 * GOV-1 — typed write plans. The load-bearing test here is the
 * preview-equals-write invariant: the plan returned to the operator must be
 * byte-identical to the property map the real HTTP client sends.
 */

const action: PlannableAction = {
  action_type: 'crm.task.create',
  target_ref: 'account:acc-1',
  idempotency_key: 'idem-123',
  agent_run_id: 'run-1',
  evidence_refs: ['account:acc-1:industry', 'account:acc-1:fit'],
  created_at: '2026-06-10T00:00:00.000Z',
};

const provenance: ActionProvenance = {
  agent: 'mira',
  agent_run_id: 'run-1',
  agent_action_id: 'act-1',
  evidence_count: 2,
  risk_level: 'low',
  approved_by: 'user:operator',
};

describe('engagementContent', () => {
  it('is deterministic and pins hs_timestamp to proposal time', () => {
    const a = engagementContent(action);
    const b = engagementContent(action);
    expect(a).toEqual(b);
    expect(a['hs_timestamp']).toBe(Date.parse(action.created_at));
    expect(a['hs_task_subject']).toContain('account:acc-1');
    expect(String(a['hs_task_body'])).toContain('2 CRM fact'); // grounded in 2 facts
  });

  it('produces note content for crm.note.create', () => {
    const c = engagementContent({ ...action, action_type: 'crm.note.create' });
    expect(c).toHaveProperty('hs_note_body');
    expect(c).not.toHaveProperty('hs_task_subject');
  });

  it('never contains raw PII (no @ anywhere)', () => {
    const c = engagementContent(action);
    expect(JSON.stringify(c)).not.toContain('@');
  });
});

describe('buildHubspotWritePlan', () => {
  it('assembles content + idempotency property + provenance', () => {
    const plan = buildHubspotWritePlan(action, provenance);
    expect(plan.object).toBe('tasks');
    expect(plan.properties[DEFAULT_IDEMPOTENCY_PROPERTY]).toBe('idem-123');
    expect(plan.properties[PROVENANCE_PROPERTIES.approvedBy]).toBe('user:operator');
    expect(plan.properties[PROVENANCE_PROPERTIES.agentActionId]).toBe('act-1');
    expect(plan.properties['hs_task_subject']).toBeDefined();
  });

  it('omits the approver property before approval resolves', () => {
    const { approved_by: _drop, ...unapproved } = provenance;
    const plan = buildHubspotWritePlan(action, unapproved);
    expect(plan.properties).not.toHaveProperty(PROVENANCE_PROPERTIES.approvedBy);
  });

  it('routes notes to the notes object', () => {
    const plan = buildHubspotWritePlan({ ...action, action_type: 'crm.note.create' });
    expect(plan.object).toBe('notes');
    expect(plan.properties).toHaveProperty('hs_note_body');
  });
});

describe('preview-equals-write invariant (GOV-1)', () => {
  beforeEach(() => {
    vi.stubEnv('LIVE_OUTBOUND_EXPLICITLY_ALLOWED', 'true');
    vi.stubEnv('LIVE_OUTBOUND_HUBSPOT', 'true');
    vi.stubEnv('LIVE_OUTBOUND_MIRA_WRITE', 'true');
  });
  afterEach(() => vi.unstubAllEnvs());
  it('the executed request body properties are byte-identical to the plan', async () => {
    // Capture what the real HTTP client actually sends.
    const captured: Array<{ url: string; body?: string }> = [];
    const fakeFetch: HttpFetch = async (url, init): Promise<HttpResponse> => {
      captured.push({ url, body: init?.body });
      const isSearch = url.includes('/search');
      return {
        status: 200,
        headers: { get: () => null },
        json: async () => (isSearch ? { results: [] } : { id: 'hs-1' }),
        text: async () => '',
      };
    };
    const client = new HttpHubspotClient({
      token: { getAccessToken: async () => 'tok' },
      fetch: fakeFetch,
    });
    const adapter = new StubHubspotAdapter(client);

    const approved = {
      ...action,
      id: 'act-1',
      tenant_id: 't-1',
      risk_level: 'low',
      approval_status: 'approved',
      execution_status: 'pending',
      payload_ref: null,
      guardrail_results: [],
      updated_at: action.created_at,
    } as unknown as ApprovedAgentAction;

    const result = await adapter.execute(approved, provenance);
    expect(result.ok).toBe(true);

    const create = captured.find((c) => !c.url.includes('/search'));
    const sent = JSON.parse(create!.body!) as { properties: Record<string, unknown> };
    const plan = buildHubspotWritePlan(action, provenance);
    // The invariant: what the operator previewed IS what was sent.
    expect(sent.properties).toEqual(plan.properties);
  });
});
