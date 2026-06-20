import { describe, expect, it } from 'vitest';
import type { Lead, Vehicle } from '../types';
import {
  generateLeadSummary,
  generateSafeReplyDraft,
  generateVehicleListingDraft,
} from './ai-drafts';

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: 'L1',
    name: 'Test Buyer',
    email: 't@example.com',
    phone: '+1 555 0100',
    source: 'Website',
    vehicleInterest: 'a used SUV',
    vehicleId: null,
    budgetCad: null,
    message: '',
    signals: {
      appointmentRequested: false,
      financingRequested: false,
      tradeInMentioned: false,
      budgetProvided: false,
      respondToday: false,
      specificVehicleSelected: false,
    },
    score: 10,
    stage: 'Nurture',
    owner: 'Unassigned',
    nextAction: 'Follow up',
    consent: { email: true, sms: false, whatsapp: false, capturedAt: null, basis: 'implied' },
    firstResponseMinutes: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

const vehicle: Vehicle = {
  id: 'V2',
  year: 2021,
  make: 'Toyota',
  model: 'RAV4',
  trim: 'XLE AWD',
  priceCad: 34500,
  odometerKm: 41800,
  bodyType: 'SUV',
  fuelType: 'Gasoline',
  transmission: 'Automatic',
  drivetrain: 'AWD',
  exteriorColor: 'Magnetic Grey',
  accent: ['#0a1124', '#4fe0b0'],
  badges: ['Certified', 'Low KM'],
  status: 'Available',
};

describe('generateSafeReplyDraft', () => {
  it('flags a financing lead and requires approval', () => {
    const draft = generateSafeReplyDraft(
      lead({ signals: { ...lead().signals, financingRequested: true } }),
    );
    expect(draft.content.length).toBeGreaterThan(0);
    expect(draft.claimTypes).toContain('finance');
    expect(draft.requiresApproval).toBe(true);
  });

  it('does not require approval for a clean low-signal lead', () => {
    const draft = generateSafeReplyDraft(lead());
    expect(draft.claimTypes).toEqual([]);
    expect(draft.requiresApproval).toBe(false);
  });

  it('is deterministic', () => {
    const l = lead({ name: 'Dana Singh', signals: { ...lead().signals, tradeInMentioned: true } });
    expect(generateSafeReplyDraft(l)).toEqual(generateSafeReplyDraft(l));
  });
});

describe('generateLeadSummary', () => {
  it('never auto-gates (internal) even when it mentions financing', () => {
    const draft = generateLeadSummary(
      lead({ signals: { ...lead().signals, financingRequested: true } }),
    );
    expect(draft.content.length).toBeGreaterThan(0);
    expect(draft.claimTypes).toContain('finance');
    expect(draft.requiresApproval).toBe(false);
  });
});

describe('generateVehicleListingDraft', () => {
  it('produces non-empty copy that requires approval (sensitive fields)', () => {
    const draft = generateVehicleListingDraft(vehicle);
    expect(draft.content.length).toBeGreaterThan(0);
    expect(draft.requiresApproval).toBe(true);
    expect(draft.riskLevel).toBe('high');
  });
});
