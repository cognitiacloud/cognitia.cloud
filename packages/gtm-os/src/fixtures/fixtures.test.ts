import { describe, expect, it } from 'vitest';
import { assertLeadPiiSafe, scanForRawPii } from '../pii/piiSafety.js';
import { TENANT_IDS } from '../tenants/registry.js';
import { FIXTURE_LEADS, leadsForTenant } from './leads.js';

describe('fixtures are PII-safe', () => {
  it('every fixture lead passes the PII gate', () => {
    for (const lead of FIXTURE_LEADS) {
      expect(() => assertLeadPiiSafe(lead)).not.toThrow();
    }
  });

  it('the whole fixture set contains no raw PII', () => {
    expect(scanForRawPii(FIXTURE_LEADS)).toEqual([]);
  });

  it('every tenant has at least one fixture lead', () => {
    for (const tenantId of TENANT_IDS) {
      expect(leadsForTenant(tenantId).length).toBeGreaterThan(0);
    }
  });
});
