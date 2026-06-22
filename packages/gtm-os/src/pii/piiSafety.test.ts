import { describe, expect, it } from 'vitest';
import type { FixtureLead } from '../types.js';
import {
  assertLeadPiiSafe,
  isSafeEmail,
  isSafePhone,
  PiiViolationError,
  scanForRawPii,
} from './piiSafety.js';

describe('pii safety', () => {
  it('accepts reserved .example emails and 555-01xx phones', () => {
    expect(isSafeEmail('avery@budget-wheels.example')).toBe(true);
    expect(isSafePhone('+1-202-555-0142')).toBe(true);
    expect(isSafePhone('202-555-0173')).toBe(true);
  });

  it('rejects real-looking emails and non-555-01xx phones', () => {
    expect(isSafeEmail('avery@budget-wheels.test')).toBe(false);
    expect(isSafePhone('415-555-1234')).toBe(false);
  });

  it('flags raw-PII-looking values in arbitrary payloads, with redacted samples', () => {
    const violations = scanForRawPii({ note: 'reach me at jordan@acme-corp.test or 415-555-1234' });
    const kinds = violations.map((v) => v.kind);
    expect(kinds).toContain('email');
    expect(kinds).toContain('phone');
    for (const v of violations) expect(v.sample.endsWith('***')).toBe(true);
  });

  it('does not flag hashes, ids, dates, or safe contact forms', () => {
    const safe = {
      hash: 'a'.repeat(64),
      id: 'lead_bw_001',
      when: '2026-01-02T09:00:00.000Z',
      email: 'x@y.example',
      phone: '+1-202-555-0142',
    };
    expect(scanForRawPii(safe)).toEqual([]);
  });

  it('assertLeadPiiSafe throws on unsafe contact fields', () => {
    const lead: FixtureLead = {
      id: 'x',
      tenantId: 'budget_wheels_demo',
      displayName: 'X',
      email: 'x@real-corp.test',
      phone: '+1-202-555-0142',
      consent: {
        contact: true,
        grantedAt: '2026-01-01T00:00:00.000Z',
        basis: 'explicit_optin',
        revoked: false,
      },
      suppressed: false,
      source: 'fixture:webform',
    };
    expect(() => assertLeadPiiSafe(lead)).toThrow(PiiViolationError);
  });
});
