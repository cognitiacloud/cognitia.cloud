/**
 * Provenance tests for the `/gtm-command-center` SERVER-ONLY adapter.
 *
 * These prove the adapter does NOT hand-author or mirror B1–B6 outputs: every
 * rendered section is the result of calling the real `@cognitia/agents` modules.
 * Each test calls a lane module DIRECTLY with the same inputs the adapter uses
 * and asserts the adapter's output is byte-identical to the direct call. If the
 * adapter ever drifted back into a structural mirror, these would fail.
 *
 * Also asserts the route's safety invariants over the real output: dry-run-only
 * channels, fail-closed live gate, no raw PII, and that the data is backed by
 * the real integrated run packet (PR #159).
 */

import { describe, it, expect } from 'vitest';
import {
  buildAudience,
  computeTrustOpsMetrics,
  buildTrustOpsReport,
  evaluateReleaseGate,
  planDryRunAction,
  sendLive,
  LiveSendBlockedError,
  CHANNEL_KINDS,
  assembleGtmRunPacket,
  type AudienceInputRow,
  type WorkflowRunSummary,
} from '@cognitia/agents';
import { loadCommandCenterData } from './gtmCommandCenterData.js';
import { computeParityScorecard, findRawPii } from '../gtmCommandCenterViewModel.js';

const SANDBOX = 'budget_wheels_demo';

/** The exact audience rows the adapter feeds B4 (kept in sync with the adapter). */
const AUDIENCE_ROWS: AudienceInputRow[] = [
  {
    id: 'p-001',
    companyName: 'Northshore Auto Group',
    source: 'consented_csv',
    fit: 0.9,
    urgency: 0.8,
    consentBasis: 'explicit_consent',
    evidence: 'verified_fact',
    region: 'BC',
    contactEmailExample: 'sales@northshore-auto.example',
    contactPhoneExample: '555-0123',
  },
  {
    id: 'p-002',
    companyName: 'Budget Wheels Demo',
    source: 'manual',
    fit: 0.6,
    urgency: 0.5,
    consentBasis: 'legitimate_interest',
    evidence: 'likely_inference',
    region: 'ON',
  },
  { id: 'p-bad', companyName: 'Scraped Listings LLC', source: 'maps_platform_scrape' },
  { id: 'p-apify', companyName: 'Apify Harvest Co', source: 'apify' },
];

describe('Command Center adapter — real-module provenance', () => {
  it('is deterministic across loads', async () => {
    const a = await loadCommandCenterData();
    const b = await loadCommandCenterData();
    expect(a).toEqual(b);
    expect(a.source).toBe('real-agents-modules');
  });

  it('B4 audience equals a direct buildAudience() call', async () => {
    const data = await loadCommandCenterData();
    const direct = buildAudience(AUDIENCE_ROWS);
    expect(data.audience.ranked).toEqual(direct.prospects);
    expect(data.audience.rejected).toEqual(direct.rejected);
    // The scraped/apify sources were really rejected by the module, not faked.
    expect(direct.rejected.map((r) => r.id).sort()).toEqual(['p-apify', 'p-bad']);
  });

  it('B6 release gates equal direct evaluateReleaseGate() calls (fail closed)', async () => {
    const data = await loadCommandCenterData();
    expect(data.releaseGates).toEqual([
      evaluateReleaseGate('dry_run'),
      evaluateReleaseGate('private_pilot'),
      evaluateReleaseGate('controlled_live'),
    ]);
    const live = data.releaseGates.find((g) => g.stage === 'controlled_live')!;
    expect(live.passed).toBe(false);
    expect(live.missingKeys.length).toBe(7);
  });

  it('B5 TrustOps equals direct computeTrustOpsMetrics/buildTrustOpsReport() over the real runs', async () => {
    const data = await loadCommandCenterData();
    // Reconstruct the same three run summaries the adapter derives from B1.
    const summaries: WorkflowRunSummary[] = data.leads.map((l) => {
      const p = l.lead.packet;
      const status =
        p.status === 'completed' || p.status === 'awaiting_approval' ? p.status : 'blocked';
      return {
        runId: p.prospect.id,
        tenant: p.workspace.workspaceId,
        status,
        compliance: p.compliance.blocked ? 'blocked' : 'pass',
        approval: p.compliance.blocked ? undefined : p.approval.status,
        appointment: p.appointment.requested ? 'requested' : undefined,
        crm: p.crm.written ? 'ok' : undefined,
        proofEventsRecorded: p.proofs.length,
        blockedReason: p.blockedReason,
      };
    });
    expect(data.trustOps.metrics).toEqual(computeTrustOpsMetrics(summaries));
    const report = buildTrustOpsReport(summaries);
    expect(data.trustOps.trustScore).toEqual(report.score);
    expect(data.trustOps.reportMarkdown).toEqual(report.markdown);
  });

  it('B2 channel plans for the proceeding lead equal direct planDryRunAction() calls', async () => {
    const data = await loadCommandCenterData();
    const happy = data.leads.find((l) => l.lead.packet.status === 'completed')!;
    const direct = CHANNEL_KINDS.map((channel) =>
      planDryRunAction(channel, { workspaceId: SANDBOX, prospectId: happy.lead.id }),
    );
    expect(happy.channelPlan).toEqual(direct);
    // Halted leads plan nothing.
    const blocked = data.leads.find((l) => l.lead.packet.status === 'blocked')!;
    expect(blocked.channelPlan).toEqual([]);
  });

  it('B1 run state matches a direct assembleGtmRunPacket() call for the happy lead', async () => {
    const data = await loadCommandCenterData();
    const direct = await assembleGtmRunPacket({
      lead: {
        companyName: 'Northshore Auto Group',
        source: 'public_registry',
        sourceRisk: 'low',
        contactBasis: 'conspicuously_published_business_contact',
        consentStatus: 'implied_possible',
        unsubscribeStatus: 'subscribed',
        doNotContact: false,
      },
      workspaceId: SANDBOX,
    });
    const happy = data.leads.find((l) => l.lead.id === 'p-001')!;
    expect(happy.lead.packet.status).toBe(direct.status);
    expect(happy.lead.packet.finalState).toBe(direct.finalState);
    expect(happy.lead.packet.proofs.map((p) => p.kind)).toEqual(direct.proofs.map((p) => p.kind));
  });
});

describe('Command Center adapter — safety invariants over real output', () => {
  it('every planned channel action is dry-run and unsent; live path fails closed', async () => {
    const data = await loadCommandCenterData();
    const allChannels = data.leads.flatMap((l) => l.channelPlan);
    expect(allChannels.length).toBeGreaterThan(0);
    for (const a of allChannels) {
      expect(a.mode).toBe('dry_run');
      expect(a.sent).toBe(false);
      expect(a.wouldSendIfLive.liveStatus).toBe('BLOCKED');
      expect(() => sendLive(a.channel, { workspaceId: SANDBOX, prospectId: a.prospectId })).toThrow(
        LiveSendBlockedError,
      );
    }
  });

  it('carries no raw PII anywhere in the serialized output', async () => {
    const data = await loadCommandCenterData();
    expect(findRawPii(JSON.stringify(data))).toBeNull();
  });

  it('is backed by the real integrated run packet (PR #159), complete', async () => {
    const data = await loadCommandCenterData();
    expect(data.integration.complete).toBe(true);
    expect(data.integration.missing).toEqual([]);
  });

  it('computes a passing, auditable parity score over the real output', async () => {
    const data = await loadCommandCenterData();
    const parity = computeParityScorecard(data);
    expect(parity.pass).toBe(true);
    expect(parity.score).toBeGreaterThanOrEqual(parity.threshold);
    // Every dimension's earned points are derived from its check ratio.
    for (const d of parity.dimensions) {
      expect(d.earned).toBe(Math.round(d.weight * d.ratio));
    }
  });
});
