/**
 * Tests for the pure presentation + parity surface of the GTM Command Center
 * view-model. The lane computation is NOT here (it lives in `@cognitia/agents`
 * and is exercised via the server adapter test); this covers the constants, the
 * PII guard, the `canProceed` predicate, and `computeParityScorecard` as an
 * objective derivation over an assembled view.
 */

import { describe, it, expect } from 'vitest';
import {
  ALTA_PARITY_THRESHOLD,
  COMMAND_CENTER_BANNER,
  SANDBOX_WORKSPACE,
  assertNoRawPii,
  canProceed,
  computeParityScorecard,
  findRawPii,
  type CommandCenterView,
} from './gtmCommandCenterViewModel';
import type { GtmRunPacketView } from './gtmOsAssemblyViewModel';

describe('constants', () => {
  it('banner is mock/dry-run and tenant is the sandbox', () => {
    expect(COMMAND_CENTER_BANNER).toContain('NO LIVE SEND');
    expect(COMMAND_CENTER_BANNER).toContain('NO PII');
    expect(SANDBOX_WORKSPACE).toBe('budget_wheels_demo');
    expect(ALTA_PARITY_THRESHOLD).toBe(80);
  });
});

describe('PII guard', () => {
  it('allows reserved placeholders, flags real-looking PII', () => {
    expect(findRawPii('contact lead@buyer.example or 555-0123')).toBeNull();
    expect(findRawPii('reach me at someone@gmail.com')).toBe('someone@gmail.com');
    expect(() => assertNoRawPii('all clear: ref@demo.example')).not.toThrow();
    expect(() => assertNoRawPii('attacker@evil.com')).toThrow(/raw PII/);
  });
});

describe('canProceed', () => {
  const base: GtmRunPacketView = {
    mode: 'mock',
    workspace: { workspaceId: SANDBOX_WORKSPACE, sandbox: true },
    prospect: {
      id: 'p-1',
      companyName: 'Demo Co',
      sourceRisk: 'low',
      consentStatus: 'implied_possible',
      fitScore: 0.5,
    },
    status: 'completed',
    finalState: 'completed',
    compliance: { passed: true, blocked: false },
    approval: { status: 'approved' },
    appointment: { requested: true },
    crm: { written: true },
    proofs: [],
    timeline: [],
    noEgress: { liveSendOccurred: false, statement: 'mock' },
  };

  it('requires compliance clear AND human approval', () => {
    expect(canProceed(base)).toBe(true);
    expect(canProceed({ ...base, approval: { status: 'pending' } })).toBe(false);
    expect(canProceed({ ...base, compliance: { passed: false, blocked: true } })).toBe(false);
  });
});

describe('computeParityScorecard', () => {
  /** A minimal but complete assembled view where every parity check holds. */
  function passingView(): Omit<CommandCenterView, 'parity'> {
    const completedPacket: GtmRunPacketView = {
      mode: 'mock',
      workspace: { workspaceId: SANDBOX_WORKSPACE, sandbox: true },
      prospect: {
        id: 'p-1',
        companyName: 'Demo Co',
        sourceRisk: 'low',
        consentStatus: 'implied_possible',
        fitScore: 0.9,
      },
      status: 'completed',
      finalState: 'completed',
      compliance: { passed: true, blocked: false },
      approval: { status: 'approved' },
      appointment: { requested: true },
      crm: { written: true },
      proofs: [{ kind: 'gtm.discovery.booked.v1', summaryPublic: 'booked' }],
      timeline: [
        { step: 1, phase: 'Lead received', outcome: 'advanced' },
        { step: 2, phase: 'Compliance', outcome: 'advanced' },
        { step: 3, phase: 'Approval', outcome: 'advanced' },
        { step: 4, phase: 'Appointment', outcome: 'advanced' },
      ],
      noEgress: { liveSendOccurred: false, statement: 'mock' },
    };
    const blockedPacket: GtmRunPacketView = {
      ...completedPacket,
      prospect: { ...completedPacket.prospect, id: 'p-9', companyName: 'DNC Motors' },
      status: 'blocked',
      finalState: 'blocked_compliance',
      compliance: { passed: false, blocked: true, reason: 'do_not_contact' },
      approval: { status: 'pending' },
      appointment: { requested: false },
      crm: { written: false },
      proofs: [],
    };

    return {
      banner: COMMAND_CENTER_BANNER,
      workspaceId: SANDBOX_WORKSPACE,
      sandbox: true,
      leads: [
        {
          lead: { id: 'p-1', companyName: 'Demo Co', packet: completedPacket },
          console: {
            workspaceId: SANDBOX_WORKSPACE,
            sandbox: true,
            company: 'Demo Co',
            badge: { label: 'Completed', tone: 'success' },
            blockedReason: null,
            complianceLabel: 'Cleared',
            approvalLabel: 'Approved by human',
            proofCount: 1,
            timeline: completedPacket.timeline.map((t) => ({ ...t, detail: null })),
            mockSafe: true,
            egressStatement: 'mock',
          },
          channelPlan: [
            {
              mode: 'dry_run',
              sent: false,
              channel: 'email',
              workspaceId: SANDBOX_WORKSPACE,
              prospectId: 'p-1',
              planRef: 'dryrun:email:budget_wheels_demo:p-1',
              wouldSendIfLive: {
                channel: 'email',
                target: 'lead@buyer.example',
                summary: 'preview',
                liveStatus: 'BLOCKED',
              },
            },
          ],
        },
        {
          lead: { id: 'p-9', companyName: 'DNC Motors', packet: blockedPacket },
          console: {
            workspaceId: SANDBOX_WORKSPACE,
            sandbox: true,
            company: 'DNC Motors',
            badge: { label: 'Blocked', tone: 'danger' },
            blockedReason: 'do_not_contact',
            complianceLabel: 'Blocked — do_not_contact',
            approvalLabel: 'Pending human review',
            proofCount: 0,
            timeline: [],
            mockSafe: true,
            egressStatement: 'mock',
          },
          channelPlan: [],
        },
      ],
      audience: {
        ranked: [
          {
            id: 'p-1',
            companyName: 'Demo Co',
            source: 'consented_csv',
            region: 'ON',
            contactEmailExample: null,
            contactPhoneExample: null,
            consentRisk: 'low',
            sourceRisk: 'low',
            evidence: 'verified_fact',
            evidenceTags: ['source:consented_csv'],
            score: {
              score: 0.8,
              breakdown: {
                fit: 0.36,
                urgency: 0.175,
                proofConfidence: 0.15,
                consentRiskPenalty: -0,
                sourceRiskPenalty: -0,
              },
              components: {
                fit: 0.9,
                urgency: 0.7,
                proofConfidence: 1,
                consentRisk: 0,
                sourceRisk: 0,
              },
            },
            notes: null,
          },
        ],
        rejected: [{ id: 'p-bad', source: 'apify', reason: 'disallowed_source' }],
      },
      crm: {
        records: [
          {
            id: 'crm_1',
            workspaceId: SANDBOX_WORKSPACE,
            prospectId: 'p-1',
            companyId: 'co_1',
            stage: 'proposal',
            appointmentRef: 'appt-1',
            crmRecordRef: null,
            createdAt: '2026-06-22T10:00:00.000Z',
            updatedAt: '2026-06-22T10:00:00.000Z',
          },
        ],
        timeline: [
          {
            id: 'tl_1',
            workspaceId: SANDBOX_WORKSPACE,
            prospectId: 'p-1',
            kind: 'compliance',
            outcome: 'pass',
            summary: 'Compliance gate passed.',
            at: '2026-06-22T10:00:00.000Z',
            seq: 0,
            environment: 'MOCK',
          },
        ],
        idempotentRepeat: true,
      },
      trustOps: {
        metrics: {
          funnel: {
            leadsReceived: 2,
            compliancePass: 1,
            complianceBlock: 1,
            approvalApproved: 1,
            approvalRejected: 0,
            approvalPending: 0,
            appointmentRequested: 1,
            appointmentSucceeded: 0,
            crmWritten: 1,
            proofEventsRecorded: 1,
            completed: 1,
            blocked: 1,
            awaitingApproval: 0,
          },
          blockedReasons: [],
          approvalCoverage: 1,
          egress: { noLiveEgress: true, mode: 'MOCK_SANDBOX', statement: 'no live egress' },
        },
        trustScore: {
          score: 100,
          components: [
            { key: 'approvalCoverage', label: 'a', weight: 40, ratio: 1, earned: 40 },
            { key: 'complianceBlockHandling', label: 'b', weight: 25, ratio: 1, earned: 25 },
            { key: 'egressClean', label: 'c', weight: 25, ratio: 1, earned: 25 },
            { key: 'proofCoverage', label: 'd', weight: 10, ratio: 1, earned: 10 },
          ],
        },
      },
      releaseGates: [
        { stage: 'dry_run', passed: true, missing: [], missingKeys: [], reason: 'ok' },
        {
          stage: 'private_pilot',
          passed: false,
          missing: ['monitoring enabled', 'rollback ready'],
          missingKeys: ['monitoringEnabled', 'rollbackReady'],
          reason: 'blocked',
        },
        {
          stage: 'controlled_live',
          passed: false,
          missing: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
          missingKeys: [
            'signedCustomerScope',
            'counselSignoff',
            'founderSignoff',
            'monitoringEnabled',
            'rollbackReady',
            'secretsConfigured',
            'connectorApproval',
          ],
          reason: 'blocked',
        },
      ],
      proofTrace: [
        {
          workspaceId: SANDBOX_WORKSPACE,
          prospectId: 'p-1',
          company: 'Demo Co',
          kind: 'gtm.discovery.booked.v1',
          summary: 'booked',
        },
      ],
      egress: { noLiveEgress: true, mode: 'MOCK_SANDBOX', statement: 'no live egress' },
      whyLiveBlocked: ['blocked'],
      controlledLiveRequirements: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    };
  }

  it('scores a fully-passing real-shaped view at/above threshold, headline = sum of earned', () => {
    const card = computeParityScorecard(passingView());
    expect(card.pass).toBe(true);
    expect(card.score).toBeGreaterThanOrEqual(ALTA_PARITY_THRESHOLD);
    const summed = card.dimensions.reduce((s, d) => s + d.earned, 0);
    expect(card.score).toBe(summed);
    expect(card.remaining.length).toBeGreaterThan(0);
  });

  it('is pure — same input yields same scorecard', () => {
    const v = passingView();
    expect(computeParityScorecard(v)).toEqual(computeParityScorecard(v));
  });

  it('penalizes a view that leaks channel actions on a blocked lead', () => {
    const v = passingView();
    // Force the blocked lead to (wrongly) carry a channel action.
    v.leads[1]!.channelPlan = [v.leads[0]!.channelPlan[0]!];
    const card = computeParityScorecard(v);
    const egress = card.dimensions.find((d) => d.key === 'egress');
    expect(egress?.checks.find((c) => c.label.includes('Blocked lead'))?.ok).toBe(false);
    expect(card.score).toBeLessThan(100);
  });
});
