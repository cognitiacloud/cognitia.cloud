import { describe, it, expect } from 'vitest';
import { StubEmailAdapter } from './adapter.js';
import { UnapprovedActionError } from '../types.js';
import type { ApprovedAgentAction } from '@cognitia/core';

const now = new Date().toISOString();

function action(overrides: Partial<ApprovedAgentAction> = {}): ApprovedAgentAction {
  return {
    id: 'act-1',
    tenant_id: '11111111-1111-1111-1111-111111111111',
    agent_run_id: 'run-1',
    action_type: 'email.draft.send',
    risk_level: 'high',
    idempotency_key: 'key-1',
    approval_status: 'approved',
    execution_status: 'pending',
    target_ref: 'contact:33333333-3333-3333-3333-333333333333',
    evidence_refs: ['e1'],
    payload_ref: 'draft:1',
    guardrail_results: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  } as ApprovedAgentAction;
}

describe('StubEmailAdapter', () => {
  it('refuses to send an unapproved action', async () => {
    const adapter = new StubEmailAdapter();
    const unapproved = action({ approval_status: 'proposed' as never });
    await expect(adapter.execute(unapproved)).rejects.toBeInstanceOf(UnapprovedActionError);
    expect(adapter.sentCount()).toBe(0);
  });

  it('sends an approved action once', async () => {
    const adapter = new StubEmailAdapter();
    const result = await adapter.execute(action());
    expect(result.ok).toBe(true);
    expect(result.idempotent_replay).toBe(false);
    expect(adapter.sentCount()).toBe(1);
  });

  it('is idempotent: same idempotency_key does not send twice', async () => {
    const adapter = new StubEmailAdapter();
    const first = await adapter.execute(action({ idempotency_key: 'dup' }));
    const second = await adapter.execute(action({ id: 'act-2', idempotency_key: 'dup' }));
    expect(first.idempotent_replay).toBe(false);
    expect(second.idempotent_replay).toBe(true);
    expect(second.external_ref).toBe(first.external_ref);
    expect(adapter.sentCount()).toBe(1);
  });
});
