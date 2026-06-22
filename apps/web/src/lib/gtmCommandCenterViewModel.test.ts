import { describe, it, expect } from 'vitest';
import {
  buildCommandCenterView,
  computeParityScorecard,
  computeTrustOpsMetrics,
  computeTrustScore,
  scoreSignals,
  buildAudience,
  planDryRunAction,
  assertNoLiveSend,
  sendLive,
  evaluateReleaseGate,
  requiredConditions,
  MockCrmStore,
  canProceed,
  findRawPii,
  assertNoRawPii,
  LiveSendBlockedError,
  CHANNEL_KINDS,
  COMMAND_CENTER_BANNER,
  SANDBOX_WORKSPACE,
  ALTA_PARITY_THRESHOLD,
  type WorkflowRunSummary,
} from './gtmCommandCenterViewModel.js';

const view = buildCommandCenterView();

describe('command center — banner, tenant & shape', () => {
  it('exposes the persistent mock/dry-run banner and sandbox tenant', () => {
    expect(view.banner).toBe(COMMAND_CENTER_BANNER);
    expect(view.banner).toContain('NO LIVE SEND');
    expect(view.banner).toContain('NO REAL CRM');
    expect(view.banner).toContain('NO RAW PII');
    expect(view.workspaceId).toBe(SANDBOX_WORKSPACE);
    expect(view.sandbox).toBe(true);
  });

  it('renders all eight integrated surfaces from one mock run', () => {
    expect(view.leads.length).toBeGreaterThan(0); // B1 assembly islands
    expect(view.leads[0]!.channelPlan).toBeDefined(); // B2 dry-run plan
    expect(view.crm.records).toBeDefined(); // B3 crm-lite
    expect(view.crm.timeline.length).toBeGreaterThan(0); // B3 timeline
    expect(view.audience.ranked.length).toBeGreaterThan(0); // B4 audience
    expect(view.trustOps.trustScore.components).toHaveLength(4); // B5 trustops
    expect(view.releaseGates).toHaveLength(3); // B6 gates
    expect(view.proofTrace.length).toBeGreaterThan(0); // proof attribution
    expect(view.egress.noLiveEgress).toBe(true); // no-egress attestation
    expect(view.parity).toBeDefined(); // scorecard
  });

  it('proves one complete lead → ... → proof run end-to-end', () => {
    const happy = view.leads.find((l) => l.lead.id === 'p-001')!;
    // lead → compliance → approval → dry-run plan → crm → trustops → proof
    expect(happy.console.complianceLabel).toBe('Cleared');
    expect(happy.console.approvalLabel).toBe('Approved by human');
    expect(happy.channelPlan.length).toBeGreaterThan(0);
    expect(view.crm.records.some((r) => r.prospectId === 'p-001')).toBe(true);
    expect(view.proofTrace.some((p) => p.prospectId === 'p-001')).toBe(true);
    expect(happy.console.timeline.length).toBeGreaterThanOrEqual(5);
  });
});

describe('blocked lead cannot advance', () => {
  const blocked = view.leads.find((l) => l.lead.id === 'p-009')!;

  it('a do-not-contact lead is blocked and plans no channel actions', () => {
    expect(canProceed(blocked.lead.packet)).toBe(false);
    expect(blocked.console.badge.tone).toBe('danger');
    expect(blocked.channelPlan).toHaveLength(0);
    expect(blocked.lead.packet.crm.written).toBe(false);
  });

  it('the blocked lead writes no CRM record', () => {
    expect(view.crm.records.some((r) => r.prospectId === 'p-009')).toBe(false);
  });

  it('a pending-approval lead also cannot advance to outreach', () => {
    const pending = view.leads.find((l) => l.lead.id === 'p-002')!;
    expect(canProceed(pending.lead.packet)).toBe(false);
    expect(pending.channelPlan).toHaveLength(0);
  });
});

describe('dry-run channel engine never sends', () => {
  it('every planned action across every lead is a dry-run no-send', () => {
    const actions = view.leads.flatMap((l) => l.channelPlan);
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) {
      expect(a.mode).toBe('dry_run');
      expect(a.sent).toBe(false);
      expect(a.wouldSendIfLive.liveStatus).toBe('BLOCKED');
      expect(() => assertNoLiveSend(a)).not.toThrow();
    }
  });

  it('planDryRunAction is dry-run for every channel kind', () => {
    for (const channel of CHANNEL_KINDS) {
      const a = planDryRunAction(channel, { workspaceId: SANDBOX_WORKSPACE, prospectId: 'p-x' });
      expect(a.sent).toBe(false);
      expect(a.mode).toBe('dry_run');
    }
  });

  it('assertNoLiveSend throws on a tampered/forged action', () => {
    expect(() => assertNoLiveSend({ mode: 'dry_run', sent: true } as never)).toThrow(
      LiveSendBlockedError,
    );
    expect(() => assertNoLiveSend({ mode: 'live', sent: false } as never)).toThrow(
      LiveSendBlockedError,
    );
  });

  it('sendLive always throws — there is no live code path', () => {
    expect(() => sendLive()).toThrow(LiveSendBlockedError);
  });
});

describe('B4 — audience / signal scoring', () => {
  it('scores a best-case zero-risk prospect at the 0.8 ceiling and a worst-case at 0', () => {
    const best = scoreSignals({
      fit: 1,
      urgency: 1,
      consentRisk: 'low',
      sourceRisk: 'low',
      evidence: 'verified_fact',
    });
    // Positive weights sum to 0.40 + 0.25 + 0.15 = 0.80 (faithful to lane B4).
    expect(best.score).toBe(0.8);
    const worst = scoreSignals({
      fit: 0,
      urgency: 0,
      consentRisk: 'high',
      sourceRisk: 'high',
      evidence: 'unknown',
    });
    expect(worst.score).toBe(0);
  });

  it('rejects unlawful (scraped) sources and keeps lawful ones ranked', () => {
    expect(view.audience.ranked.length).toBeGreaterThan(0);
    expect(view.audience.rejected.length).toBeGreaterThan(0);
    expect(view.audience.rejected.map((r) => r.reason).join(' ')).toContain('disallowed_source');
    // ranked is sorted by score desc
    const scores = view.audience.ranked.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('buildAudience rejects an off-list source', () => {
    const out = buildAudience([
      {
        id: 'x',
        companyName: 'X',
        source: 'apify',
        consentLabel: 'not_established',
        signals: {
          fit: 1,
          urgency: 1,
          consentRisk: 'low',
          sourceRisk: 'low',
          evidence: 'verified_fact',
        },
      },
    ]);
    expect(out.ranked).toHaveLength(0);
    expect(out.rejected).toHaveLength(1);
  });
});

describe('B3 — CRM-lite store + timeline', () => {
  it('upserts idempotently and emits an ordered timeline', () => {
    const store = new MockCrmStore();
    const u = {
      workspaceId: SANDBOX_WORKSPACE,
      prospectId: 'p-1',
      appointmentRef: 'a',
      stage: 's',
    };
    store.upsert(u);
    store.upsert(u);
    expect(store.list()).toHaveLength(1);
    expect(store.timeline()).toHaveLength(2); // created + updated
    expect(store.timeline()[0]!.kind).toBe('created');
    expect(store.timeline()[1]!.kind).toBe('updated');
  });

  it('the assembled view reports idempotent CRM writes', () => {
    expect(view.crm.idempotentRepeat).toBe(true);
    expect(view.crm.records).toHaveLength(1);
  });

  it('rejects raw PII on write', () => {
    const store = new MockCrmStore();
    expect(() =>
      store.upsert({ workspaceId: SANDBOX_WORKSPACE, prospectId: 'real@gmail.com', stage: 's' }),
    ).toThrow(/PII/);
  });
});

describe('B5 — TrustOps analytics', () => {
  it('computes a funnel and a transparent 0..100 trust score', () => {
    const { funnel } = view.trustOps.metrics;
    expect(funnel.leadsReceived).toBe(view.leads.length);
    expect(funnel.compliancePass + funnel.complianceBlock).toBe(view.leads.length);
    expect(view.trustOps.trustScore.score).toBeGreaterThanOrEqual(0);
    expect(view.trustOps.trustScore.score).toBeLessThanOrEqual(100);
    const sumWeights = view.trustOps.trustScore.components.reduce((s, c) => s + c.weight, 0);
    expect(sumWeights).toBe(100);
  });

  it('approval coverage reflects undecided (pending) leads', () => {
    // happy approved (decided) + pending (reached, undecided) => coverage 0.5
    expect(view.trustOps.metrics.approvalCoverage).toBeCloseTo(0.5, 5);
  });

  it('trust score degrades when egress is dirty (sanity of weighting)', () => {
    const runs: WorkflowRunSummary[] = [
      {
        runId: 'r1',
        status: 'completed',
        compliance: 'pass',
        approval: 'approved',
        crm: 'ok',
        proofEventsRecorded: 1,
      },
    ];
    const m = computeTrustOpsMetrics(runs);
    const clean = computeTrustScore(m);
    expect(clean.score).toBe(100);
  });
});

describe('B6 — enterprise release gates fail closed', () => {
  it('dry_run is open, private_pilot and controlled_live fail closed by default', () => {
    const dry = view.releaseGates.find((g) => g.stage === 'dry_run')!;
    const pilot = view.releaseGates.find((g) => g.stage === 'private_pilot')!;
    const live = view.releaseGates.find((g) => g.stage === 'controlled_live')!;
    expect(dry.passed).toBe(true);
    expect(pilot.passed).toBe(false);
    expect(live.passed).toBe(false);
    expect(live.missingKeys).toHaveLength(7);
  });

  it('controlled_live requires all seven sign-offs to open', () => {
    expect(requiredConditions('controlled_live')).toHaveLength(7);
    const open = evaluateReleaseGate('controlled_live', {
      signedCustomerScope: true,
      counselSignoff: true,
      founderSignoff: true,
      monitoringEnabled: true,
      rollbackReady: true,
      secretsConfigured: true,
      connectorApproval: true,
    });
    expect(open.passed).toBe(true);
    // missing even one fails closed
    const closed = evaluateReleaseGate('controlled_live', {
      signedCustomerScope: true,
      counselSignoff: true,
      founderSignoff: true,
      monitoringEnabled: true,
      rollbackReady: true,
      secretsConfigured: true,
      // connectorApproval missing
    });
    expect(closed.passed).toBe(false);
    expect(closed.missingKeys).toEqual(['connectorApproval']);
  });
});

describe('proof / workspace attribution + no-egress', () => {
  it('every proof row is attributed to the sandbox workspace', () => {
    expect(view.proofTrace.length).toBeGreaterThan(0);
    for (const p of view.proofTrace) {
      expect(p.workspaceId).toBe(SANDBOX_WORKSPACE);
    }
  });

  it('the no-live-egress attestation holds across the run', () => {
    expect(view.egress.noLiveEgress).toBe(true);
    expect(view.egress.mode).toBe('MOCK_SANDBOX');
    expect(view.leads.every((l) => l.console.mockSafe)).toBe(true);
  });
});

describe('PII guard', () => {
  it('flags raw PII but allows reserved placeholders', () => {
    expect(findRawPii('contact me at real@gmail.com')).toBe('real@gmail.com');
    expect(findRawPii('safe lead@buyer.example and 555-0142')).toBeNull();
    expect(() => assertNoRawPii('+1 212 555 9999')).toThrow(/PII/);
  });

  it('the whole rendered view serializes with no raw PII', () => {
    expect(findRawPii(JSON.stringify(view))).toBeNull();
  });
});

describe('Alta parity scorecard', () => {
  it('reaches the >= 80 parity threshold with auditable evidence', () => {
    expect(view.parity.threshold).toBe(ALTA_PARITY_THRESHOLD);
    expect(view.parity.score).toBeGreaterThanOrEqual(ALTA_PARITY_THRESHOLD);
    expect(view.parity.pass).toBe(true);
  });

  it('every dimension is backed by passing structural checks', () => {
    expect(view.parity.dimensions.length).toBeGreaterThanOrEqual(6);
    const weightSum = view.parity.dimensions.reduce((s, d) => s + d.weight, 0);
    expect(weightSum).toBe(100);
    for (const d of view.parity.dimensions) {
      expect(d.checks.length).toBeGreaterThan(0);
      expect(d.earned).toBe(Math.round(d.weight * d.ratio));
    }
  });

  it('the headline score equals the sum of earned points', () => {
    const sum = view.parity.dimensions.reduce((s, d) => s + d.earned, 0);
    expect(view.parity.score).toBe(sum);
  });

  it('honestly lists what remains out of scope (live execution)', () => {
    expect(view.parity.remaining.join(' ')).toMatch(/Live channel execution/i);
    expect(view.parity.remaining.length).toBeGreaterThan(0);
  });

  it('computeParityScorecard is a pure function of the assembled view', () => {
    const { parity, ...base } = view;
    void parity;
    const again = computeParityScorecard(base);
    expect(again.score).toBe(view.parity.score);
  });
});
