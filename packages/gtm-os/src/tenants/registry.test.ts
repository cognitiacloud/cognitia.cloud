import { describe, expect, it } from 'vitest';
import { getTenant, TENANT_IDS, TENANTS } from './registry.js';

describe('tenant registry', () => {
  it('holds exactly the three internal/demo tenants', () => {
    expect([...TENANT_IDS].sort()).toEqual([
      'budget_wheels_demo',
      'cognitia_internal',
      'demandara_internal',
    ]);
  });

  it('every tenant is internal, mock-mode, active, and mock-channel only', () => {
    for (const id of TENANT_IDS) {
      const tenant = getTenant(id);
      expect(tenant.internal).toBe(true);
      expect(tenant.mode).toBe('mock');
      expect(tenant.active).toBe(true);
      expect(tenant.permittedChannels).toContain('mock_appointment');
      expect(tenant.permittedChannels).toContain('mock_crm');
    }
  });

  it('exposes no non-mock channel', () => {
    const channels = new Set(Object.values(TENANTS).flatMap((t) => t.permittedChannels));
    expect([...channels].sort()).toEqual(['mock_appointment', 'mock_crm']);
  });
});
