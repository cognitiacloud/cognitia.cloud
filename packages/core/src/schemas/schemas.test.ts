import { describe, it, expect } from 'vitest';
import { agentAction, agentRun, contextPack, tenantScoped } from './index.js';

const UUID = '33333333-3333-3333-3333-333333333333';
const now = new Date().toISOString();

describe('tenant_id is required in core schemas', () => {
  it('tenantScoped rejects missing tenant_id', () => {
    expect(tenantScoped.safeParse({}).success).toBe(false);
    expect(tenantScoped.safeParse({ tenant_id: UUID }).success).toBe(true);
  });

  it('tenantScoped rejects a non-uuid tenant_id', () => {
    expect(tenantScoped.safeParse({ tenant_id: 'not-a-uuid' }).success).toBe(false);
  });

  it('agentRun requires tenant_id', () => {
    const ok = agentRun.safeParse({
      id: UUID,
      tenant_id: UUID,
      agent: 'mira',
      objective: 'find accounts',
      input_refs: [],
      status: 'pending',
      trace_id: 't',
      created_at: now,
      updated_at: now,
    });
    expect(ok.success).toBe(true);

    const missing = agentRun.safeParse({
      id: UUID,
      agent: 'mira',
      objective: 'find accounts',
      status: 'pending',
      trace_id: 't',
      created_at: now,
      updated_at: now,
    });
    expect(missing.success).toBe(false);
  });

  it('agentAction requires tenant_id and the four external-mutation fields', () => {
    const valid = {
      id: UUID,
      tenant_id: UUID,
      agent_run_id: UUID,
      action_type: 'email.draft.send',
      risk_level: 'high',
      idempotency_key: 'k',
      approval_status: 'proposed',
      execution_status: 'pending',
      target_ref: `contact:${UUID}`,
      evidence_refs: ['e1'],
      created_at: now,
      updated_at: now,
    };
    expect(agentAction.safeParse(valid).success).toBe(true);

    const { tenant_id: _omit, ...withoutTenant } = valid;
    expect(agentAction.safeParse(withoutTenant).success).toBe(false);

    const { idempotency_key: _k, ...withoutKey } = valid;
    expect(agentAction.safeParse(withoutKey).success).toBe(false);
  });

  it('contextPack requires tenant_id', () => {
    const missing = contextPack.safeParse({
      trace_id: 't',
      account: { ref: `account:${UUID}`, facts: [] },
    });
    expect(missing.success).toBe(false);
  });
});
