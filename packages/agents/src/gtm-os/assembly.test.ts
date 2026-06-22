import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RawGtmProspectInput } from '@cognitia/core';
import {
  assembleGtmRunPacket,
  assertNoLiveEgress,
  assertNoRawPii,
  toOperatorTimeline,
  toPiiSafeProspect,
} from './assembly/index.js';
import { normalizeGtmProspect } from '@cognitia/core';

const FIXED_ID = '22222222-2222-2222-2222-222222222222';
const FIXED_NOW = new Date('2026-06-22T00:00:00.000Z');

/**
 * Mock-safe fixture lead — business-only, `.example` domain, no raw PII. A
 * `555-01xx` phone is included to prove the masking pipeline keeps it off the
 * packet (it is hashed/dropped by `normalizeGtmProspect`).
 */
const FIXTURE_LEAD: RawGtmProspectInput = {
  companyName: 'Lakeshore Motors',
  website: 'https://lakeshore-motors.example',
  city: 'Calgary',
  provinceOrState: 'AB',
  country: 'CA',
  businessType: 'auto_dealership',
  source: 'public_registry',
  sourceUrl: 'https://registry.example/lakeshore-motors',
  sourceRisk: 'low',
  contactRole: 'Owner',
  contactPhone: '555-0123',
  contactBasis: 'conspicuously_published_business_contact',
  consentStatus: 'implied_possible',
  unsubscribeStatus: 'subscribed',
  doNotContact: false,
};

function packet(overrides = {}) {
  let counter = 0;
  return assembleGtmRunPacket({
    lead: FIXTURE_LEAD,
    portOverrides: overrides,
    now: () => FIXED_NOW,
    newId: () => `${FIXED_ID.slice(0, -1)}${counter++}`,
  });
}

describe('assembleGtmRunPacket — happy path', () => {
  it('composes a completed packet with workspace attribution + full timeline', async () => {
    const p = await packet();

    expect(p.mode).toBe('mock');
    expect(p.status).toBe('completed');
    expect(p.finalState).toBe('completed');
    expect(p.workspace).toEqual({ workspaceId: 'budget_wheels_demo', sandbox: true });
    expect(p.compliance).toEqual({ passed: true, blocked: false, reason: undefined });
    expect(p.approval.status).toBe('approved');
    expect(p.appointment.requested).toBe(true);
    expect(p.crm.written).toBe(true);
  });

  it('derives an ordered operator timeline from the transitions', async () => {
    const p = await packet();
    expect(p.timeline.map((r) => r.phase)).toEqual([
      'Lead received',
      'Compliance check',
      'Human approval gate',
      'Appointment requested',
      'CRM writeback (mock)',
      'Proof report',
    ]);
    expect(p.timeline.map((r) => r.step)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(p.timeline.every((r) => r.outcome === 'advanced')).toBe(true);
  });

  it('carries the proof trace and a no-live-egress attestation', async () => {
    const p = await packet();
    expect(p.proofs.map((e) => e.kind)).toEqual([
      'gtm.discovery.booked.v1',
      'gtm.proposal.generated.v1',
    ]);
    expect(p.noEgress).toEqual({
      mode: 'mock',
      liveSendOccurred: false,
      statement: expect.stringContaining('MOCK/SANDBOX'),
    });
  });

  it('carries no raw PII (no contact name / hashes / masks / email) in the packet', async () => {
    const p = await packet();
    const serialized = JSON.stringify(p);
    expect(serialized).not.toMatch(/@/);
    expect('contactName' in p.prospect).toBe(false);
    expect('contactEmailHash' in p.prospect).toBe(false);
    expect('contactPhoneMasked' in p.prospect).toBe(false);
    expect(p.prospect.companyName).toBe('Lakeshore Motors');
    expect(p.prospect.contactRole).toBe('Owner');
  });

  it('is deterministic with injected now/newId', async () => {
    const a = await packet();
    const b = await packet();
    expect(a).toEqual(b);
  });
});

describe('assembleGtmRunPacket — blocked / rejected / pending honesty', () => {
  it('blocked-compliance: reflects the halt and records no proofs', async () => {
    const p = await packet({ compliance: { status: 'blocked', reason: 'legal review' } });
    expect(p.status).toBe('blocked');
    expect(p.finalState).toBe('blocked_compliance');
    expect(p.compliance).toEqual({ passed: false, blocked: true, reason: 'legal review' });
    expect(p.approval.status).toBe('pending'); // approval was never requested
    expect(p.appointment.requested).toBe(false);
    expect(p.crm.written).toBe(false);
    expect(p.proofs).toEqual([]);
    expect(p.timeline.at(-1)?.outcome).toBe('blocked');
  });

  it('rejected-approval: reflects the rejection terminal state', async () => {
    const p = await packet({ approval: { status: 'rejected', reason: 'not a fit' } });
    expect(p.status).toBe('blocked');
    expect(p.finalState).toBe('blocked_approval');
    expect(p.compliance.passed).toBe(true);
    expect(p.approval).toEqual({ status: 'rejected', reason: 'not a fit' });
    expect(p.proofs).toEqual([]);
  });

  it('pending-approval: halts awaiting a human, no downstream state', async () => {
    const p = await packet({ approval: { status: 'pending' } });
    expect(p.status).toBe('awaiting_approval');
    expect(p.finalState).toBe('human_approval_required');
    expect(p.approval.status).toBe('pending');
    expect(p.appointment.requested).toBe(false);
    expect(p.crm.written).toBe(false);
    expect(p.proofs).toEqual([]);
    expect(p.timeline.at(-1)?.outcome).toBe('halted');
  });

  it('blocked-crm: appointment proof collected but CRM halt is honest', async () => {
    const p = await packet({ crm: { status: 'failed', reason: 'crm down' } });
    expect(p.finalState).toBe('blocked_crm');
    expect(p.appointment.requested).toBe(true);
    expect(p.crm).toEqual({ written: false, reason: 'crm down' });
    expect(p.proofs.map((e) => e.kind)).toEqual(['gtm.discovery.booked.v1']);
  });
});

describe('guards', () => {
  it('toPiiSafeProspect drops every contact-identity field', () => {
    const full = normalizeGtmProspect(
      { ...FIXTURE_LEAD, contactName: 'Jane Doe', contactEmail: 'jane@lakeshore-motors.example' },
      { id: FIXED_ID, now: FIXED_NOW },
    );
    const safe = toPiiSafeProspect(full);
    expect(JSON.stringify(safe)).not.toMatch(/@/);
    expect(JSON.stringify(safe)).not.toMatch(/Jane/);
    expect('contactName' in safe).toBe(false);
    expect('contactDomain' in safe).toBe(false);
  });

  it('assertNoRawPii throws when a raw email is present', () => {
    expect(() => assertNoRawPii({ email: 'x@y.example' }, 'test')).toThrow(/raw PII/);
    expect(() => assertNoRawPii({ companyName: 'Acme' }, 'test')).not.toThrow();
  });

  it('assertNoLiveEgress attests mock mode and rejects anything else', () => {
    expect(assertNoLiveEgress('mock').liveSendOccurred).toBe(false);
    // @ts-expect-error — only 'mock' is a valid mode
    expect(() => assertNoLiveEgress('live')).toThrow(/only mock mode/);
  });

  it('toOperatorTimeline classifies a blocked transition', () => {
    const rows = toOperatorTimeline([
      { from: 'lead_received', to: 'compliance_check_required', via: 'init', at: '2026-06-22T00:00:00.000Z' },
      {
        from: 'compliance_check_required',
        to: 'blocked_compliance',
        via: 'compliance',
        at: '2026-06-22T00:00:00.000Z',
      },
    ]);
    expect(rows[0]!.outcome).toBe('advanced');
    expect(rows[1]!.outcome).toBe('blocked');
  });
});

describe('mock-safety: no network/vendor imports in the island sources', () => {
  it('production sources import no network/DB/vendor primitives', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const dir = join(here, 'assembly');
    const banned = /\b(fetch|child_process|node:net|node:http|node:https|node:tls|axios|ApifyClient|new\s+Anthropic|Twilio)\b/;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
      const src = readFileSync(join(dir, file), 'utf8');
      expect(banned.test(src), `${file} must make no network/vendor calls`).toBe(false);
      expect(src.includes('@cognitia/db')).toBe(false);
      expect(src.includes('@cognitia/integrations')).toBe(false);
    }
  });
});
