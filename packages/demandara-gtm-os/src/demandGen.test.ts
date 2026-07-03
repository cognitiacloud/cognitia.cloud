import { describe, expect, it } from 'vitest';
import {
  AGENT_ECONOMY_FORBIDDEN_FEATURES,
  AGENT_ECONOMY_PAYMENTS_IMPLEMENTED,
  agentPassportSchema,
  agentWorkEventSchema,
} from './agentEconomy.js';
import {
  checkClaimSafety,
  contentBriefSchema,
  demandOpportunitySchema,
  MonthlyProofReportAccumulator,
} from './demandGen.js';
import { blockedReason } from './types.js';

describe('demand gen skeleton', () => {
  it('validates an SEO/AEO/AIO opportunity object', () => {
    const opportunity = demandOpportunitySchema.parse({
      opportunityId: 'opp-0001',
      channel: 'aeo',
      vertical: 'budget_wheels_dealeros',
      topic: 'used car dealer missed leads',
      painCategory: 'missed_leads',
      searchIntent: 'how do dealers stop losing marketplace leads',
      priorityScore: 0.8,
    });
    expect(opportunity.channel).toBe('aeo');
  });

  it('marks a brief claim-safe only when claims are evidence-backed and clean', () => {
    const brief = contentBriefSchema.parse({
      briefId: 'brief-0001',
      opportunityId: 'opp-0001',
      headline: 'How proof receipts expose dropped dealer leads',
      claims: [
        {
          text: 'Every workflow run generates a proof receipt in local mock tests.',
          evidenceLabel: 'TESTED_LOCAL',
          evidenceRef: 'packages/demandara-gtm-os/src/workflowEngine.test.ts',
        },
      ],
    });
    expect(checkClaimSafety(brief)).toEqual({ claimSafe: true, violations: [] });
  });

  it('rejects forbidden claim language', () => {
    const brief = contentBriefSchema.parse({
      briefId: 'brief-0002',
      opportunityId: 'opp-0001',
      headline: 'x',
      claims: [
        {
          text: 'Demandara is better than Alta and production-ready.',
          evidenceLabel: 'DESIGN_ONLY',
        },
      ],
    });
    const result = checkClaimSafety(brief);
    expect(result.claimSafe).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects evidence-backed claims that lack an evidenceRef', () => {
    const brief = contentBriefSchema.parse({
      briefId: 'brief-0003',
      opportunityId: 'opp-0001',
      headline: 'x',
      claims: [{ text: 'The consent gate blocks missing consent.', evidenceLabel: 'TESTED_LOCAL' }],
    });
    const result = checkClaimSafety(brief);
    expect(result.claimSafe).toBe(false);
    expect(result.violations[0]?.problem).toContain('evidenceRef');
  });

  it('accumulates outcome-first monthly report metrics', () => {
    const accumulator = new MonthlyProofReportAccumulator();
    accumulator.record({
      runId: 'run-1',
      leadId: 'bw-fake-lead-0001',
      vertical: 'budget_wheels_dealeros',
      policyDecision: 'allowed_mock_only',
      blockedReason: null,
      proofReceiptId: 'rcpt-1',
      qualified: true,
      approvalDecision: 'approved',
    });
    accumulator.record({
      runId: 'run-2',
      leadId: 'bw-fake-lead-0002',
      vertical: 'budget_wheels_dealeros',
      policyDecision: 'blocked',
      blockedReason: blockedReason('CONSENT_MISSING'),
      proofReceiptId: 'rcpt-2',
      qualified: null,
      approvalDecision: null,
    });
    const snapshot = accumulator.snapshot();
    expect(snapshot.totalRuns).toBe(2);
    expect(snapshot.allowedMockOnly).toBe(1);
    expect(snapshot.blocked).toBe(1);
    expect(snapshot.blockedByReason['CONSENT_MISSING']).toBe(1);
    expect(snapshot.qualifiedLeadProgression).toBe(1);
    expect(snapshot.humanApprovedNextSteps).toBe(1);
    expect(snapshot.blockedUnsafeActionCount).toBe(1);
    expect(snapshot.proofReceiptIds).toEqual(['rcpt-1', 'rcpt-2']);
  });
});

describe('agent economy compatibility layer (types only)', () => {
  it('exposes the forbidden-feature boundary and implements no payments', () => {
    expect(AGENT_ECONOMY_PAYMENTS_IMPLEMENTED).toBe(false);
    expect(AGENT_ECONOMY_FORBIDDEN_FEATURES).toContain('public_token_launch');
    expect(AGENT_ECONOMY_FORBIDDEN_FEATURES).toContain('live_payment_integration');
    expect(AGENT_ECONOMY_FORBIDDEN_FEATURES).toContain('crypto_or_wallet_integration');
  });

  it('validates ATC-style agent identities and work events as local schemas', () => {
    const passport = agentPassportSchema.parse({
      agentId: 'agent-demandara-qualifier',
      role: 'qualification',
      allowedScopes: ['qualify_fixture_leads'],
      deniedScopes: ['outreach', 'live_crm_write'],
    });
    expect(passport.modelToolRoute).toBe('mock');
    const workEvent = agentWorkEventSchema.parse({
      workEventId: 'work-0001',
      agentId: passport.agentId,
      kind: 'lead_qualified',
      occurredAt: '2026-07-03T10:00:00.000Z',
      evidenceLabel: 'IMPLEMENTED_LOCAL_MOCK',
    });
    expect(workEvent.kind).toBe('lead_qualified');
  });
});
