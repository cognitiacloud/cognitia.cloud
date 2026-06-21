import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SALES_CLOSER_REQUIRES_HUMAN_APPROVAL,
  createSalesCloserWorkflow,
  evaluateComplianceDoctrine,
  isTerminalState,
  stepAppointment,
  stepApproval,
  stepCompliance,
  stepCrmWriteback,
  stepProofReport,
  type SalesCloserState,
} from './salesCloserWorkflow.js';
import { createMockCloserPorts } from './mockPorts.js';
import { FIXTURE_LEAD } from './__fixtures__/lead.fixture.js';
import { normalizeGtmProspect } from '@cognitia/core';

const FIXED_ID = '11111111-1111-1111-1111-111111111111';
const FIXED_NOW = new Date('2026-06-21T00:00:00.000Z');

function workflow(overrides = {}) {
  let counter = 0;
  return createSalesCloserWorkflow({
    ports: createMockCloserPorts(overrides),
    now: () => FIXED_NOW,
    newId: () => `${FIXED_ID.slice(0, -1)}${counter++}`,
  });
}

/** The exact `to` sequence the happy path must visit. */
const HAPPY_PATH: SalesCloserState[] = [
  'compliance_check_required',
  'human_approval_required',
  'appointment_requested',
  'crm_writeback_requested',
  'proof_report_requested',
  'completed',
];

describe('SalesCloserWorkflow — happy path', () => {
  it('walks lead → compliance → approval → appointment → crm → proof → completed', async () => {
    const run = await workflow().run(FIXTURE_LEAD);

    expect(run.status).toBe('completed');
    expect(run.state).toBe('completed');
    expect(run.transitions.map((t) => t.to)).toEqual(HAPPY_PATH);
    expect(run.transitions[0]?.from).toBe('lead_received');
  });

  it('records append-only proof events with no contact PII in public summaries', async () => {
    const run = await workflow().run(FIXTURE_LEAD);

    expect(run.proofs.map((p) => p.kind)).toEqual([
      'gtm.discovery.booked.v1',
      'gtm.proposal.generated.v1',
    ]);
    for (const proof of run.proofs) {
      expect(proof.subjectType).toBe('gtm_prospect');
      expect(proof.summaryPublic).not.toMatch(/@/);
    }
  });

  it('normalizes the lead to a PII-safe prospect (no raw contact fields)', async () => {
    const run = await workflow().run(FIXTURE_LEAD);
    const serialized = JSON.stringify(run.prospect);

    expect('contactEmail' in run.prospect).toBe(false);
    expect('contactPhone' in run.prospect).toBe(false);
    expect(serialized).not.toMatch(/@/);
    expect(run.prospect.companyName).toBe('Northshore Auto Group');
  });

  it('runs deterministically offline (no network/DB ports)', async () => {
    const a = await workflow().run(FIXTURE_LEAD);
    const b = await workflow().run(FIXTURE_LEAD);
    expect(a.transitions).toEqual(b.transitions);
    expect(a.proofs).toEqual(b.proofs);
  });
});

describe('SalesCloserWorkflow — blocked & paused states', () => {
  it('blocks at compliance when the boundary blocks', async () => {
    const run = await workflow({ compliance: { status: 'blocked', reason: 'legal review' } }).run(
      FIXTURE_LEAD,
    );
    expect(run.status).toBe('blocked');
    expect(run.state).toBe('blocked_compliance');
    expect(run.blockedReason).toBe('legal review');
    expect(run.proofs).toEqual([]);
  });

  it('blocks at compliance by doctrine before any boundary call (do-not-contact lead)', async () => {
    const run = await workflow().run({ ...FIXTURE_LEAD, doNotContact: true });
    expect(run.state).toBe('blocked_compliance');
    expect(run.blockedReason).toMatch(/not contactable/);
  });

  it('blocks at approval when rejected', async () => {
    const run = await workflow({ approval: { status: 'rejected', reason: 'not a fit' } }).run(
      FIXTURE_LEAD,
    );
    expect(run.status).toBe('blocked');
    expect(run.state).toBe('blocked_approval');
    expect(run.proofs).toEqual([]);
  });

  it('pauses (does not auto-advance) when approval is pending', async () => {
    const run = await workflow({ approval: { status: 'pending' } }).run(FIXTURE_LEAD);
    expect(run.status).toBe('awaiting_approval');
    expect(run.state).toBe('human_approval_required');
    expect(run.proofs).toEqual([]);
  });

  it('blocks at appointment when the boundary fails', async () => {
    const run = await workflow({ appointment: { status: 'failed', reason: 'no slots' } }).run(
      FIXTURE_LEAD,
    );
    expect(run.state).toBe('blocked_appointment');
    // no downstream proof recorded
    expect(run.proofs).toEqual([]);
  });

  it('blocks at CRM writeback when the boundary fails', async () => {
    const run = await workflow({ crm: { status: 'failed', reason: 'crm down' } }).run(FIXTURE_LEAD);
    expect(run.state).toBe('blocked_crm');
    // appointment proof was collected, but the run halts before proof recording
    expect(run.proofs.map((p) => p.kind)).toEqual(['gtm.discovery.booked.v1']);
  });

  it('blocks at proof report when recording fails', async () => {
    const run = await workflow({ proof: { status: 'failed', reason: 'ledger error' } }).run(
      FIXTURE_LEAD,
    );
    expect(run.state).toBe('blocked_proof');
    expect(run.status).toBe('blocked');
  });
});

describe('pure transition functions', () => {
  it('stepCompliance maps pass → approval, blocked → blocked_compliance', () => {
    expect(stepCompliance({ status: 'pass' })).toBe('human_approval_required');
    expect(stepCompliance({ status: 'blocked' })).toBe('blocked_compliance');
  });

  it('stepApproval maps approved/rejected/pending explicitly', () => {
    expect(stepApproval({ status: 'approved' })).toBe('appointment_requested');
    expect(stepApproval({ status: 'rejected' })).toBe('blocked_approval');
    expect(stepApproval({ status: 'pending' })).toBe('human_approval_required');
  });

  it('stepAppointment maps requested → crm, failed → blocked_appointment', () => {
    expect(stepAppointment({ status: 'requested' })).toBe('crm_writeback_requested');
    expect(stepAppointment({ status: 'failed' })).toBe('blocked_appointment');
  });

  it('stepCrmWriteback maps ok → proof, failed → blocked_crm', () => {
    expect(stepCrmWriteback({ status: 'ok' })).toBe('proof_report_requested');
    expect(stepCrmWriteback({ status: 'failed' })).toBe('blocked_crm');
  });

  it('stepProofReport maps ok → completed, failed → blocked_proof', () => {
    expect(stepProofReport({ status: 'ok' })).toBe('completed');
    expect(stepProofReport({ status: 'failed' })).toBe('blocked_proof');
  });

  it('evaluateComplianceDoctrine blocks non-contactable prospects', () => {
    const ok = normalizeGtmProspect(FIXTURE_LEAD, { id: FIXED_ID, now: FIXED_NOW });
    expect(evaluateComplianceDoctrine(ok).status).toBe('pass');
    const dnc = normalizeGtmProspect(
      { ...FIXTURE_LEAD, consentStatus: 'do_not_contact' },
      { id: FIXED_ID, now: FIXED_NOW },
    );
    expect(evaluateComplianceDoctrine(dnc).status).toBe('blocked');
  });

  it('isTerminalState recognizes completed and every blocked_* state', () => {
    expect(isTerminalState('completed')).toBe(true);
    expect(isTerminalState('blocked_crm')).toBe(true);
    expect(isTerminalState('human_approval_required')).toBe(false);
    expect(isTerminalState('lead_received')).toBe(false);
  });
});

describe('doctrine invariants', () => {
  it('always requires a human approval gate (no autonomous path)', () => {
    expect(SALES_CLOSER_REQUIRES_HUMAN_APPROVAL).toBe(true);
  });

  it('production sources import no network/DB primitives', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const production = ['ports.ts', 'salesCloserWorkflow.ts', 'mockPorts.ts', 'index.ts'];
    const banned = /\b(fetch|child_process|node:net|node:http|ApifyClient|new\s+Anthropic)\b/;
    for (const file of production) {
      const src = readFileSync(join(here, file), 'utf8');
      expect(banned.test(src), `${file} must make no network/vendor calls`).toBe(false);
      expect(src.includes('@cognitia/db')).toBe(false);
      expect(src.includes('@cognitia/integrations')).toBe(false);
    }
  });
});
