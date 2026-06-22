import { describe, expect, it } from 'vitest';
import {
  CONSENT_STATUSES,
  evaluateAutomationConsent,
  isAutomationConsentCleared,
  type AutomationConsentInput,
} from './automationConsent.js';

// A fully cleared baseline: explicit, current consent in a sandbox workspace.
const baseCleared: AutomationConsentInput = {
  channel: 'email',
  consentStatus: 'explicit',
  workspaceId: 'ws_budget_wheels_demo',
  evaluatedAt: '2026-06-22T00:00:00.000Z',
};

describe('evaluateAutomationConsent — clearing', () => {
  it('clears explicit, current consent with no blocking signals', () => {
    const result = evaluateAutomationConsent(baseCleared);
    expect(result.outcome).toBe('cleared');
    expect(result.cleared).toBe(true);
    expect(result.blockingCodes).toEqual([]);
    expect(result.reviewCodes).toEqual([]);
  });

  it('clears explicit consent whose expiry is still in the future', () => {
    const result = evaluateAutomationConsent({
      ...baseCleared,
      consentExpiresAt: '2027-01-01T00:00:00.000Z',
    });
    expect(result.outcome).toBe('cleared');
  });

  it('isAutomationConsentCleared mirrors a cleared outcome', () => {
    expect(isAutomationConsentCleared(baseCleared)).toBe(true);
  });
});

describe('evaluateAutomationConsent — no consent blocks', () => {
  it('blocks when no consent is on record', () => {
    const result = evaluateAutomationConsent({ ...baseCleared, consentStatus: 'none' });
    expect(result.outcome).toBe('blocked');
    expect(result.blockingCodes).toContain('no_consent');
    expect(isAutomationConsentCleared({ ...baseCleared, consentStatus: 'none' })).toBe(false);
  });

  it('blocks an unknown/garbled consent status (fail closed as ambiguous)', () => {
    const result = evaluateAutomationConsent({
      ...baseCleared,
      // @ts-expect-error — exercising the fail-closed path for invalid input.
      consentStatus: 'sorta-maybe',
    });
    expect(result.outcome).toBe('blocked');
    expect(result.blockingCodes).toContain('ambiguous_consent');
  });

  it('blocks the empty/default input (fail closed)', () => {
    const result = evaluateAutomationConsent({
      channel: 'email',
      // @ts-expect-error — deliberately omitting required fields.
      consentStatus: undefined,
      workspaceId: '',
    });
    expect(result.outcome).toBe('blocked');
    expect(result.blockingCodes).toContain('workspace_required');
    expect(result.blockingCodes).toContain('ambiguous_consent');
  });
});

describe('evaluateAutomationConsent — ambiguous consent blocks', () => {
  it('blocks when consent state is ambiguous', () => {
    const result = evaluateAutomationConsent({ ...baseCleared, consentStatus: 'ambiguous' });
    expect(result.outcome).toBe('blocked');
    expect(result.blockingCodes).toContain('ambiguous_consent');
  });
});

describe('evaluateAutomationConsent — do-not-contact blocks', () => {
  it('blocks when the contact is on a do-not-contact list, even with explicit consent', () => {
    const result = evaluateAutomationConsent({ ...baseCleared, doNotContact: true });
    expect(result.outcome).toBe('blocked');
    expect(result.blockingCodes).toContain('do_not_contact');
  });
});

describe('evaluateAutomationConsent — expired consent blocks', () => {
  it('blocks when consent status is marked expired', () => {
    const result = evaluateAutomationConsent({ ...baseCleared, consentStatus: 'expired' });
    expect(result.outcome).toBe('blocked');
    expect(result.blockingCodes).toContain('expired_consent');
  });

  it('blocks when the recorded expiry is at/before evaluation time', () => {
    const result = evaluateAutomationConsent({
      ...baseCleared,
      consentExpiresAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.outcome).toBe('blocked');
    expect(result.blockingCodes).toContain('expired_consent');
  });

  it('blocks when the recorded expiry is unparseable (fail closed)', () => {
    const result = evaluateAutomationConsent({
      ...baseCleared,
      consentExpiresAt: 'not-a-date',
    });
    expect(result.outcome).toBe('blocked');
    expect(result.blockingCodes).toContain('expired_consent');
  });
});

describe('evaluateAutomationConsent — revoked consent blocks', () => {
  it('blocks when consent has been revoked', () => {
    const result = evaluateAutomationConsent({ ...baseCleared, consentStatus: 'revoked' });
    expect(result.outcome).toBe('blocked');
    expect(result.blockingCodes).toContain('revoked_consent');
  });
});

describe('evaluateAutomationConsent — Quebec / Law 25 requires extra review', () => {
  it('escalates an otherwise-cleared action to requires_review', () => {
    const result = evaluateAutomationConsent({ ...baseCleared, law25Flag: true });
    expect(result.outcome).toBe('requires_review');
    expect(result.reviewCodes).toContain('law25_extra_review_required');
    // requires_review is NOT cleared — it must not proceed without review.
    expect(result.cleared).toBe(false);
    expect(isAutomationConsentCleared({ ...baseCleared, law25Flag: true })).toBe(false);
  });

  it('a Law 25 flag never overrides a hard block — blocking wins', () => {
    const result = evaluateAutomationConsent({
      ...baseCleared,
      consentStatus: 'none',
      law25Flag: true,
    });
    expect(result.outcome).toBe('blocked');
    expect(result.blockingCodes).toContain('no_consent');
  });
});

describe('evaluateAutomationConsent — CASL-sensitive requires explicit consent', () => {
  it('clears a CASL-sensitive action when consent is explicit', () => {
    const result = evaluateAutomationConsent({ ...baseCleared, caslSensitive: true });
    expect(result.outcome).toBe('cleared');
  });

  it('blocks a CASL-sensitive action when consent is only implied', () => {
    const result = evaluateAutomationConsent({
      ...baseCleared,
      consentStatus: 'implied',
      caslSensitive: true,
    });
    expect(result.outcome).toBe('blocked');
    expect(result.blockingCodes).toContain('casl_explicit_consent_required');
  });

  it('blocks a CASL-sensitive action when there is no consent', () => {
    const result = evaluateAutomationConsent({
      ...baseCleared,
      consentStatus: 'none',
      caslSensitive: true,
    });
    expect(result.outcome).toBe('blocked');
    expect(result.blockingCodes).toContain('casl_explicit_consent_required');
    expect(result.blockingCodes).toContain('no_consent');
  });
});

describe('evaluateAutomationConsent — implied consent', () => {
  it('escalates non-CASL implied consent to requires_review', () => {
    const result = evaluateAutomationConsent({ ...baseCleared, consentStatus: 'implied' });
    expect(result.outcome).toBe('requires_review');
    expect(result.reviewCodes).toContain('implied_consent_review_required');
  });
});

describe('evaluateAutomationConsent — accumulation & ordering', () => {
  it('accumulates multiple blocking signals', () => {
    const result = evaluateAutomationConsent({
      channel: 'sms',
      consentStatus: 'none',
      workspaceId: '',
      doNotContact: true,
      caslSensitive: true,
    });
    expect(result.outcome).toBe('blocked');
    // workspace_required, do_not_contact, no_consent, casl_explicit_consent_required
    expect(result.blockingCodes.length).toBeGreaterThanOrEqual(4);
  });

  it('reports blocking signals ahead of review signals', () => {
    const result = evaluateAutomationConsent({
      ...baseCleared,
      consentStatus: 'ambiguous',
      law25Flag: true,
    });
    const severities = result.signals.map((s) => s.severity);
    const firstReview = severities.indexOf('review');
    const lastBlock = severities.lastIndexOf('block');
    expect(firstReview).toBeGreaterThan(lastBlock);
  });
});

describe('CONSENT_STATUSES', () => {
  it('lists exactly the modelled statuses', () => {
    expect([...CONSENT_STATUSES]).toEqual([
      'explicit',
      'implied',
      'ambiguous',
      'none',
      'expired',
      'revoked',
    ]);
  });
});
