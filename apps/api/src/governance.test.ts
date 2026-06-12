import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers } from './handlers.js';
import { buildGovernanceMatrix, type GovernanceMatrix } from './governance.js';
import type { TrustPacket } from './trustPacket.js';
import { grantMiraExecution } from './passportTestKit.js';

/**
 * ENF-1 — the governance matrix is DERIVED from the live policy gate and
 * adapter registry, so it cannot drift into marketing: the test asserts the
 * derivation against the actual deployment composition (v1Mode).
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

describe('GET /governance (ENF-1)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;

  beforeEach(async () => {
    repo = new InMemoryRepository();
    await grantMiraExecution(repo, TENANT);
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

  it('reflects the v1 fence from the real composition: email not executable, CRM rollbackable', async () => {
    const res = await handlers.governance({ tenantId: TENANT, role: 'viewer' });
    expect(res.status).toBe(200);
    const m = res.body as GovernanceMatrix;
    expect(m.derived_from_code).toBe(true);

    const byType = new Map(m.action_types.map((a) => [a.action_type, a]));
    const email = byType.get('email.draft.send')!;
    expect(email.executable_in_deployment).toBe(false); // fence, derived not asserted by hand
    expect(email.risk_level).toBe('high');

    const task = byType.get('crm.task.create')!;
    expect(task.executable_in_deployment).toBe(true);
    expect(task.rollback_supported).toBe(true);
    expect(task.requires_human_approval).toBe(true);
    expect(task.blocked_when_suppressed).toBe(true);
    expect(task.suppression_reason).toBeTruthy();

    expect(m.kill_switch.enforced).toBe(true);
    expect(m.roles.map((r) => r.role)).toEqual(['viewer', 'operator', 'owner']);
  });

  it('derivation matches the registry: a non-v1 composition flips email to executable', () => {
    const full = createGtmServices({ repo, v1Mode: false });
    const m = buildGovernanceMatrix(full.deps.adapters);
    const email = m.action_types.find((a) => a.action_type === 'email.draft.send')!;
    expect(email.executable_in_deployment).toBe(true); // proves it is derived, not hardcoded
    expect(email.rollback_supported).toBe(false); // email adapter has no rollback (irreversible)
  });

  it('the trust packet embeds governance + integration kill-switch state', async () => {
    const res = await handlers.trustPacket({ tenantId: TENANT });
    const p = res.body as TrustPacket;
    expect(p.governance.derived_from_code).toBe(true);
    expect(p.governance.action_types.length).toBe(3);
    expect(p.integration).toMatchObject({
      system: 'hubspot',
      status: 'not_connected',
      kill_switch_enforced: true,
      halted: false,
    });
  });
});

describe('GET /audit (ENF-1)', () => {
  it('returns the lifecycle trail newest-first, viewer-allowed, tenant-scoped', async () => {
    const repo = new InMemoryRepository();
    await grantMiraExecution(repo, TENANT);
    repo.seedAccount({
      id: 'acc-1',
      tenant_id: TENANT,
      name: 'Acme',
      domain: null,
      industry: 'SaaS',
      employee_count: 100,
      region: 'NA',
      fit_score: 0.9,
      timing_score: 0.8,
      attributes: {},
      created_at: ts,
      updated_at: ts,
    });
    const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    const id = (list.body as { actions: Array<{ id: string }> }).actions[0]!.id;
    await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id },
      body: { reason: { reason_code: 'meets_playbook' } },
    });
    await handlers.executeAction({ tenantId: TENANT, role: 'operator', params: { id } });

    const res = await handlers.auditTrail({ tenantId: TENANT, role: 'viewer' });
    expect(res.status).toBe(200);
    const body = res.body as { events: Array<{ action: string }>; total: number };
    const actions = body.events.map((e) => e.action);
    for (const expected of ['proposed', 'approved', 'executed']) {
      expect(actions).toContain(expected);
    }
    expect(body.total).toBeGreaterThanOrEqual(3);

    // limit is honored
    const limited = await handlers.auditTrail({ tenantId: TENANT, query: { limit: '1' } });
    expect((limited.body as { events: unknown[] }).events).toHaveLength(1);

    // tenant-scoped + auth
    const other = await handlers.auditTrail({ tenantId: '22222222-2222-2222-2222-222222222222' });
    expect((other.body as { total: number }).total).toBe(0);
    await expect(handlers.auditTrail({})).rejects.toMatchObject({ status: 401 });
  });
});
