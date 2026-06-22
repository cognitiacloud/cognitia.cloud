import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RawGtmProspectInput } from '@cognitia/core';
import { createSalesCloserWorkflow } from './salesCloserWorkflow.js';
import { createMockCloserPorts, type MockPortOverrides } from './mockPorts.js';
import { FIXTURE_LEAD } from './__fixtures__/lead.fixture.js';
import {
  PROOF_RECEIPT_VERSION,
  buildProofReceipt,
  renderProofReport,
  verifyProofReceipt,
} from './proofReceipt.js';

const FIXED_ID = '11111111-1111-1111-1111-111111111111';
const FIXED_NOW = new Date('2026-06-21T00:00:00.000Z');
const FIXED_GENERATED_AT = new Date('2026-06-21T01:02:03.000Z');
const RECEIPT_OPTS = { runId: 'closer-run-fixed', generatedAt: FIXED_GENERATED_AT };

function workflow(overrides: MockPortOverrides = {}) {
  let counter = 0;
  return createSalesCloserWorkflow({
    ports: createMockCloserPorts(overrides),
    now: () => FIXED_NOW,
    newId: () => `${FIXED_ID.slice(0, -1)}${counter++}`,
  });
}

async function receiptFor(
  overrides: MockPortOverrides = {},
  lead: RawGtmProspectInput = FIXTURE_LEAD,
) {
  const run = await workflow(overrides).run(lead);
  return buildProofReceipt(run, RECEIPT_OPTS);
}

describe('buildProofReceipt — approved/completed path', () => {
  it('summarizes a completed run with every major transition emitted', async () => {
    const receipt = await receiptFor();

    expect(receipt.version).toBe(PROOF_RECEIPT_VERSION);
    expect(receipt.status).toBe('completed');
    expect(receipt.finalState).toBe('completed');
    expect(receipt.blockedReason).toBeNull();
    expect(receipt.complianceState).toBe('pass');
    expect(receipt.approvalState).toBe('approved');
    expect(receipt.appointmentState).toBe('requested');
    expect(receipt.writebackState).toBe('written');
    // one receipt entry per workflow transition (init→…→completed = 6).
    expect(receipt.transitions.map((entry) => entry.to)).toEqual([
      'compliance_check_required',
      'human_approval_required',
      'appointment_requested',
      'crm_writeback_requested',
      'proof_report_requested',
      'completed',
    ]);
    expect(receipt.transitions[0]?.label).toMatch(/Lead intake/);
    // evidence references the two canonical proof events.
    expect(receipt.evidence.map((item) => item.kind)).toEqual([
      'gtm.discovery.booked.v1',
      'gtm.proposal.generated.v1',
    ]);
    expect(receipt.startedAt).toBe(FIXED_NOW.toISOString());
    expect(receipt.completedAt).toBe(FIXED_NOW.toISOString());
    expect(receipt.generatedAt).toBe(FIXED_GENERATED_AT.toISOString());
    expect(verifyProofReceipt(receipt)).toBe(true);
  });

  it('renders a human-readable report with the outcomes and hash', async () => {
    const receipt = await receiptFor();
    const report = renderProofReport(receipt);

    expect(report).toContain('Sales Closer — Proof Receipt');
    expect(report).toContain('Status:     completed');
    expect(report).toContain('Approval:');
    expect(report).toContain('Mock CRM writeback — written');
    expect(report).toContain(`receiptHash: ${receipt.receiptHash}`);
  });
});

describe('buildProofReceipt — rejected approval path', () => {
  it('records a rejected approval and no evidence', async () => {
    const receipt = await receiptFor({ approval: { status: 'rejected', reason: 'not a fit' } });

    expect(receipt.status).toBe('blocked');
    expect(receipt.finalState).toBe('blocked_approval');
    expect(receipt.approvalState).toBe('rejected');
    expect(receipt.appointmentState).toBe('not_reached');
    expect(receipt.writebackState).toBe('not_reached');
    expect(receipt.blockedReason).toBe('not a fit');
    expect(receipt.evidence).toEqual([]);
    expect(verifyProofReceipt(receipt)).toBe(true);
  });
});

describe('buildProofReceipt — blocked paths', () => {
  it('records a compliance block (doctrine: do-not-contact) before any boundary', async () => {
    const receipt = await receiptFor({}, { ...FIXTURE_LEAD, doNotContact: true });

    expect(receipt.status).toBe('blocked');
    expect(receipt.finalState).toBe('blocked_compliance');
    expect(receipt.complianceState).toBe('blocked');
    expect(receipt.approvalState).toBe('not_reached');
    expect(receipt.blockedReason).toMatch(/not contactable/);
    expect(receipt.evidence).toEqual([]);
    expect(verifyProofReceipt(receipt)).toBe(true);
  });

  it('records a failed mock CRM writeback with the appointment evidence only', async () => {
    const receipt = await receiptFor({ crm: { status: 'failed', reason: 'crm down' } });

    expect(receipt.status).toBe('blocked');
    expect(receipt.finalState).toBe('blocked_crm');
    expect(receipt.appointmentState).toBe('requested');
    expect(receipt.writebackState).toBe('failed');
    expect(receipt.blockedReason).toBe('crm down');
    expect(receipt.evidence.map((item) => item.kind)).toEqual(['gtm.discovery.booked.v1']);
    expect(verifyProofReceipt(receipt)).toBe(true);
  });
});

describe('proof receipts carry no raw PII', () => {
  it('drops raw contact email/phone from the receipt and report', async () => {
    const rawEmail = 'gm-secret@northshore-auto.example';
    const rawPhone = '+1-604-555-0142';
    const receipt = await receiptFor(
      {},
      {
        ...FIXTURE_LEAD,
        contactName: 'Jane Privacy',
        contactEmail: rawEmail,
        contactPhone: rawPhone,
      },
    );

    const serialized = JSON.stringify(receipt);
    const report = renderProofReport(receipt);
    for (const blob of [serialized, report]) {
      expect(blob).not.toContain(rawEmail);
      expect(blob).not.toContain('gm-secret');
      expect(blob).not.toContain(rawPhone);
      expect(blob).not.toContain('Jane Privacy');
      expect(blob).not.toMatch(/@/);
    }
  });

  it('hashes private proof details instead of copying them', async () => {
    const receipt = await receiptFor();
    const serialized = JSON.stringify(receipt);

    // raw private payloads (e.g. appointmentRef/crmRecordRef) are not copied.
    expect(serialized).not.toContain('detailsPrivate');
    expect(serialized).not.toContain('appointmentRef');
    expect(serialized).not.toContain('crmRecordRef');
    for (const item of receipt.evidence) {
      expect(item.detailsHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('tamper-evidence', () => {
  it('verifies a freshly built receipt', async () => {
    const receipt = await receiptFor();
    expect(verifyProofReceipt(receipt)).toBe(true);
  });

  it('fails verification when a top-level field is altered', async () => {
    const receipt = await receiptFor();
    // flip a blocked-looking status onto a completed run.
    const tampered = { ...receipt, status: 'blocked' as const, blockedReason: 'forged' };
    expect(verifyProofReceipt(tampered)).toBe(false);
  });

  it('fails verification when a transition entry is altered', async () => {
    const receipt = await receiptFor();
    const tampered = structuredClone(receipt);
    tampered.transitions[1]!.to = 'appointment_requested';
    expect(verifyProofReceipt(tampered)).toBe(false);
  });

  it('fails verification when evidence is altered', async () => {
    const receipt = await receiptFor();
    const tampered = structuredClone(receipt);
    tampered.evidence[0]!.summaryPublic = 'tampered summary';
    expect(verifyProofReceipt(tampered)).toBe(false);
  });
});

describe('determinism', () => {
  it('builds an identical receipt for the same run + options', async () => {
    const a = await receiptFor();
    const b = await receiptFor();
    expect(a).toEqual(b);
  });
});

describe('no live egress', () => {
  it('the proof-receipt source makes no network/DB/vendor calls', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, 'proofReceipt.ts'), 'utf8');
    const banned =
      /\b(fetch|child_process|node:net|node:http|node:https|ApifyClient|new\s+Anthropic)\b/;
    expect(banned.test(src), 'proofReceipt.ts must make no network/vendor calls').toBe(false);
    expect(src.includes('@cognitia/db')).toBe(false);
    expect(src.includes('@cognitia/integrations')).toBe(false);
  });
});
