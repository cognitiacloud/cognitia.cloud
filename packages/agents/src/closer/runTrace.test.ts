import { describe, expect, it } from 'vitest';
import {
  PROOF_RECEIPT_HANDLE_STATUS,
  buildRunTrace,
  proofReceiptIdForTransition,
  traceToJson,
  traceToJsonString,
} from './runTrace.js';
import { createSalesCloserWorkflow } from './salesCloserWorkflow.js';
import { createMockCloserPorts, type MockPortOverrides } from './mockPorts.js';
import { FIXTURE_LEAD } from './__fixtures__/lead.fixture.js';
import type { RawGtmProspectInput } from '@cognitia/core';

const FIXED_ID = '11111111-1111-1111-1111-111111111111';
const FIXED_NOW = new Date('2026-06-21T00:00:00.000Z');

/** Same deterministic harness as the workflow tests (fixed clock + ids). */
function workflow(overrides: MockPortOverrides = {}) {
  let counter = 0;
  return createSalesCloserWorkflow({
    ports: createMockCloserPorts(overrides),
    now: () => FIXED_NOW,
    newId: () => `${FIXED_ID.slice(0, -1)}${counter++}`,
  });
}

function run(lead: RawGtmProspectInput, overrides: MockPortOverrides = {}) {
  return workflow(overrides).run(lead);
}

describe('buildRunTrace — happy path', () => {
  it('derives a line per transition, ending at completed with proof handles', async () => {
    const trace = buildRunTrace(await run(FIXTURE_LEAD));

    expect(trace.outcome).toBe('completed');
    expect(trace.status).toBe('completed');
    expect(trace.finalState).toBe('completed');
    expect(trace.lineCount).toBe(trace.lines.length);

    // seq is 0-based and strictly monotonic.
    expect(trace.lines.map((l) => l.seq)).toEqual(trace.lines.map((_, i) => i));

    // The final state visited is `completed`.
    expect(trace.lines.at(-1)?.state).toBe('completed');

    // Every line carries the three core fields.
    for (const line of trace.lines) {
      expect(typeof line.timestamp).toBe('string');
      expect(line.state).toBeTruthy();
      expect(line.event).toBeTruthy();
    }
  });

  it('maps the appointment and crm lines to GtmProofEvent.id proof handles', async () => {
    const result = await run(FIXTURE_LEAD);
    const trace = buildRunTrace(result);

    const appointmentLine = trace.lines.find((l) => l.event === 'appointment');
    const crmLine = trace.lines.find((l) => l.event === 'crm');

    expect(appointmentLine?.proofReceiptId).toBe(
      result.proofs.find((p) => p.kind === 'gtm.discovery.booked.v1')?.id,
    );
    expect(crmLine?.proofReceiptId).toBe(
      result.proofs.find((p) => p.kind === 'gtm.proposal.generated.v1')?.id,
    );

    // Both proof handles surface in the summary list, in order.
    expect(trace.proofReceiptIds).toEqual(result.proofs.map((p) => p.id));
    expect(trace.proofReceiptIds).toHaveLength(2);
  });

  it('reports the writeback result on the crm line and approval/policy decisions', async () => {
    const trace = buildRunTrace(await run(FIXTURE_LEAD));

    expect(trace.lines.find((l) => l.event === 'crm')?.writeback).toBe('ok');
    expect(trace.lines.find((l) => l.event === 'compliance')?.policyDecision).toBe('allow');
    expect(trace.lines.find((l) => l.event === 'approval')?.approvalState).toBe('approved');
  });

  it('marks the proof lane active but the formal receipt handle pending', async () => {
    const trace = buildRunTrace(await run(FIXTURE_LEAD));
    expect(trace.proofLaneStatus).toBe('active');
    expect(trace.proofReceiptHandleStatus).toBe('pending');
    expect(PROOF_RECEIPT_HANDLE_STATUS).toBe('pending');
  });
});

describe('buildRunTrace — blocked path', () => {
  it('captures a policy block at compliance with no proof handles', async () => {
    const trace = buildRunTrace(
      await run(FIXTURE_LEAD, { compliance: { status: 'blocked', reason: 'legal review' } }),
    );

    expect(trace.outcome).toBe('blocked');
    expect(trace.finalState).toBe('blocked_compliance');
    expect(trace.blockedReason).toBe('legal review');
    expect(trace.lines.find((l) => l.event === 'compliance')?.policyDecision).toBe('block');
    expect(trace.proofReceiptIds).toEqual([]);
  });
});

describe('buildRunTrace — rejected path', () => {
  it('captures a human rejection at the approval gate', async () => {
    const trace = buildRunTrace(
      await run(FIXTURE_LEAD, { approval: { status: 'rejected', reason: 'not a fit' } }),
    );

    expect(trace.outcome).toBe('blocked');
    expect(trace.finalState).toBe('blocked_approval');
    const approvalLine = trace.lines.find((l) => l.event === 'approval');
    expect(approvalLine?.approvalState).toBe('rejected');
    expect(trace.proofReceiptIds).toEqual([]);
  });
});

describe('buildRunTrace — PII redaction', () => {
  // A lead carrying raw contact PII + free-text notes. normalizeGtmProspect
  // hashes/masks the email/phone and keeps contactName/masks/domain/notes on the
  // prospect — the trace must suppress every one of those.
  const LEAD_WITH_PII: RawGtmProspectInput = {
    ...FIXTURE_LEAD,
    contactName: 'Jane Closer',
    contactEmail: 'jane.closer@dealer.example',
    contactPhone: '+1 (604) 555-1234',
    notes: 'Reach Jane at jane.closer@dealer.example or 604-555-1234.',
  };

  it('suppresses sensitive prospect fields and counts the redactions', async () => {
    const trace = buildRunTrace(await run(LEAD_WITH_PII));

    // The whitelist subject exposes only business-safe fields.
    expect(trace.subject).toMatchObject({ companyName: 'Northshore Auto Group' });
    expect('contactName' in trace.subject).toBe(false);
    expect('contactEmailMasked' in trace.subject).toBe(false);
    expect('contactDomain' in trace.subject).toBe(false);
    expect('notes' in trace.subject).toBe(false);
    expect(trace.redactionCount).toBeGreaterThan(0);
  });

  it('produces a JSON export containing no raw email or phone', async () => {
    const json = traceToJsonString(await run(LEAD_WITH_PII));

    expect(json).not.toContain('@');
    expect(json).not.toContain('jane.closer');
    expect(json).not.toContain('Jane');
    // The raw phone (any contiguous run of its digits) must not survive. UUIDs
    // legitimately contain digits, so we assert on the phone's own fragments.
    expect(json).not.toContain('555-1234');
    expect(json).not.toContain('6045551234');
    expect(json).not.toContain('604');
  });
});

describe('buildRunTrace — JSON safety & determinism', () => {
  it('round-trips through JSON without loss', async () => {
    const trace = buildRunTrace(await run(FIXTURE_LEAD));
    const roundTripped = JSON.parse(JSON.stringify(trace));
    expect(roundTripped).toEqual(trace);
  });

  it('traceToJson is the same pure derivation as buildRunTrace', async () => {
    const result = await run(FIXTURE_LEAD);
    expect(traceToJson(result)).toEqual(buildRunTrace(result));
  });

  it('derives deterministically from the same run (no IO, no mutation)', async () => {
    const result = await run(FIXTURE_LEAD);
    const before = JSON.stringify(result);
    const a = buildRunTrace(result);
    const b = buildRunTrace(result);
    expect(a).toEqual(b);
    // The source run is never mutated by trace derivation.
    expect(JSON.stringify(result)).toBe(before);
  });
});

describe('proofReceiptIdForTransition', () => {
  it('returns null for phases that produce no proof event', () => {
    expect(proofReceiptIdForTransition('init', [])).toBeNull();
    expect(proofReceiptIdForTransition('compliance', [])).toBeNull();
    expect(proofReceiptIdForTransition('approval', [])).toBeNull();
  });

  it('returns null when the expected proof event is absent', () => {
    expect(proofReceiptIdForTransition('appointment', [])).toBeNull();
  });
});
