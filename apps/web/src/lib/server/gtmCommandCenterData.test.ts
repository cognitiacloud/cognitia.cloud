import { describe, it, expect, beforeAll } from 'vitest';
import { loadCommandCenterData } from './gtmCommandCenterData.js';
import { assertNoRawPii, type CommandCenterView } from '../gtmCommandCenterViewModel.js';
// Import the REAL modules directly so we can prove the adapter's output is
// real-module output rather than a hand-authored structural mirror.
import {
  planDryRunAction,
  buildAudience,
  evaluateReleaseGate,
  verifyIntegratedRunPacket,
} from '@cognitia/agents';

let data: CommandCenterView;

beforeAll(async () => {
  data = await loadCommandCenterData();
});

describe('command center is sourced from real @cognitia/agents modules', () => {
  it('is marked real-sourced and renders the integrated surfaces', () => {
    expect(data.source).toBe('real-agents-modules');
    expect(data.banner).toContain('NO LIVE SEND');
    expect(data.workspaceId).toBe('budget_wheels_demo');
    expect(data.leads.length).toBe(3); // B1: completed / awaiting-approval / blocked
    expect(data.audience.ranked.length).toBeGreaterThan(0); // B4
    expect(data.crm.records.length).toBeGreaterThan(0); // B3
    expect(data.trustOps.reportMarkdown.length).toBeGreaterThan(0); // B5
    expect(data.releaseGates.length).toBe(3); // B6
    expect(data.proofTrace.length).toBeGreaterThan(0);
  });

  it('dry-run actions carry the REAL DryRunAction shape (planRef, wouldSendIfLive)', () => {
    const realAction = planDryRunAction('email', {
      workspaceId: 'budget_wheels_demo',
      prospectId: 'p-001',
    });
    const proceeding = data.leads.find((l) => l.channelPlan.length > 0);
    expect(proceeding).toBeDefined();
    const action = proceeding!.channelPlan[0]!;
    expect(action).toHaveProperty('planRef');
    expect(action).toHaveProperty('wouldSendIfLive');
    expect(Object.keys(action).sort()).toEqual(Object.keys(realAction).sort());
  });

  it('audience rejects scraped/apify sources exactly like a direct buildAudience call', () => {
    const direct = buildAudience([
      { id: 'p-scrape', companyName: 'Scraped Listings LLC', source: 'maps_platform_scrape' },
      { id: 'p-apify', companyName: 'Apify Harvest Co', source: 'apify' },
    ]);
    expect(direct.prospects).toHaveLength(0);
    expect(data.audience.rejected.map((r) => r.id).sort()).toContain('p-scrape');
    expect(data.audience.rejected.map((r) => r.id).sort()).toContain('p-apify');
    expect(data.audience.ranked.map((p) => p.id)).not.toContain('p-scrape');
  });
});

describe('integrated run packet (PR #159) is real and complete', () => {
  it('verifies complete with all 8 sections and a build-time no-egress attestation', () => {
    expect(data.integrated.completeness.complete).toBe(true);
    expect(data.integrated.completeness.missing).toHaveLength(0);
    expect(data.integrated.completeness.present.length).toBe(8);
    expect(data.integrated.packet.mode).toBe('mock');
    expect(data.integrated.packet.attestation.noLiveEgress).toBe(true);
    // The view's completeness equals a fresh direct verify of the same packet.
    const direct = verifyIntegratedRunPacket(data.integrated.packet);
    expect(direct.complete).toBe(true);
    // Every channel plan inside the packet is non-live.
    expect(data.integrated.packet.channelPlans.every((a) => a.sent === false)).toBe(true);
  });
});

describe('only the compliant+approved lead can act (B1/B2 gating)', () => {
  it('the completed lead plans channels; pending + blocked plan none', () => {
    const proceeding = data.leads.filter((l) => l.channelPlan.length > 0);
    expect(proceeding).toHaveLength(1);
    expect(proceeding[0]!.packet.status).toBe('completed');
    const halted = data.leads.filter((l) => l.channelPlan.length === 0);
    expect(halted.length).toBe(2); // awaiting-approval + compliance-blocked
    for (const lead of halted) expect(lead.policy.allow).toBe(false);
  });
});

describe('dry-run channels never send (real B2)', () => {
  it('every planned action is mode=dry_run, sent=false, live BLOCKED', () => {
    for (const lead of data.leads) {
      for (const action of lead.channelPlan) {
        expect(action.mode).toBe('dry_run');
        expect(action.sent).toBe(false);
        expect(action.wouldSendIfLive.liveStatus).toBe('BLOCKED');
      }
    }
  });
});

describe('release gates fail closed (real B6)', () => {
  it('dry_run passes; private_pilot + controlled_live fail; live needs 7 conditions', () => {
    const byStage = new Map(data.releaseGates.map((g) => [g.stage, g]));
    expect(byStage.get('dry_run')!.passed).toBe(true);
    expect(byStage.get('private_pilot')!.passed).toBe(false);
    const live = byStage.get('controlled_live')!;
    expect(live.passed).toBe(false);
    expect(live.missingKeys.length).toBe(7);
    expect(evaluateReleaseGate('controlled_live').passed).toBe(false);
    expect(data.controlledLiveRequirements.length).toBe(7);
  });
});

describe('CRM-lite is mock and idempotent (real B3)', () => {
  it('the proceeding lead produced exactly one opportunity despite double-upsert', () => {
    expect(data.crm.records).toHaveLength(1);
    expect(data.crm.idempotentRepeat).toBe(true);
    expect(data.crm.records[0]!.workspaceId).toBe('budget_wheels_demo');
    // Real B3 projection derives a 'proposal' stage for a completed run.
    expect(data.crm.records[0]!.stage).toBe('proposal');
    expect(data.crm.timeline.length).toBeGreaterThan(0);
  });
});

describe('TrustOps metrics render (real B5)', () => {
  it('computes a funnel over the three real runs with a bounded 4-part trust score', () => {
    expect(data.trustOps.metrics.funnel.leadsReceived).toBe(3);
    expect(data.trustOps.metrics.funnel.complianceBlock).toBe(1);
    expect(data.trustOps.trustScore.score).toBeGreaterThanOrEqual(0);
    expect(data.trustOps.trustScore.score).toBeLessThanOrEqual(100);
    expect(data.trustOps.trustScore.components).toHaveLength(4);
    expect(data.trustOps.reportMarkdown).toMatch(/MOCK|SANDBOX/i);
    expect(data.trustOps.metrics.egress.noLiveEgress).toBe(true);
  });
});

describe('scorecard 1 — mock/dry-run capability-surface score', () => {
  it('is the correctly-labelled, computed surface score and passes its threshold', () => {
    expect(data.capabilitySurface.axisLabel).toBe('mock/dry-run capability-surface score');
    expect(data.capabilitySurface.score).toBeGreaterThanOrEqual(data.capabilitySurface.threshold);
    // Every weight is fully earned over real output ⇒ a full 100 on this axis.
    expect(data.capabilitySurface.score).toBe(100);
    expect(data.capabilitySurface.pass).toBe(true);
    // Auditable: the sum of earned equals the headline score.
    const summed = data.capabilitySurface.dimensions.reduce((s, d) => s + d.earned, 0);
    expect(summed).toBe(data.capabilitySurface.score);
  });
});

describe('scorecard 2 — HONEST official Alta implementation parity', () => {
  it('never claims 100 as official parity and reports the honest ceiling + blockers', () => {
    const p = data.implementationParity;
    expect(p.axisLabel).toBe('official Alta implementation parity');
    // Honesty contract: the official figure is NOT 100 and NOT the surface score.
    expect(p.score).toBeLessThan(100);
    expect(p.score).toBeLessThan(data.capabilitySurface.score);
    expect(p.score).toBe(p.honestCeiling);
    // The honest ceiling on this branch is 78/100 (real modules + integrated
    // packet + visible route + dry-run safety + lane breadth + build provability
    // earned; persistence/enforcement/deployment/live deliberately at zero).
    expect(p.score).toBe(78);
    expect(p.meetsThreshold).toBe(false);
    // Persistence + route-bound enforcement are genuinely blocked (zero-credit).
    const byKey = new Map(p.axes.map((a) => [a.key, a]));
    expect(byKey.get('persistence')!.status).toBe('blocked');
    expect(byKey.get('route_bound_enforcement')!.status).toBe('blocked');
    expect(byKey.get('reachable_deployment')!.status).toBe('blocked');
    expect(byKey.get('live_automation_readiness')!.status).toBe('blocked');
    // Real-module integration + safety axes are genuinely credited.
    expect(byKey.get('real_module_integration')!.status).toBe('implemented');
    expect(byKey.get('integrated_packet')!.status).toBe('implemented');
    expect(byKey.get('dry_run_safety')!.status).toBe('implemented');
    // The exact blockers to a confident 80+ are surfaced for the founder.
    expect(p.exactBlockers.length).toBeGreaterThan(0);
    expect(p.outOfScope.length).toBeGreaterThan(0);
    // Weights sum to 100 so the score is a true percentage.
    expect(p.axes.reduce((s, a) => s + a.weight, 0)).toBe(100);
  });
});

describe('no live egress / no raw PII in the real serialized output', () => {
  it('the entire serialized view passes the PII guard', () => {
    expect(() => assertNoRawPii(JSON.stringify(data))).not.toThrow();
  });
  it('no dry-run action anywhere claims to have sent', () => {
    const allSent = [
      ...data.leads.flatMap((l) => l.channelPlan),
      ...data.integrated.packet.channelPlans,
    ].map((a) => a.sent);
    expect(allSent.every((s) => s === false)).toBe(true);
  });
});
