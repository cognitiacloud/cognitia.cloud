import { describe, it, expect } from 'vitest';
import { agentCanSendOutreach } from './compliance.js';
import { DEMO_PROSPECTS, DEMO_PROSPECTS_BY_ID } from './complianceFixtures.js';
import {
  applyOperatorDecision,
  buildOperatorWorkflowView,
  canApprove,
  canReject,
  OperatorDecisionError,
  summarizeCompliance,
} from './operatorConsole.js';

const rec = (id: string) => {
  const record = DEMO_PROSPECTS_BY_ID[id];
  if (!record) throw new Error(`missing fixture ${id}`);
  return record;
};

const CLEAN = 'prospect:northshore-auto'; // contactable → human_review_required
const UNSUBSCRIBED = 'prospect:fraser-motors'; // suppressed → blocked
const DNC = 'prospect:peak-auto'; // do-not-contact → blocked
const HIGH_RISK = 'prospect:metro-imports'; // high-risk source → human review

describe('summarizeCompliance', () => {
  it('blocks suppressed prospects with reasons', () => {
    const unsub = summarizeCompliance(rec(UNSUBSCRIBED));
    expect(unsub.state).toBe('blocked');
    expect(unsub.blockedReasons.length).toBeGreaterThan(0);

    const dnc = summarizeCompliance(rec(DNC));
    expect(dnc.state).toBe('blocked');
    expect(dnc.blockedReasons.join(' ')).toMatch(/do-not-contact/i);
  });

  it('routes a contactable prospect to human review (never auto-allowed)', () => {
    const clean = summarizeCompliance(rec(CLEAN));
    expect(clean.state).toBe('human_review_required');
    expect(clean.blockedReasons).toHaveLength(0);
    // No outreach channel is ever auto-allowed.
    expect(clean.channels.every((c) => c.decision !== 'allowed')).toBe(true);
  });

  it('keeps SMS / WhatsApp / AI voice gated off for every demo prospect', () => {
    for (const record of DEMO_PROSPECTS) {
      const { channels } = summarizeCompliance(record);
      for (const gated of ['sms', 'whatsapp', 'ai_voice'] as const) {
        const ch = channels.find((c) => c.channel === gated);
        expect(ch?.decision).toBe('blocked');
      }
    }
  });
});

describe('buildOperatorWorkflowView', () => {
  it('projects PII-safe lead detail (no raw contact fields) and a mock CRM/appointment', () => {
    const view = buildOperatorWorkflowView(rec(CLEAN));
    expect(view.lead.companyName).toBe('North Shore Auto Group');
    // Only masked/domain contact data is exposed.
    expect(view.lead.contactEmailMasked).toContain('***');
    expect(view).not.toHaveProperty('contactEmail');
    expect(view.crm.written).toBe(false);
    expect(view.proofReport.state).toBe('pending');
    expect(view.proofReport.log.length).toBeGreaterThan(0);
  });

  it('seeds a blocked workflow with a human_review_required proof event', () => {
    const view = buildOperatorWorkflowView(rec(DNC));
    expect(view.complianceState).toBe('blocked');
    expect(view.proofReport.log.some((e) => e.type === 'human_review_required')).toBe(true);
  });
});

describe('approve / reject gating', () => {
  it('allows approving a contactable, undecided workflow', () => {
    expect(canApprove(buildOperatorWorkflowView(rec(CLEAN))).allowed).toBe(true);
    expect(canApprove(buildOperatorWorkflowView(rec(HIGH_RISK))).allowed).toBe(true);
  });

  it('refuses to approve a blocked workflow', () => {
    const view = buildOperatorWorkflowView(rec(UNSUBSCRIBED));
    expect(canApprove(view).allowed).toBe(false);
    expect(() => applyOperatorDecision(view, 'approve', 'op@example.test')).toThrow(
      OperatorDecisionError,
    );
  });

  it('records an approval with a proof event and does not mutate the input', () => {
    const view = buildOperatorWorkflowView(rec(CLEAN));
    const before = view.proofReport.log.length;
    const after = applyOperatorDecision(
      view,
      'approve',
      'op@example.test',
      'looks good',
      '2026-06-21T10:00:00.000Z',
    );

    expect(after.decision).toBe('approved');
    expect(after.decidedBy).toBe('op@example.test');
    expect(after.proofReport.state).toBe('generated');
    expect(after.proofReport.log.length).toBe(before + 1);
    expect(after.proofReport.log.at(-1)?.summary.toLowerCase()).toContain('no outreach sent');
    // input untouched
    expect(view.decision).toBe('pending');
  });

  it('records a rejection with a note', () => {
    const view = buildOperatorWorkflowView(rec(CLEAN));
    const after = applyOperatorDecision(view, 'reject', 'op@example.test', 'not a fit');
    expect(after.decision).toBe('rejected');
    expect(after.decisionNote).toBe('not a fit');
    expect(canReject(after).allowed).toBe(false);
  });
});

describe('mock-safe guardrails', () => {
  it('approval never enables autonomous sending (human gate still required)', () => {
    const view = buildOperatorWorkflowView(rec(CLEAN));
    const approved = applyOperatorDecision(view, 'approve', 'op@example.test');
    // Even after operator approval, outreach requires an explicit approved send gate.
    expect(agentCanSendOutreach({ requiresHumanApproval: true, approvalStatus: 'proposed' })).toBe(
      false,
    );
    // CRM is never written by the console.
    expect(approved.crm.written).toBe(false);
  });
});
