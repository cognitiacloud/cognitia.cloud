import { describe, expect, it } from 'vitest';
import { intakeLead } from './leadIntake.js';
import { loadBudgetWheelsFixture } from './testSupport.test.js';
import { demandaraLeadSchema } from './types.js';

/**
 * Fixture authenticity audit (04_SALES_CLOSER_WORKFLOW_CONTEXT.md deny rules):
 * real PII in a demo fixture fails the audit. Budget Wheels fixtures must be
 * visibly fake/reserved: RESERVED-FAKE aliases, example.com mailboxes, and
 * numbers in the reserved 555-01xx fictional range.
 */

const fixture = loadBudgetWheelsFixture();

describe('Budget Wheels demo fixture is fake/reserved only', () => {
  it('declares the fake-fixture data policy', () => {
    expect(fixture.dataPolicy).toBe('fake_fixture_only_no_real_pii_no_customer_data');
  });

  it('every lead validates against the lead schema and is fake_fixture mode', () => {
    for (const raw of fixture.leads) {
      const lead = demandaraLeadSchema.parse(raw);
      expect(lead.dataMode).toBe('fake_fixture');
    }
  });

  it('every contact alias is explicitly RESERVED-FAKE', () => {
    for (const raw of fixture.leads) {
      expect(String(raw['contactAlias'])).toMatch(/^RESERVED-FAKE /);
    }
  });

  it('every fixture email uses the reserved example.com domain', () => {
    for (const raw of fixture.leads) {
      const email = raw['contactEmailFixture'];
      if (email !== undefined) expect(String(email)).toMatch(/@example\.com$/);
    }
  });

  it('every fixture phone number is in the reserved 555-01xx fictional range', () => {
    for (const raw of fixture.leads) {
      const phone = raw['contactPhoneFixture'];
      if (phone !== undefined) expect(String(phone)).toMatch(/555-01\d\d$/);
    }
  });

  it('fixture leads pass intake (no live data mode sneaks in)', () => {
    for (const raw of fixture.leads) {
      const result = intakeLead(raw);
      expect(result.ok).toBe(true);
    }
  });

  it('a live_customer variant of a fixture lead fails the intake audit', () => {
    const raw = { ...fixture.leads[0], dataMode: 'live_customer' };
    const result = intakeLead(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.code).toBe('LIVE_DATA_MODE_REJECTED');
  });
});
