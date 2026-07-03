import { describe, expect, it } from 'vitest';
import { buildProofReceipt, renderProofReceiptMarkdown } from './proofReceipt.js';
import type { ProofReceiptInput } from './proofReceipt.js';
import { fixedClock, sequentialIds } from './testSupport.test.js';
import { blockedReason } from './types.js';

const allowedInput = (): ProofReceiptInput => ({
  runId: 'run-0001',
  templateId: 'budget_wheels_lead_to_close.v1',
  leadId: 'bw-fake-lead-0001',
  scenarioId: 'bw_happy_path_mock_only',
  vertical: 'budget_wheels_dealeros',
  dataMode: 'fake_fixture',
  policyDecision: 'allowed_mock_only',
  finalState: 'proof_receipt_generated',
  consentState: 'granted',
  sourceRightsState: 'verified_fixture',
  approval: {
    approvalId: 'appr-0001',
    leadId: 'bw-fake-lead-0001',
    decision: 'approved',
    approvedBy: 'operator_fixture_01',
    note: null,
    issuedAt: '2026-07-03T10:00:00.000Z',
    token: 'token',
  },
  writebackIntent: {
    intentId: 'int-0001',
    connectorId: 'crm_mock',
    leadId: 'bw-fake-lead-0001',
    vertical: 'budget_wheels_dealeros',
    approvalId: 'appr-0001',
    target: 'mock CRM lead record + mock appointment desk intent',
    payloadSummary: {},
    recordedAt: '2026-07-03T10:00:05.000Z',
    mockOnly: true,
    egressPerformed: false,
  },
  blockedReason: null,
  blockedAtState: null,
  ledgerEventIds: ['led-0001', 'led-0002'],
});

describe('proof receipt', () => {
  it('captures lead, policy decision, consent, approval, and adapter event', () => {
    const receipt = buildProofReceipt(allowedInput(), {
      clock: fixedClock(),
      idFactory: sequentialIds('rcpt'),
    });
    expect(receipt.receiptId).toBe('rcpt-0001');
    expect(receipt.policyDecision).toBe('allowed_mock_only');
    expect(receipt.consentState).toBe('granted');
    expect(receipt.sourceRightsState).toBe('verified_fixture');
    expect(receipt.approval?.approvalId).toBe('appr-0001');
    expect(receipt.adapterEvent?.connectorId).toBe('crm_mock');
    expect(receipt.blockedReason).toBeNull();
    expect(receipt.evidenceLabel).toBe('IMPLEMENTED_LOCAL_MOCK');
    expect(receipt.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('captures the exact blocked reason on blocked runs', () => {
    const receipt = buildProofReceipt(
      {
        ...allowedInput(),
        policyDecision: 'blocked',
        finalState: 'source_rights_checked',
        approval: null,
        writebackIntent: null,
        blockedReason: blockedReason('CONSENT_MISSING'),
        blockedAtState: 'source_rights_checked',
      },
      { clock: fixedClock(), idFactory: sequentialIds('rcpt') },
    );
    expect(receipt.policyDecision).toBe('blocked');
    expect(receipt.blockedReason?.code).toBe('CONSENT_MISSING');
    expect(receipt.blockedAtState).toBe('source_rights_checked');
    expect(receipt.approval).toBeNull();
    expect(receipt.adapterEvent).toBeNull();
  });

  it('is deterministic under an injected clock/id factory', () => {
    const a = buildProofReceipt(allowedInput(), {
      clock: fixedClock(),
      idFactory: sequentialIds('rcpt'),
    });
    const b = buildProofReceipt(allowedInput(), {
      clock: fixedClock(),
      idFactory: sequentialIds('rcpt'),
    });
    expect(a).toEqual(b);
  });

  it('renders a human-readable markdown explanation for allowed runs', () => {
    const receipt = buildProofReceipt(allowedInput(), {
      clock: fixedClock(),
      idFactory: sequentialIds('rcpt'),
    });
    const markdown = renderProofReceiptMarkdown(receipt);
    expect(markdown).toContain('# Proof Receipt rcpt-0001');
    expect(markdown).toContain('**allowed_mock_only**');
    expect(markdown).toContain('MOCK-ONLY intent');
    expect(markdown).toContain('No live provider, CRM, outreach, or deploy action was taken.');
  });

  it('renders the blocked reason for blocked runs', () => {
    const receipt = buildProofReceipt(
      {
        ...allowedInput(),
        policyDecision: 'blocked',
        approval: null,
        writebackIntent: null,
        blockedReason: blockedReason('HUMAN_APPROVAL_MISSING'),
        blockedAtState: 'human_approval_required',
      },
      { clock: fixedClock(), idFactory: sequentialIds('rcpt') },
    );
    const markdown = renderProofReceiptMarkdown(receipt);
    expect(markdown).toContain('[HUMAN_APPROVAL_MISSING]');
    expect(markdown).toContain('human_approval_required');
    expect(markdown).toContain('Human approval: none recorded');
  });
});
