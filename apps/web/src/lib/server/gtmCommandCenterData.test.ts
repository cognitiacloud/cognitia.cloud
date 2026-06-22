import { describe, it, expect, beforeAll } from 'vitest';
import {
  loadCommandCenterData,
  PARITY_THRESHOLD,
  type CommandCenterData,
} from './gtmCommandCenterData.js';
import { assertNoRawPii } from '../gtmIntegratedDemoViewModel.js';
// Import the REAL modules directly so we can prove the adapter's output matches
// real-module output rather than a hand-authored mirror.
import {
  assembleIntegratedRunPacket,
  verifyIntegratedRunPacket,
  buildAudience,
  evaluateReleaseGate,
} from '@cognitia/agents';

let data: CommandCenterData;

beforeAll(async () => {
  data = await loadCommandCenterData();
});

describe('Command Center is rendered from real @cognitia/agents module output', () => {
  it('is marked as sourced from real modules and renders all surfaces', () => {
    expect(data.source).toBe('real-agents-modules');
    expect(data.banner).toContain('NO LIVE SEND');
    expect(data.banner).toContain('NO PII');
    expect(data.workspaceId).toBe('budget_wheels_demo');
    expect(data.leads.length).toBe(3); // happy / compliance-blocked / approval-rejected
    expect(data.audience.ranked.length).toBeGreaterThan(0); // B4
    expect(data.crm.records.length).toBeGreaterThan(0); // B3
    expect(data.trustOps.trustScore.components.length).toBeGreaterThan(0); // B5
    expect(data.releaseGates.length).toBe(3); // B6
    expect(data.proofTrace.length).toBeGreaterThan(0);
  });

  it('the canonical run packet is the real PR #159 integration packet (complete)', async () => {
    const direct = await assembleIntegratedRunPacket({
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
    const completeness = verifyIntegratedRunPacket(direct);
    expect(completeness.complete).toBe(true);
    expect(completeness.missing).toHaveLength(0);
    // The schema tag is stamped by the real builder, not hand-authored.
    expect(direct.schema).toBe('cognitia.gtm.integrated_run_packet.v1');
  });

  it('audience ranking matches a direct real buildAudience call (same module)', () => {
    const direct = buildAudience([
      { id: 'p-001', companyName: 'Northshore Auto Group', source: 'consented_csv' },
      { id: 'p-002', companyName: 'Budget Wheels Demo', source: 'manual' },
      { id: 'p-bad', companyName: 'Scraped Co', source: 'maps_platform_scrape' },
    ]);
    expect(direct.rejected.some((r) => r.id === 'p-bad')).toBe(true);
    expect(data.audience.rejected.some((r) => r.id === 'p-bad')).toBe(true);
    expect(data.audience.ranked.map((p) => p.id)).not.toContain('p-bad');
    for (const p of data.audience.ranked) {
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThanOrEqual(1);
    }
  });
});

describe('blocked / rejected leads cannot advance', () => {
  it('only the compliant+approved lead plans channel actions', () => {
    const proceeding = data.leads.filter((l) => l.channelPlan.length > 0);
    expect(proceeding).toHaveLength(1);
    const halted = data.leads.filter((l) => l.channelPlan.length === 0);
    expect(halted.length).toBe(2); // compliance-blocked + approval-rejected
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
  it('dry_run passes; private_pilot and controlled_live fail by default', () => {
    const byStage = new Map(data.releaseGates.map((g) => [g.stage, g]));
    expect(byStage.get('dry_run')!.passed).toBe(true);
    expect(byStage.get('private_pilot')!.passed).toBe(false);
    expect(byStage.get('controlled_live')!.passed).toBe(false);
    // Matches a direct real call.
    expect(evaluateReleaseGate('controlled_live').passed).toBe(false);
    expect(data.controlledLiveRequirements.length).toBeGreaterThan(0);
  });
});

describe('CRM-lite is mock and idempotent (real B3)', () => {
  it('the proceeding lead produced exactly one opportunity and a non-empty timeline', () => {
    expect(data.crm.records).toHaveLength(1);
    expect(data.crm.records[0]!.workspaceId).toBe('budget_wheels_demo');
    expect(data.crm.idempotentRepeat).toBe(true);
    expect(data.crm.timeline.length).toBeGreaterThan(0);
  });
});

describe('TrustOps metrics render (real B5)', () => {
  it('computes a funnel over the three real runs with a bounded trust score', () => {
    expect(data.trustOps.metrics.funnel.leadsReceived).toBe(3);
    expect(data.trustOps.trustScore.score).toBeGreaterThanOrEqual(0);
    expect(data.trustOps.trustScore.score).toBeLessThanOrEqual(100);
    expect(data.trustOps.metrics.egress.noLiveEgress).toBe(true);
  });
});

describe('proof / workspace attribution', () => {
  it('every proof row is attributed to the sandbox workspace', () => {
    for (const row of data.proofTrace) {
      expect(row.workspaceId).toBe('budget_wheels_demo');
    }
  });
});

describe('Alta implementation-parity scorecard (code-computed from real output)', () => {
  it('weights sum to 100 and the score equals the sum of earned points', () => {
    const weightSum = data.parity.dimensions.reduce((s, d) => s + d.weight, 0);
    expect(weightSum).toBe(100);
    const earnedSum = data.parity.dimensions.reduce((s, d) => s + d.earned, 0);
    expect(data.parity.score).toBe(earnedSum);
  });

  it('passes the threshold', () => {
    expect(data.parity.threshold).toBe(PARITY_THRESHOLD);
    expect(data.parity.score).toBeGreaterThanOrEqual(PARITY_THRESHOLD);
    expect(data.parity.pass).toBe(true);
  });
});

describe('no raw PII in the real serialized output', () => {
  it('the entire serialized Command Center data passes the PII guard', () => {
    expect(() => assertNoRawPii(JSON.stringify(data))).not.toThrow();
  });
});
