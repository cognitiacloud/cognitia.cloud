import { describe, expect, it } from 'vitest';
import { checkConsent, checkSourceRights, evaluateConsentGate } from './consentGate.js';
import { parsedFixtureLead } from './testSupport.test.js';
import type { DemandaraLead } from './types.js';

const baseLead = (): DemandaraLead => parsedFixtureLead('bw_happy_path_mock_only');

describe('consent/source-rights gate (deny by default)', () => {
  it('allows verified fixture source rights with granted consent', () => {
    const gate = evaluateConsentGate(baseLead());
    expect(gate.allowed).toBe(true);
    expect(gate.blocked).toBeNull();
  });

  it('blocks unknown source rights', () => {
    const lead = { ...baseLead(), sourceRightsStatus: 'unknown' as const };
    const result = checkSourceRights(lead);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason.code).toBe('SOURCE_RIGHTS_UNKNOWN');
  });

  it('blocks denied source rights', () => {
    const lead = { ...baseLead(), sourceRightsStatus: 'denied' as const };
    const result = checkSourceRights(lead);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason.code).toBe('SOURCE_RIGHTS_DENIED');
  });

  it('blocks missing consent with a clear reason', () => {
    const lead = { ...baseLead(), consentStatus: 'not_established' as const };
    const result = checkConsent(lead);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason.code).toBe('CONSENT_MISSING');
      expect(result.reason.detail).toContain('Consent is not established');
    }
  });

  it('blocks revoked and do_not_contact consent', () => {
    for (const consentStatus of ['revoked', 'do_not_contact'] as const) {
      const result = checkConsent({ ...baseLead(), consentStatus });
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.reason.code).toBe('CONSENT_REVOKED');
    }
  });

  it('blocks when contact is not allowed even if consent is granted', () => {
    const result = checkConsent({ ...baseLead(), contactAllowed: false });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason.code).toBe('CONTACT_NOT_ALLOWED');
  });

  it('reports the source-rights failure first when both checks fail', () => {
    const gate = evaluateConsentGate({
      ...baseLead(),
      sourceRightsStatus: 'unknown',
      consentStatus: 'not_established',
    });
    expect(gate.allowed).toBe(false);
    expect(gate.blocked?.code).toBe('SOURCE_RIGHTS_UNKNOWN');
    expect(gate.consent.allowed).toBe(false);
  });
});
