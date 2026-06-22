import { describe, expect, it } from 'vitest';
import { leadById } from '../fixtures/leads.js';
import { getTenant } from '../tenants/registry.js';
import type { FixtureLead } from '../types.js';
import { evaluateCompliance } from './complianceGate.js';

function lead(id: string): FixtureLead {
  const found = leadById(id);
  if (!found) throw new Error(`missing fixture: ${id}`);
  return found;
}

const bwTenant = getTenant('budget_wheels_demo');

describe('compliance gate', () => {
  it('allows a consented, non-suppressed, PII-safe lead', () => {
    const decision = evaluateCompliance(lead('lead_bw_001'), bwTenant);
    expect(decision.allowed).toBe(true);
    expect(decision.reasons).toEqual([]);
  });

  it('blocks when consent is missing', () => {
    const decision = evaluateCompliance(lead('lead_bw_002'), bwTenant);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('consent_missing');
  });

  it('blocks when the lead is suppressed', () => {
    expect(evaluateCompliance(lead('lead_bw_003'), bwTenant).reasons).toContain(
      'on_suppression_list',
    );
  });

  it('blocks when consent was revoked', () => {
    const decision = evaluateCompliance(lead('lead_dm_002'), getTenant('demandara_internal'));
    expect(decision.reasons).toContain('consent_revoked');
  });

  it('blocks a PII-unsafe lead with reason pii_unsafe', () => {
    const unsafe: FixtureLead = { ...lead('lead_bw_001'), email: 'leak@real-corp.test' };
    const decision = evaluateCompliance(unsafe, bwTenant);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('pii_unsafe');
  });

  it('blocks when the tenant is inactive', () => {
    const decision = evaluateCompliance(lead('lead_bw_001'), { ...bwTenant, active: false });
    expect(decision.reasons).toContain('tenant_inactive');
  });
});
