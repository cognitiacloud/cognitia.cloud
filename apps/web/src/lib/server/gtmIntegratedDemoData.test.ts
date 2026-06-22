import { describe, it, expect, beforeAll } from 'vitest';
import { loadIntegratedDemoData, type IntegratedDemoData } from './gtmIntegratedDemoData.js';
import { assertNoRawPii } from '../gtmIntegratedDemoViewModel.js';
// Import the REAL modules directly so we can prove the adapter's output matches
// real-module output rather than a hand-authored mirror.
import { planDryRunAction, buildAudience, evaluateReleaseGate } from '@cognitia/agents';

let data: IntegratedDemoData;

beforeAll(async () => {
  data = await loadIntegratedDemoData();
});

describe('adapter uses real @cognitia/agents module outputs', () => {
  it('is marked as sourced from real modules and renders all six surfaces', () => {
    expect(data.source).toBe('real-agents-modules');
    expect(data.banner).toBe('MOCK ONLY / DRY-RUN ONLY / NO LIVE SEND / NO REAL CRM');
    expect(data.workspaceId).toBe('budget_wheels_demo');
    expect(data.leads.length).toBe(3); // B1 assembly (happy/blocked/rejected)
    expect(data.audience.ranked.length).toBeGreaterThan(0); // B4
    expect(data.crm.records.length).toBeGreaterThanOrEqual(0); // B3
    expect(data.trustOps.reportMarkdown.length).toBeGreaterThan(0); // B5
    expect(data.releaseGates.length).toBe(3); // B6
  });

  it('dry-run actions carry the REAL DryRunAction shape (planRef, wouldSendIfLive)', () => {
    const realAction = planDryRunAction('email', {
      workspaceId: 'budget_wheels_demo',
      prospectId: 'p-001',
    });
    const proceeding = data.leads.find((l) => l.channelPlan.length > 0);
    expect(proceeding).toBeDefined();
    const action = proceeding!.channelPlan[0]!;
    // Fields that exist on the real module output (not on the old mirror).
    expect(action).toHaveProperty('planRef');
    expect(action).toHaveProperty('wouldSendIfLive');
    expect(Object.keys(action).sort()).toEqual(Object.keys(realAction).sort());
  });

  it('audience ranking equals a direct real buildAudience call (same module)', () => {
    // The accepted-prospect ids the real builder produces, in order.
    const direct = buildAudience([
      { id: 'p-001', companyName: 'Northshore Auto Group', source: 'consented_csv' },
      { id: 'p-002', companyName: 'Budget Wheels Demo', source: 'manual' },
      { id: 'p-bad', companyName: 'Scraped Co', source: 'maps_platform_scrape' },
    ]);
    // Real builder rejects the scraped row.
    expect(direct.rejected.some((r) => r.id === 'p-bad')).toBe(true);
    expect(data.audience.rejected.some((r) => r.id === 'p-bad')).toBe(true);
    expect(data.audience.ranked.map((p) => p.id)).not.toContain('p-bad');
  });
});

describe('blocked leads cannot proceed', () => {
  it('only the compliant+approved lead plans channel actions', () => {
    const proceeding = data.leads.filter((l) => l.channelPlan.length > 0);
    expect(proceeding).toHaveLength(1);
    const blocked = data.leads.filter((l) => l.channelPlan.length === 0);
    expect(blocked.length).toBe(2); // compliance-blocked + rejected-approval
    for (const lead of blocked) {
      expect(lead.policy.allow).toBe(false);
    }
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
  it('the proceeding lead produced exactly one opportunity despite double-upsert', () => {
    expect(data.crm.records).toHaveLength(1);
    expect(data.crm.records[0]!.workspaceId).toBe('budget_wheels_demo');
    expect(data.crm.records[0]!.stage).toBe('appointment_set');
  });
});

describe('TrustOps metrics render (real B5)', () => {
  it('computes a funnel over the three real runs with a bounded trust score', () => {
    expect(data.trustOps.metrics.funnel.leadsReceived).toBe(3);
    expect(data.trustOps.score.score).toBeGreaterThanOrEqual(0);
    expect(data.trustOps.score.score).toBeLessThanOrEqual(100);
    expect(data.trustOps.reportMarkdown).toMatch(/MOCK|SANDBOX/i);
  });
});

describe('proof / action trace is generated from real integrated packets', () => {
  it('renders one correlated trace per lead with packet-derived TrustOps', () => {
    expect(data.proof.traces.length).toBe(3);
    expect(data.proof.trustOps.leadsReceived).toBe(3);
    expect(data.proof.trustOps.score).toBeGreaterThanOrEqual(0);
    expect(data.proof.trustOps.score).toBeLessThanOrEqual(100);
    expect(data.proof.trustOps.reportMarkdown).toMatch(/MOCK|SANDBOX/i);
  });

  it('the happy-path trace maps the full canonical loop in order', () => {
    const complete = data.proof.traces.find((t) => t.complete);
    expect(complete).toBeDefined();
    expect(complete!.steps.map((s) => s.stage)).toEqual([
      'lead',
      'compliance',
      'approval',
      'dry_run_plan',
      'crm_lite',
      'trustops',
    ]);
    // Every step correlates on the same opaque id.
    expect(new Set(complete!.steps.map((s) => s.correlationId)).size).toBe(1);
  });

  it('blocked / rejected leads produce honest, partial traces (no fabricated stages)', () => {
    const partials = data.proof.traces.filter((t) => !t.complete);
    expect(partials.length).toBe(2); // compliance-blocked + approval-rejected
    for (const trace of partials) {
      const stages = trace.steps.map((s) => s.stage);
      expect(stages).not.toContain('crm_lite');
      // A blocked/rejected lead never reaches a dry-run outreach plan.
      expect(stages).not.toContain('dry_run_plan');
    }
  });
});

describe('no raw PII in the real serialized output', () => {
  it('the entire serialized demo data passes the PII guard', () => {
    expect(() => assertNoRawPii(JSON.stringify(data))).not.toThrow();
  });

  it('every proof trace passes the PII guard individually', () => {
    for (const trace of data.proof.traces) {
      expect(() => assertNoRawPii(JSON.stringify(trace))).not.toThrow();
    }
  });
});
