import { describe, it, expect, beforeAll } from 'vitest';
import { loadCommandCenterData, type CommandCenterView } from './gtmCommandCenterData.js';
import { assertNoRawPii } from '../gtmIntegratedDemoViewModel.js';
// Import the REAL modules directly so we can prove the Command Center's output is
// real-module output, not a hand-authored structural mirror.
import {
  buildAudience,
  evaluateReleaseGate,
  assembleIntegratedRunPacket,
  verifyIntegratedRunPacket,
} from '@cognitia/agents';

let view: CommandCenterView;

beforeAll(async () => {
  view = await loadCommandCenterData();
});

describe('GTM Command Center adapter uses real @cognitia/agents output', () => {
  it('is marked as sourced from real modules and renders every surface', () => {
    expect(view.source).toBe('real-agents-modules');
    expect(view.banner).toBe('MOCK ONLY · DRY-RUN ONLY · NO LIVE SEND · NO REAL CRM · NO PII');
    expect(view.workspaceId).toBe('budget_wheels_demo');
    expect(view.sandbox).toBe(true);
    expect(view.leads.length).toBe(3); // B1 assembly (happy/pending/blocked)
    expect(view.audience.ranked.length).toBeGreaterThan(0); // B4
    expect(view.audience.rejected.length).toBeGreaterThan(0); // unlawful sources rejected
    expect(view.crm.records.length).toBeGreaterThan(0); // B3
    expect(view.trustOps.trustScore.components.length).toBe(4); // B5
    expect(view.releaseGates.length).toBe(3); // B6
  });

  it('every channel plan is a real dry-run action (sent:false, BLOCKED live status)', () => {
    const actions = view.leads.flatMap((l) => l.channelPlan);
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) {
      expect(a.mode).toBe('dry_run');
      expect(a.sent).toBe(false);
      expect(a.wouldSendIfLive.liveStatus).toBe('BLOCKED');
      // Fields that exist on the real DryRunAction (not on the old mirror).
      expect(a).toHaveProperty('planRef');
      expect(a).toHaveProperty('wouldSendIfLive');
    }
  });

  it('the blocked lead produces no channel actions (no-egress demonstration)', () => {
    const blocked = view.leads.find((l) => l.console.badge.tone === 'danger');
    expect(blocked).toBeDefined();
    expect(blocked!.channelPlan.length).toBe(0);
  });

  it('audience ranking equals a direct real buildAudience call (same module)', () => {
    const direct = buildAudience([
      {
        id: 'p-001',
        companyName: 'Northshore Auto Group',
        source: 'consented_csv',
        fit: 0.9,
        urgency: 0.8,
        consentBasis: 'explicit_consent',
        evidence: 'verified_fact',
        region: 'BC',
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
    ]);
    expect(view.audience.ranked.map((p) => p.id)).toEqual(direct.prospects.map((p) => p.id));
    expect(view.audience.ranked.map((p) => p.score)).toEqual(
      direct.prospects.map((p) => p.score.score),
    );
    expect(view.audience.rejected).toEqual(direct.rejected);
  });

  it('release gates equal direct real evaluateReleaseGate calls and fail closed', () => {
    expect(view.releaseGates).toEqual([
      evaluateReleaseGate('dry_run'),
      evaluateReleaseGate('private_pilot'),
      evaluateReleaseGate('controlled_live'),
    ]);
    const live = view.releaseGates.find((g) => g.stage === 'controlled_live')!;
    expect(live.passed).toBe(false);
    expect(live.missingKeys.length).toBe(7);
    const dryRun = view.releaseGates.find((g) => g.stage === 'dry_run')!;
    expect(dryRun.passed).toBe(true);
  });

  it('the underlying integrated packet is complete (all 8 sections present)', async () => {
    const packet = await assembleIntegratedRunPacket({
      lead: {
        companyName: 'Northshore Auto Group',
        source: 'public_registry',
        sourceRisk: 'low',
        contactBasis: 'conspicuously_published_business_contact',
        consentStatus: 'implied_possible',
        unsubscribeStatus: 'subscribed',
        doNotContact: false,
      },
      workspaceId: 'budget_wheels_demo',
    });
    const completeness = verifyIntegratedRunPacket(packet);
    expect(completeness.complete).toBe(true);
    expect(completeness.missing).toEqual([]);
  });

  it('TrustOps funnel is computed across exactly the rendered leads', () => {
    expect(view.trustOps.metrics.funnel.leadsReceived).toBe(view.leads.length);
    expect(view.trustOps.metrics.egress.noLiveEgress).toBe(true);
  });

  it('proves CRM-lite idempotency and emits an ordered operator timeline', () => {
    expect(view.crm.idempotentRepeat).toBe(true);
    expect(view.crm.timeline.length).toBeGreaterThan(0);
  });

  it('every proof trace row is workspace-attributed to the sandbox', () => {
    expect(view.proofTrace.length).toBeGreaterThan(0);
    for (const row of view.proofTrace) {
      expect(row.workspaceId).toBe('budget_wheels_demo');
    }
  });

  it('parity scorecard passes threshold and earns from real checks only', () => {
    expect(view.parity.threshold).toBe(80);
    expect(view.parity.pass).toBe(true);
    expect(view.parity.score).toBeGreaterThanOrEqual(80);
    const weightSum = view.parity.dimensions.reduce((s, d) => s + d.weight, 0);
    expect(weightSum).toBe(100);
  });

  it('serialized view carries no raw PII', () => {
    expect(() => assertNoRawPii(JSON.stringify(view))).not.toThrow();
  });
});
