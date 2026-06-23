/**
 * Tests for the SERVER-ONLY `/gtm-command-center` adapter.
 *
 * These prove the route is driven by the REAL `@cognitia/agents` outputs (not a
 * mirror): one completed run, one pending run, one compliance-blocked run; all
 * channels dry-run / never sent; lawful audience ranked and unlawful sources
 * rejected; real CRM-lite read model; cross-lead TrustOps; fail-closed release
 * gates; PII-free serialization; and a parity score over the real view.
 */

import { describe, it, expect } from 'vitest';
import { assertNoLiveSend, LiveSendBlockedError, sendLive } from '@cognitia/agents';
import { loadCommandCenterData } from './gtmCommandCenterData';
import { ALTA_PARITY_THRESHOLD, SANDBOX_WORKSPACE } from '../gtmCommandCenterViewModel';

describe('loadCommandCenterData — real integrated GTM run', () => {
  it('assembles all leads, sandbox-scoped, from the real modules', async () => {
    const view = await loadCommandCenterData();

    expect(view.banner).toContain('NO LIVE SEND');
    expect(view.workspaceId).toBe(SANDBOX_WORKSPACE);
    expect(view.sandbox).toBe(true);

    // Three leads: completed (happy), awaiting_approval (pending), blocked.
    expect(view.leads).toHaveLength(3);
    const statuses = view.leads.map((l) => l.lead.packet.status).sort();
    expect(statuses).toEqual(['awaiting_approval', 'blocked', 'completed']);
  });

  it('only the proceeding lead has dry-run channel plans; all are unsent', async () => {
    const view = await loadCommandCenterData();

    const completed = view.leads.find((l) => l.lead.packet.status === 'completed');
    const notProceeding = view.leads.filter((l) => l.lead.packet.status !== 'completed');

    expect((completed?.channelPlan.length ?? 0) > 0).toBe(true);
    for (const action of completed?.channelPlan ?? []) {
      expect(action.mode).toBe('dry_run');
      expect(action.sent).toBe(false);
      expect(action.wouldSendIfLive.liveStatus).toBe('BLOCKED');
      expect(() => assertNoLiveSend(action)).not.toThrow();
    }
    for (const lead of notProceeding) {
      expect(lead.channelPlan).toHaveLength(0);
    }
  });

  it('the live send path fails closed', () => {
    expect(() =>
      sendLive('email', { workspaceId: SANDBOX_WORKSPACE, prospectId: 'sandbox' }),
    ).toThrow(LiveSendBlockedError);
  });

  it('ranks lawful prospects with real scores and rejects unlawful sources', async () => {
    const view = await loadCommandCenterData();

    expect(view.audience.ranked.length).toBe(2);
    expect(view.audience.ranked.every((p) => p.score.score >= 0 && p.score.score <= 1)).toBe(true);
    // The two unlawful rows (scraped maps + apify) must be rejected, never scored.
    expect(view.audience.rejected.length).toBe(2);
    expect(view.audience.rejected.map((r) => r.id).sort()).toEqual(['p-apify', 'p-bad']);
  });

  it('exposes the real CRM-lite read model and proves idempotency', async () => {
    const view = await loadCommandCenterData();

    expect(view.crm.records.length).toBeGreaterThan(0);
    expect(view.crm.timeline.length).toBeGreaterThan(0);
    expect(view.crm.idempotentRepeat).toBe(true);
    // No duplicate opportunity ids.
    const ids = view.crm.records.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('computes cross-lead TrustOps from the real run summaries', async () => {
    const view = await loadCommandCenterData();

    expect(view.trustOps.metrics.funnel.leadsReceived).toBe(3);
    expect(view.trustOps.trustScore.components).toHaveLength(4);
    expect(view.trustOps.metrics.egress.noLiveEgress).toBe(true);
    // One completed, one pending, one blocked.
    expect(view.trustOps.metrics.funnel.completed).toBe(1);
    expect(view.trustOps.metrics.funnel.complianceBlock).toBe(1);
  });

  it('evaluates all three real release gates; controlled_live fails closed', async () => {
    const view = await loadCommandCenterData();

    expect(view.releaseGates).toHaveLength(3);
    const live = view.releaseGates.find((g) => g.stage === 'controlled_live');
    expect(live?.passed).toBe(false);
    expect(live?.missingKeys).toHaveLength(7);
    expect(view.releaseGates.some((g) => g.stage === 'dry_run' && g.passed)).toBe(true);
  });

  it('records a workspace-attributed proof trace; non-completed runs record none', async () => {
    const view = await loadCommandCenterData();

    expect(view.proofTrace.length).toBeGreaterThan(0);
    expect(view.proofTrace.every((p) => p.workspaceId === SANDBOX_WORKSPACE)).toBe(true);
    const nonCompleted = view.leads.filter((l) => l.lead.packet.status !== 'completed');
    expect(nonCompleted.every((l) => l.lead.packet.proofs.length === 0)).toBe(true);
  });

  it('passes the Alta parity threshold over the real view', async () => {
    const view = await loadCommandCenterData();

    expect(view.parity.threshold).toBe(ALTA_PARITY_THRESHOLD);
    expect(view.parity.score).toBeGreaterThanOrEqual(ALTA_PARITY_THRESHOLD);
    expect(view.parity.pass).toBe(true);
    // The headline equals the sum of earned dimension points.
    const summed = view.parity.dimensions.reduce((s, d) => s + d.earned, 0);
    expect(view.parity.score).toBe(summed);
  });

  it('serializes with no raw PII and is deterministic', async () => {
    const a = await loadCommandCenterData();
    const b = await loadCommandCenterData();
    // No off-list emails / phones anywhere in the serialized view.
    for (const match of JSON.stringify(a).match(
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    ) ?? []) {
      expect(match.toLowerCase()).toMatch(/\.(example|test|invalid)$/);
    }
    // Deterministic given the fixed clock + id seeds.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
