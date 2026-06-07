import { describe, it, expect } from 'vitest';
import { tenantContextPlan, TENANT_GUC, BYPASS_GUC } from './client.js';
import { InMemoryRepository, type AccountRow } from './index.js';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

/**
 * Proves the architectural guarantee: tenant context is transaction-scoped and
 * cannot leak across pooled requests/connections.
 */
describe('no tenant-context leakage across pooled requests', () => {
  it('every context statement is SET LOCAL (transaction-scoped)', () => {
    const plan = tenantContextPlan(TENANT_A);
    // The whole point: nothing is session-level, so it resets at COMMIT/ROLLBACK
    // before the connection is returned to the pool.
    expect(plan.every((s) => s.local === true)).toBe(true);
    expect(plan[0]).toEqual({ key: TENANT_GUC, value: TENANT_A, local: true });
  });

  it('bypass is also transaction-local and opt-in only', () => {
    expect(tenantContextPlan(TENANT_A).some((s) => s.key === BYPASS_GUC)).toBe(false);
    const withBypass = tenantContextPlan(TENANT_A, { bypassRls: true });
    const bypass = withBypass.find((s) => s.key === BYPASS_GUC);
    expect(bypass).toEqual({ key: BYPASS_GUC, value: 'on', local: true });
    expect(withBypass.every((s) => s.local === true)).toBe(true);
  });

  it('interleaved tenant operations never observe each other (no shared mutable context)', async () => {
    // Tenant is threaded per call — there is no shared/session tenant field to
    // leak. Simulate two concurrent requests interleaving against the same repo.
    const repo = new InMemoryRepository();
    const mk = (id: string, tenant: string): AccountRow => ({
      id,
      tenant_id: tenant,
      name: id,
      domain: null,
      industry: null,
      employee_count: null,
      region: null,
      fit_score: null,
      timing_score: null,
      attributes: {},
      created_at: '2026-06-06T00:00:00.000Z',
      updated_at: '2026-06-06T00:00:00.000Z',
    });
    repo.seedAccount(mk('a', TENANT_A));
    repo.seedAccount(mk('b', TENANT_B));

    const requestA = (async () => {
      const r1 = await repo.listAccounts(TENANT_A);
      await Promise.resolve(); // yield, let B interleave
      const r2 = await repo.listAccounts(TENANT_A);
      return [...r1, ...r2];
    })();
    const requestB = (async () => {
      const r1 = await repo.listAccounts(TENANT_B);
      await Promise.resolve();
      const r2 = await repo.listAccounts(TENANT_B);
      return [...r1, ...r2];
    })();

    const [aRows, bRows] = await Promise.all([requestA, requestB]);
    expect(aRows.every((r) => r.tenant_id === TENANT_A)).toBe(true);
    expect(bRows.every((r) => r.tenant_id === TENANT_B)).toBe(true);
  });
});
