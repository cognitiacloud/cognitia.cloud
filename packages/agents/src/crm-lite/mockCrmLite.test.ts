import { describe, expect, it } from 'vitest';
import { createMockCrmLite, crmIdempotencyKey } from './mockCrmLite.js';
import { assertNoRawPii } from './timeline.js';

const WS = 'budget_wheels_demo';
const PROSPECT = 'prospect-1';

function seqIds(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}${++n}`;
}

function makeCrm() {
  return createMockCrmLite({
    now: () => new Date('2026-06-22T10:00:00.000Z'),
    newId: seqIds('id'),
  });
}

describe('crmIdempotencyKey', () => {
  it('includes appointmentRef only when present', () => {
    expect(crmIdempotencyKey(WS, PROSPECT)).toBe(`${WS}::${PROSPECT}`);
    expect(crmIdempotencyKey(WS, PROSPECT, 'appt-1')).toBe(`${WS}::${PROSPECT}::appt-1`);
  });
});

describe('MockCrmLite — happy path', () => {
  it('creates company, contact, opportunity and reads them back', () => {
    const crm = makeCrm();
    const company = crm.upsertCompany({
      workspaceId: WS,
      companyName: 'Budget Wheels',
      attributes: { region: 'BC', businessType: 'auto_dealership' },
    });
    const contact = crm.upsertContact({
      workspaceId: WS,
      prospectId: PROSPECT,
      companyId: company.id,
      role: 'General Manager',
      emailExample: 'gm@budgetwheels.example',
    });
    const opp = crm.upsertOpportunity({
      workspaceId: WS,
      prospectId: PROSPECT,
      companyId: company.id,
      stage: 'appointment_set',
      appointmentRef: 'appt-1',
      crmRecordRef: 'rec-1',
    });

    expect(crm.getCompany(WS, 'Budget Wheels')).toEqual(company);
    expect(crm.getContact(WS, PROSPECT)).toEqual(contact);
    expect(crm.getOpportunity(WS, PROSPECT, 'appt-1')).toEqual(opp);
    expect(crm.listCompanies(WS)).toHaveLength(1);
  });
});

describe('MockCrmLite — idempotency (double-upsert = single record)', () => {
  it('company: same key twice keeps one record with same id', () => {
    const crm = makeCrm();
    const a = crm.upsertCompany({
      workspaceId: WS,
      companyName: 'Budget Wheels',
      attributes: { region: 'BC' },
    });
    const b = crm.upsertCompany({
      workspaceId: WS,
      companyName: 'Budget Wheels',
      attributes: { region: 'AB' },
    });
    expect(b.id).toBe(a.id);
    expect(crm.listCompanies(WS)).toHaveLength(1);
    expect(crm.getCompany(WS, 'Budget Wheels')?.attributes).toEqual({ region: 'AB' });
  });

  it('contact: same workspace+prospect twice keeps one record', () => {
    const crm = makeCrm();
    const c = crm.upsertCompany({ workspaceId: WS, companyName: 'Budget Wheels' });
    const a = crm.upsertContact({
      workspaceId: WS,
      prospectId: PROSPECT,
      companyId: c.id,
      role: 'GM',
    });
    const b = crm.upsertContact({
      workspaceId: WS,
      prospectId: PROSPECT,
      companyId: c.id,
      role: 'Owner',
    });
    expect(b.id).toBe(a.id);
    expect(crm.listContacts(WS)).toHaveLength(1);
    expect(crm.getContact(WS, PROSPECT)?.role).toBe('Owner');
  });

  it('opportunity: same workspace+prospect+appointmentRef twice keeps one record', () => {
    const crm = makeCrm();
    const c = crm.upsertCompany({ workspaceId: WS, companyName: 'Budget Wheels' });
    const a = crm.upsertOpportunity({
      workspaceId: WS,
      prospectId: PROSPECT,
      companyId: c.id,
      stage: 'lead',
      appointmentRef: 'appt-1',
    });
    const b = crm.upsertOpportunity({
      workspaceId: WS,
      prospectId: PROSPECT,
      companyId: c.id,
      stage: 'proposal',
      appointmentRef: 'appt-1',
    });
    expect(b.id).toBe(a.id);
    expect(crm.listOpportunities(WS)).toHaveLength(1);
    expect(crm.getOpportunity(WS, PROSPECT, 'appt-1')?.stage).toBe('proposal');
  });

  it('opportunity: a different appointmentRef is a distinct record', () => {
    const crm = makeCrm();
    const c = crm.upsertCompany({ workspaceId: WS, companyName: 'Budget Wheels' });
    crm.upsertOpportunity({
      workspaceId: WS,
      prospectId: PROSPECT,
      companyId: c.id,
      stage: 'lead',
      appointmentRef: 'appt-1',
    });
    crm.upsertOpportunity({
      workspaceId: WS,
      prospectId: PROSPECT,
      companyId: c.id,
      stage: 'lead',
      appointmentRef: 'appt-2',
    });
    expect(crm.listOpportunities(WS)).toHaveLength(2);
  });

  it('preserves createdAt across re-upsert and bumps updatedAt', () => {
    let t = 0;
    const times = ['2026-06-22T10:00:00.000Z', '2026-06-22T11:00:00.000Z'];
    const crm = createMockCrmLite({
      now: () => new Date(times[Math.min(t++, times.length - 1)]!),
      newId: seqIds('id'),
    });
    const a = crm.upsertCompany({ workspaceId: WS, companyName: 'Budget Wheels' });
    const b = crm.upsertCompany({ workspaceId: WS, companyName: 'Budget Wheels' });
    expect(b.createdAt).toBe(a.createdAt);
    expect(b.updatedAt).not.toBe(a.updatedAt);
  });
});

describe('MockCrmLite — blocked / rejected lifecycle via timeline', () => {
  it('records a blocked compliance event without creating CRM records', () => {
    const crm = makeCrm();
    crm.timeline.record({
      workspaceId: WS,
      prospectId: PROSPECT,
      kind: 'compliance',
      outcome: 'blocked',
      summary: 'Prospect is do-not-contact',
    });
    expect(crm.listCompanies(WS)).toHaveLength(0);
    const tl = crm.readTimeline({ workspaceId: WS });
    expect(tl).toHaveLength(1);
    expect(tl[0]?.outcome).toBe('blocked');
  });

  it('records a rejected approval event', () => {
    const crm = makeCrm();
    crm.timeline.record({
      workspaceId: WS,
      prospectId: PROSPECT,
      kind: 'approval',
      outcome: 'rejected',
      summary: 'Human rejected outreach',
    });
    expect(crm.readTimeline()[0]?.outcome).toBe('rejected');
  });
});

describe('MockCrmLite — PII safety', () => {
  it('rejects a non-reserved contact email', () => {
    const crm = makeCrm();
    const c = crm.upsertCompany({ workspaceId: WS, companyName: 'Budget Wheels' });
    expect(() =>
      crm.upsertContact({
        workspaceId: WS,
        prospectId: PROSPECT,
        companyId: c.id,
        emailExample: 'gm@realdealer.com',
      }),
    ).toThrow(/reserved TLD/);
  });

  it('allows a reserved .example contact email', () => {
    const crm = makeCrm();
    const c = crm.upsertCompany({ workspaceId: WS, companyName: 'Budget Wheels' });
    const contact = crm.upsertContact({
      workspaceId: WS,
      prospectId: PROSPECT,
      companyId: c.id,
      emailExample: 'gm@budgetwheels.example',
    });
    expect(contact.emailExample).toBe('gm@budgetwheels.example');
  });

  it('no stored CRM record or timeline event contains raw-looking PII', () => {
    const crm = makeCrm();
    const company = crm.upsertCompany({
      workspaceId: WS,
      companyName: 'Budget Wheels',
      attributes: { region: 'BC' },
    });
    crm.upsertContact({
      workspaceId: WS,
      prospectId: PROSPECT,
      companyId: company.id,
      role: 'General Manager',
      emailExample: 'gm@budgetwheels.example',
    });
    crm.upsertOpportunity({
      workspaceId: WS,
      prospectId: PROSPECT,
      companyId: company.id,
      stage: 'appointment_set',
      appointmentRef: 'appt-1',
    });
    crm.timeline.record({
      workspaceId: WS,
      prospectId: PROSPECT,
      kind: 'crm_writeback',
      outcome: 'ok',
      summary: 'CRM record written (mock)',
      refs: { crmRecordRef: 'rec-1' },
    });

    const blob = JSON.stringify({
      companies: crm.listCompanies(),
      contacts: crm.listContacts(),
      opportunities: crm.listOpportunities(),
      timeline: crm.readTimeline(),
    });
    expect(() => assertNoRawPii(blob)).not.toThrow();
  });
});
