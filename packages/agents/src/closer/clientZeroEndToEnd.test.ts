import { describe, expect, it } from 'vitest';
import {
  createSalesCloserWorkflow,
  type SalesCloserState,
  type WorkflowRun,
  type WorkflowTransition,
} from './salesCloserWorkflow.js';
import { createMockCloserPorts, type MockPortOverrides } from './mockPorts.js';
import type { CloserPorts } from './ports.js';
import { FIXTURE_LEAD } from './__fixtures__/lead.fixture.js';
import { normalizeGtmProspect, type RawGtmProspectInput } from '@cognitia/core';
import {
  CLOSER_RUNTIME_SOURCE_FILES,
  createRecordingProofPort,
  createStatefulCrmPort,
  fixedClock,
  readCloserSource,
  seqId,
  SYNTHETIC_PII_LEAD,
  SYNTHETIC_PII_PHONE_DIGITS,
  SYNTHETIC_PII_RAW_EMAIL,
  SYNTHETIC_PII_RAW_PHONE,
  type RecordingProofPort,
  type StatefulCrmPort,
} from './testUtils.js';

/**
 * Client-zero end-to-end harness for the canonical Sales Closer workflow.
 *
 * This exercises the REAL workflow (`packages/agents/src/closer/**`) — not a
 * parallel reimplementation — driving one lead through the full path:
 *   lead in → compliance gate → human approval → mock appointment →
 *   mock CRM writeback → proof events.
 *
 * It complements the unit-level `salesCloserWorkflow.test.ts` by asserting the
 * end-to-end safety invariants the mission requires: the human gate halts
 * before any write, the CRM writeback is idempotent, no source performs live
 * egress, and no raw PII reaches any receipt.
 *
 * One required guarantee — a proof receipt for EVERY transition plus a persisted
 * proof report — is NOT met by the current spine. The harness pins the true
 * current behavior (6 transitions, exactly 2 in-memory proof events, no report
 * artifact) and labels it a VERIFIED GAP rather than faking a pass. See
 * docs/sales-closer/test-evidence.md.
 */

/** The exact ordered `to` sequence the happy path must visit. */
const HAPPY_PATH: SalesCloserState[] = [
  'compliance_check_required',
  'human_approval_required',
  'appointment_requested',
  'crm_writeback_requested',
  'proof_report_requested',
  'completed',
];

/** Build a deterministic workflow over the default mock ports (+ overrides). */
function workflow(overrides: MockPortOverrides = {}) {
  return createSalesCloserWorkflow({
    ports: createMockCloserPorts(overrides),
    now: fixedClock(),
    newId: seqId(),
  });
}

/**
 * Build a deterministic workflow whose CRM and proof boundaries are observable
 * fakes, so the harness can assert what was written/recorded. The CRM instance
 * is returned so its state persists across multiple `.run()` calls.
 */
function observableWorkflow(
  overrides: MockPortOverrides = {},
  crm: StatefulCrmPort = createStatefulCrmPort(),
  proof: RecordingProofPort = createRecordingProofPort(),
) {
  const base = createMockCloserPorts(overrides);
  const ports: CloserPorts = { ...base, crm: crm.port, proof };
  const make = () =>
    createSalesCloserWorkflow({ ports, now: fixedClock(), newId: seqId() });
  return { make, crm, proof };
}

/** A receipt is everything an auditor can inspect after a run. */
function serializeReceipts(run: WorkflowRun): string {
  return JSON.stringify({ transitions: run.transitions, proofs: run.proofs });
}

/** Assert the transition log is contiguous and starts at lead_received. */
function expectContiguous(transitions: WorkflowTransition[]): void {
  expect(transitions[0]?.from).toBe('lead_received');
  for (let i = 0; i < transitions.length; i += 1) {
    const t = transitions[i]!;
    expect(typeof t.at).toBe('string');
    expect(t.at.length).toBeGreaterThan(0);
    expect(t.via).toBeTruthy();
    if (i > 0) expect(t.from).toBe(transitions[i - 1]!.to);
  }
}

describe('client-zero E2E — happy path', () => {
  it('completes lead → compliance → approval → appointment → CRM → proof → completed', async () => {
    const run = await workflow().run(FIXTURE_LEAD);

    expect(run.status).toBe('completed');
    expect(run.state).toBe('completed');
    expect(run.transitions.map((t) => t.to)).toEqual(HAPPY_PATH);
    expectContiguous(run.transitions);
    expect(run.blockedReason).toBeUndefined();
  });

  it('records the appointment and proposal proof events through the proof port', async () => {
    const { make, proof } = observableWorkflow();
    const run = await make().run(FIXTURE_LEAD);

    expect(run.status).toBe('completed');
    // What the run collected and what the proof port actually received agree.
    expect(proof.recorded).toEqual(run.proofs);
    expect(run.proofs.map((p) => p.kind)).toEqual([
      'gtm.discovery.booked.v1',
      'gtm.proposal.generated.v1',
    ]);
  });
});

describe('client-zero E2E — blocked path stops before approval & writeback', () => {
  it('halts at compliance (boundary blocked): no approval, no CRM write, no proofs', async () => {
    const { make, crm, proof } = observableWorkflow({
      compliance: { status: 'blocked', reason: 'legal review' },
    });
    const run = await make().run(FIXTURE_LEAD);

    expect(run.status).toBe('blocked');
    expect(run.state).toBe('blocked_compliance');
    expect(run.blockedReason).toBe('legal review');
    // Nothing downstream of the gate ran.
    expect(run.proofs).toEqual([]);
    expect(proof.recorded).toEqual([]);
    expect(crm.calls()).toBe(0);
    expect(crm.persisted()).toBe(0);
    // Approval was never reached: the only transitions are init → compliance.
    expect(run.transitions.map((t) => t.via)).toEqual(['init', 'compliance']);
  });

  it('halts by compliance doctrine BEFORE any boundary call (do-not-contact lead)', async () => {
    const { make, crm, proof } = observableWorkflow();
    const run = await make().run({ ...FIXTURE_LEAD, doNotContact: true });

    expect(run.state).toBe('blocked_compliance');
    expect(run.blockedReason).toMatch(/not contactable/);
    expect(crm.calls()).toBe(0);
    expect(proof.recorded).toEqual([]);
  });
});

describe('client-zero E2E — rejected path stops before appointment & CRM', () => {
  it('halts at human approval when rejected: no appointment, no CRM write, no proofs', async () => {
    const { make, crm, proof } = observableWorkflow({
      approval: { status: 'rejected', reason: 'not a fit' },
    });
    const run = await make().run(FIXTURE_LEAD);

    expect(run.status).toBe('blocked');
    expect(run.state).toBe('blocked_approval');
    expect(run.proofs).toEqual([]);
    expect(proof.recorded).toEqual([]);
    expect(crm.calls()).toBe(0);
    expect(crm.persisted()).toBe(0);
    // Reached the approval gate but never appointment.
    expect(run.transitions.map((t) => t.to)).toEqual([
      'compliance_check_required',
      'human_approval_required',
      'blocked_approval',
    ]);
  });
});

describe('client-zero E2E — pending approval cannot write', () => {
  it('pauses at the human gate and never advances to appointment/CRM/proof', async () => {
    const { make, crm, proof } = observableWorkflow({ approval: { status: 'pending' } });
    const run = await make().run(FIXTURE_LEAD);

    expect(run.status).toBe('awaiting_approval');
    expect(run.state).toBe('human_approval_required');
    expect(run.proofs).toEqual([]);
    expect(proof.recorded).toEqual([]);
    // The decisive invariant: a pending human decision performs zero writes.
    expect(crm.calls()).toBe(0);
    expect(crm.persisted()).toBe(0);
  });
});

describe('client-zero E2E — CRM writeback is idempotent', () => {
  it('re-running the same lead converges to a single CRM record with a stable ref', async () => {
    // One shared CRM instance across two independent, identically-seeded runs.
    const { make, crm } = observableWorkflow();

    const first = await make().run(FIXTURE_LEAD);
    const second = await make().run(FIXTURE_LEAD);

    expect(first.status).toBe('completed');
    expect(second.status).toBe('completed');

    // writeback was invoked once per run, but only one record was persisted.
    expect(crm.calls()).toBe(2);
    expect(crm.persisted()).toBe(1);

    const refOf = (run: WorkflowRun) =>
      run.proofs.find((p) => p.kind === 'gtm.proposal.generated.v1')?.detailsPrivate.crmRecordRef;
    expect(refOf(first)).toBeTruthy();
    expect(refOf(second)).toEqual(refOf(first));
  });

  it('a direct repeated writeback for the same key never creates a second record', async () => {
    const crm = createStatefulCrmPort();
    const request = { prospectId: 'prospect-1', appointmentRef: 'appt-1' };

    const a = await crm.port.writeback(request);
    const b = await crm.port.writeback(request);

    expect(a.status).toBe('ok');
    expect(b.recordRef).toEqual(a.recordRef);
    expect(crm.calls()).toBe(2);
    expect(crm.persisted()).toBe(1);
  });
});

describe('client-zero E2E — proof receipt per transition (VERIFIED GAP)', () => {
  it('pins current behavior: 6 transitions but only 2 proof events, and no report artifact', async () => {
    const { make, proof } = observableWorkflow();
    const run = await make().run(FIXTURE_LEAD);

    // The happy path makes six transitions...
    expect(run.transitions).toHaveLength(6);
    // ...but the spine emits a proof for only two of them (appointment, CRM).
    expect(run.proofs).toHaveLength(2);
    expect(proof.recorded).toHaveLength(2);
    expect(run.proofs.length).toBeLessThan(run.transitions.length);

    // GAP: the compliance, approval, and proof-report transitions carry no
    // proof receipt of their own.
    const viaWithProof = new Set(['appointment', 'crm']);
    const transitionsWithoutProof = run.transitions.filter((t) => !viaWithProof.has(t.via));
    expect(transitionsWithoutProof.map((t) => t.via)).toEqual([
      'init',
      'compliance',
      'approval',
      'proof',
    ]);

    // GAP: there is no persisted proof report artifact on the run — proofs are
    // in-memory only and the proof port returns a bare {status} ack.
    expect('report' in run).toBe(false);
    expect('receipt' in run).toBe(false);
  });
});

describe('client-zero E2E — receipts contain no raw PII', () => {
  it('drops raw email/phone from the prospect and never leaks them into receipts', async () => {
    const { make, proof } = observableWorkflow();
    const run = await make().run(SYNTHETIC_PII_LEAD);
    expect(run.status).toBe('completed');

    // The raw input genuinely carried PII (otherwise this proves nothing).
    expect(SYNTHETIC_PII_LEAD.contactEmail).toBe(SYNTHETIC_PII_RAW_EMAIL);
    expect(SYNTHETIC_PII_LEAD.contactPhone).toBe(SYNTHETIC_PII_RAW_PHONE);

    // The normalized prospect keeps no raw contact fields (hash/mask/domain only).
    expect('contactEmail' in run.prospect).toBe(false);
    expect('contactPhone' in run.prospect).toBe(false);

    // No receipt (transitions + proofs, and what the proof port received)
    // contains the raw email, its local-part, or the raw phone digits.
    const receipts = serializeReceipts(run) + JSON.stringify(proof.recorded);
    expect(receipts).not.toContain(SYNTHETIC_PII_RAW_EMAIL);
    expect(receipts).not.toContain('gm@');
    expect(receipts).not.toContain(SYNTHETIC_PII_PHONE_DIGITS);
    expect(receipts).not.toContain('5550142');
    expect(receipts).not.toMatch(/@/);
  });
});

describe('client-zero E2E — closer runtime sources perform no live egress', () => {
  // Banned-egress pattern literals live HERE (in the test), never in the helper,
  // so the scan can never match its own declarations.
  const BANNED_PRIMITIVES =
    /\b(fetch|child_process|node:net|node:http|node:https|ApifyClient|HunterClient|ApolloClient)\b|new\s+Anthropic|process\.env/;
  const URL_PATTERN = /https?:\/\/[^\s'"`)]+/g;
  const BANNED_DEPS = ['@cognitia/db', '@cognitia/integrations'];

  it.each(CLOSER_RUNTIME_SOURCE_FILES)('%s contains no network/vendor primitive', (file) => {
    const src = readCloserSource(file);
    expect(BANNED_PRIMITIVES.test(src), `${file} must perform no live egress`).toBe(false);
    for (const dep of BANNED_DEPS) {
      expect(src.includes(dep), `${file} must not reach the DB/integrations layer`).toBe(false);
    }
  });

  it.each(CLOSER_RUNTIME_SOURCE_FILES)('%s uses only .example URLs (no live hosts)', (file) => {
    const src = readCloserSource(file);
    for (const url of src.match(URL_PATTERN) ?? []) {
      const host = new URL(url).hostname;
      expect(host.endsWith('.example'), `${file} references live host ${host}`).toBe(true);
    }
  });
});

describe('client-zero E2E — synthetic fixtures use reserved ranges', () => {
  it('the happy-path fixture lead uses an .example domain', () => {
    const host = new URL(FIXTURE_LEAD.website as string).hostname;
    expect(host.endsWith('.example')).toBe(true);
  });

  it('the synthetic PII lead uses an .example email domain and a 555-01xx phone', () => {
    expect(SYNTHETIC_PII_RAW_EMAIL.split('@')[1]).toMatch(/\.example$/);
    expect(SYNTHETIC_PII_RAW_PHONE).toMatch(/555-01[0-9]{2}/);
  });

  it('normalizing the synthetic PII lead yields a PII-safe prospect (sanity)', () => {
    const prospect = normalizeGtmProspect(SYNTHETIC_PII_LEAD as RawGtmProspectInput, {
      id: '00000000-0000-4000-8000-000000000000',
      now: fixedClock()(),
    });
    expect(JSON.stringify(prospect)).not.toContain(SYNTHETIC_PII_RAW_EMAIL);
    expect(JSON.stringify(prospect)).not.toContain(SYNTHETIC_PII_PHONE_DIGITS);
    // Masked/hashed derivatives are allowed to exist.
    expect(prospect.contactEmailMasked).toBeTruthy();
  });
});
