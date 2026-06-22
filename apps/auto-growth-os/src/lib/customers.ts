// lib/customers.ts
// Pure helpers for deriving a Customer (+ consent events) from a captured Lead.
// Deterministic with injected id/now so the store stays SSR-safe and testable.
import type { ConsentChannel, ConsentEvent, Customer, Lead } from '../types';

/** Dedupe priority: matching phone, else matching email, else none. */
export function findExistingCustomer(
  customers: Customer[],
  lead: { phone?: string; email?: string },
): Customer | undefined {
  const phone = (lead.phone ?? '').trim();
  const email = (lead.email ?? '').trim().toLowerCase();
  if (phone) {
    const byPhone = customers.find((c) => (c.phone ?? '').trim() === phone && phone.length > 0);
    if (byPhone) return byPhone;
  }
  if (email) {
    const byEmail = customers.find((c) => (c.email ?? '').trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  return undefined;
}

export function buildCustomerFromLead(lead: Lead, id: string, now: string): Customer {
  const channel: ConsentChannel = lead.consent.whatsapp
    ? 'whatsapp'
    : lead.consent.sms
      ? 'sms'
      : 'email';
  return {
    id,
    name: lead.name,
    email: lead.email || undefined,
    phone: lead.phone || undefined,
    vehicle: lead.vehicleInterest || 'General inquiry',
    preferredChannel: channel,
    familyNote: '',
    preferences: [],
    lastConcern: lead.message || '',
    nextAction: lead.nextAction,
    loyaltyMonths: 0,
    consent: lead.consent,
    timeline: [
      {
        id: `${id}-t1`,
        kind: 'inquiry',
        label: 'First inquiry',
        date: now.slice(0, 10),
        detail: lead.vehicleInterest ? `Asked about ${lead.vehicleInterest}` : 'General inquiry',
      },
    ],
    isDemo: true,
  };
}

/**
 * One ConsentEvent per consented channel. If nothing was consented (e.g. a lead
 * created manually without consent), record a single conservative
 * `not_established` event — never imply consent that wasn't captured.
 */
export function consentEventsFromLead(
  lead: Lead,
  subjectId: string,
  idPrefix: string,
  now: string,
): ConsentEvent[] {
  const channels: ('email' | 'sms' | 'whatsapp')[] = ['email', 'sms', 'whatsapp'];
  const consented = channels.filter((ch) => lead.consent[ch]);
  if (consented.length === 0) {
    return [
      {
        id: `${idPrefix}-c0`,
        subjectId,
        channel: 'email',
        basis: 'not_established',
        capturedAt: now,
      },
    ];
  }
  const basis = lead.consent.basis === 'none' ? 'not_established' : lead.consent.basis;
  return consented.map((ch, i) => ({
    id: `${idPrefix}-c${i + 1}`,
    subjectId,
    channel: ch,
    basis,
    capturedAt: now,
  }));
}
