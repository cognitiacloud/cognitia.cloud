import { describe, expect, it } from 'vitest';
import type { Customer, Lead } from '../types';
import { buildCustomerFromLead, consentEventsFromLead, findExistingCustomer } from './customers';

function makeLead(over: Partial<Lead> = {}): Lead {
  return {
    id: 'LD1',
    name: 'Dana Singh',
    email: 'dana@example.com',
    phone: '+1 555 0142',
    source: 'Website',
    vehicleInterest: '2021 Toyota RAV4',
    vehicleId: null,
    budgetCad: null,
    message: 'Is it still available?',
    signals: {
      appointmentRequested: false,
      financingRequested: false,
      tradeInMentioned: false,
      budgetProvided: false,
      respondToday: false,
      specificVehicleSelected: false,
    },
    score: 20,
    stage: 'Nurture',
    owner: 'Unassigned',
    nextAction: 'Follow up',
    consent: {
      email: true,
      sms: false,
      whatsapp: false,
      capturedAt: '2026-01-01T00:00:00Z',
      basis: 'express',
    },
    firstResponseMinutes: 1,
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function makeCustomer(over: Partial<Customer> = {}): Customer {
  return {
    id: 'C1',
    name: 'Existing Person',
    vehicle: 'General inquiry',
    preferredChannel: 'email',
    familyNote: '',
    preferences: [],
    lastConcern: '',
    nextAction: 'Follow up',
    loyaltyMonths: 0,
    consent: { email: true, sms: false, whatsapp: false, capturedAt: null, basis: 'implied' },
    timeline: [],
    ...over,
  };
}

describe('findExistingCustomer', () => {
  it('matches on phone first', () => {
    const customers = [
      makeCustomer({ id: 'C1', phone: '+1 555 0142', email: 'other@example.com' }),
      makeCustomer({ id: 'C2', phone: '+1 999 0000', email: 'dana@example.com' }),
    ];
    const found = findExistingCustomer(customers, {
      phone: '+1 555 0142',
      email: 'dana@example.com',
    });
    expect(found?.id).toBe('C1');
  });

  it('falls back to email when no phone match', () => {
    const customers = [makeCustomer({ id: 'C2', phone: '+1 999 0000', email: 'dana@example.com' })];
    const found = findExistingCustomer(customers, {
      phone: '+1 555 0142',
      email: 'dana@example.com',
    });
    expect(found?.id).toBe('C2');
  });

  it('matches email case-insensitively', () => {
    const customers = [makeCustomer({ id: 'C2', email: 'Dana@Example.com' })];
    expect(findExistingCustomer(customers, { email: 'dana@example.com' })?.id).toBe('C2');
  });

  it('returns undefined when nothing matches', () => {
    const customers = [makeCustomer({ id: 'C2', phone: '+1 999 0000', email: 'nope@example.com' })];
    expect(
      findExistingCustomer(customers, { phone: '+1 555 0142', email: 'dana@example.com' }),
    ).toBeUndefined();
  });

  it('ignores empty phone/email so blanks never collide', () => {
    const customers = [makeCustomer({ id: 'C2', phone: '', email: '' })];
    expect(findExistingCustomer(customers, { phone: '', email: '' })).toBeUndefined();
  });
});

describe('buildCustomerFromLead', () => {
  it('derives a memory record with a first-inquiry timeline event', () => {
    const c = buildCustomerFromLead(makeLead(), 'C-new', '2026-06-20T12:00:00Z');
    expect(c.id).toBe('C-new');
    expect(c.name).toBe('Dana Singh');
    expect(c.email).toBe('dana@example.com');
    expect(c.vehicle).toBe('2021 Toyota RAV4');
    expect(c.isDemo).toBe(true);
    expect(c.timeline).toHaveLength(1);
    expect(c.timeline[0]?.kind).toBe('inquiry');
    expect(c.timeline[0]?.date).toBe('2026-06-20');
  });

  it('prefers whatsapp, then sms, then email for the channel', () => {
    expect(
      buildCustomerFromLead(
        makeLead({
          consent: { email: true, sms: true, whatsapp: true, capturedAt: null, basis: 'express' },
        }),
        'x',
        'n',
      ).preferredChannel,
    ).toBe('whatsapp');
    expect(
      buildCustomerFromLead(
        makeLead({
          consent: { email: true, sms: true, whatsapp: false, capturedAt: null, basis: 'express' },
        }),
        'x',
        'n',
      ).preferredChannel,
    ).toBe('sms');
    expect(
      buildCustomerFromLead(
        makeLead({
          consent: { email: true, sms: false, whatsapp: false, capturedAt: null, basis: 'express' },
        }),
        'x',
        'n',
      ).preferredChannel,
    ).toBe('email');
  });
});

describe('consentEventsFromLead', () => {
  it('records one event per consented channel with the lead basis', () => {
    const events = consentEventsFromLead(
      makeLead({
        consent: { email: true, sms: false, whatsapp: true, capturedAt: 'n', basis: 'express' },
      }),
      'C1',
      'LD1',
      '2026-06-20T12:00:00Z',
    );
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.channel)).toEqual(['email', 'whatsapp']);
    expect(events.every((e) => e.basis === 'express' && e.subjectId === 'C1')).toBe(true);
  });

  it('records a single not_established event when no consent was captured', () => {
    const events = consentEventsFromLead(
      makeLead({
        consent: { email: false, sms: false, whatsapp: false, capturedAt: null, basis: 'none' },
      }),
      'C1',
      'LD1',
      '2026-06-20T12:00:00Z',
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.basis).toBe('not_established');
  });
});
