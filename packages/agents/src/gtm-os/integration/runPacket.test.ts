import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RawGtmProspectInput } from '@cognitia/core';
import {
  assembleIntegratedRunPacket,
  assertIntegratedPacketNoRawPii,
  REQUIRED_PACKET_SECTIONS,
  verifyIntegratedRunPacket,
  type IntegratedRunPacket,
} from './runPacket.js';
import { assertNoLiveSend, LiveSendBlockedError, sendLive } from '../../channels/dryRunChannels.js';

const FIXED_ID = '33333333-3333-3333-3333-333333333333';
const FIXED_NOW = new Date('2026-06-22T00:00:00.000Z');

/** Mock-safe fixture lead — business-only, `.example` domain, no raw PII. */
const FIXTURE_LEAD: RawGtmProspectInput = {
  companyName: 'Budget Wheels Demo Dealership',
  website: 'https://budget-wheels.example',
  city: 'Toronto',
  provinceOrState: 'ON',
  country: 'CA',
  businessType: 'auto_dealership',
  source: 'public_registry',
  sourceUrl: 'https://registry.example/budget-wheels',
  sourceRisk: 'low',
  contactRole: 'General Manager',
  contactBasis: 'conspicuously_published_business_contact',
  consentStatus: 'implied_possible',
  unsubscribeStatus: 'subscribed',
  doNotContact: false,
};

function buildPacket(
  opts: Partial<Parameters<typeof assembleIntegratedRunPacket>[0]> = {},
): Promise<IntegratedRunPacket> {
  let counter = 0;
  return assembleIntegratedRunPacket({
    lead: FIXTURE_LEAD,
    now: () => FIXED_NOW,
    newId: () => `${FIXED_ID.slice(0, -1)}${(counter++).toString(36)}`,
    ...opts,
  });
}

/* ============================================================ integration test */

describe('assembleIntegratedRunPacket — packet completeness', () => {
  it('produces one unified packet combining all eight required sections', async () => {
    const packet = await buildPacket();

    // The schema + mode are stamped, and the verifier reports completeness.
    expect(packet.schema).toBe('cognitia.gtm.integrated_run_packet.v1');
    expect(packet.mode).toBe('mock');

    const completeness = verifyIntegratedRunPacket(packet);
    expect(completeness.complete).toBe(true);
    expect(completeness.missing).toEqual([]);
    expect(completeness.present).toEqual([...REQUIRED_PACKET_SECTIONS]);

    // 1. audience score (B4)
    expect(packet.audience.score.score).toBeGreaterThan(0);
    expect(packet.audience.prospect.id).toBe(packet.run.prospect.id);
    // 2. workflow state (B1) — happy path completes
    expect(packet.run.status).toBe('completed');
    expect(packet.run.finalState).toBe('completed');
    // 3. workspace_id (B1)
    expect(packet.workspaceId).toBe('budget_wheels_demo');
    expect(packet.run.workspace.workspaceId).toBe('budget_wheels_demo');
    // 4. dry-run channel plans (B2) — one per modelled channel, all unsent
    expect(packet.channelPlans.length).toBe(7);
    expect(packet.channelPlans.every((p) => p.mode === 'dry_run' && p.sent === false)).toBe(true);
    // 5. CRM-lite timeline (B3)
    expect(packet.crm.companies.length).toBe(1);
    expect(packet.crm.opportunities[0]?.stage).toBe('proposal');
    expect(packet.crm.timeline.length).toBeGreaterThan(0);
    // 6. TrustOps report (B5)
    expect(packet.trustOps.markdown).toContain('TrustOps Analytics Report');
    expect(packet.trustOps.score.score).toBe(100);
    // 7. release gate result (B6) — operative dry_run passes, live fails closed
    expect(packet.releaseGate.operative.passed).toBe(true);
    expect(packet.releaseGate.controlledLive.passed).toBe(false);
    expect(packet.releaseGate.controlledLive.missing.length).toBeGreaterThan(0);
    // 8. proof / action trace (B1)
    expect(packet.run.proofs.map((e) => e.kind)).toEqual([
      'gtm.discovery.booked.v1',
      'gtm.proposal.generated.v1',
    ]);
    expect(packet.run.timeline.length).toBe(6);
  });

  it('is deterministic given injected now/newId', async () => {
    const a = await buildPacket();
    const b = await buildPacket();
    expect(a).toEqual(b);
  });

  it('stays honest on a compliance-blocked run: still complete, but halted state', async () => {
    const packet = await buildPacket({
      portOverrides: { compliance: { status: 'blocked', reason: 'legal review pending' } },
    });

    expect(verifyIntegratedRunPacket(packet).complete).toBe(true);
    expect(packet.run.status).toBe('blocked');
    expect(packet.run.finalState).toBe('blocked_compliance');
    expect(packet.crm.opportunities[0]?.stage).toBe('lead');
    expect(packet.trustOps.metrics.funnel.complianceBlock).toBe(1);
    // No proofs were produced, but the action trace (timeline) still exists.
    expect(packet.run.proofs).toEqual([]);
    expect(packet.run.timeline.length).toBeGreaterThan(0);
  });

  it('reports missing sections rather than silently passing an incomplete packet', async () => {
    const packet = await buildPacket();
    const broken = {
      ...packet,
      channelPlans: [],
      audience: undefined,
    } as unknown as IntegratedRunPacket;
    const result = verifyIntegratedRunPacket(broken);
    expect(result.complete).toBe(false);
    expect(result.missing).toContain('dry_run_channel_plans');
    expect(result.missing).toContain('audience_score');
  });
});

/* ================================================================= safety test */

describe('assembleIntegratedRunPacket — no live egress / no raw PII', () => {
  it('emits no live egress and carries no raw PII anywhere in the packet', async () => {
    const packet = await buildPacket();

    // No live egress: every channel plan is a non-sent dry-run plan, the combined
    // attestation says so, and each plan passes the runtime no-live-send tripwire.
    expect(packet.attestation.noLiveEgress).toBe(true);
    expect(packet.run.noEgress.liveSendOccurred).toBe(false);
    expect(packet.trustOps.metrics.egress.noLiveEgress).toBe(true);
    for (const plan of packet.channelPlans) {
      expect(plan.sent).toBe(false);
      expect(plan.wouldSendIfLive.liveStatus).toBe('BLOCKED');
      expect(() => assertNoLiveSend(plan)).not.toThrow();
    }

    // The live send path is fail-closed for every channel.
    for (const plan of packet.channelPlans) {
      expect(() =>
        sendLive(plan.channel, { workspaceId: packet.workspaceId, prospectId: plan.prospectId }),
      ).toThrow(LiveSendBlockedError);
    }

    // No raw PII: only reserved-TLD synthetic emails (e.g. lead@buyer.example) may
    // appear; the packet-level scan accepts those and the prospect exposes no
    // contact-identity fields.
    expect(() => assertIntegratedPacketNoRawPii(packet)).not.toThrow();
    expect('contactName' in packet.run.prospect).toBe(false);
    expect('contactEmailHash' in packet.run.prospect).toBe(false);
    const serialized = JSON.stringify(packet);
    // Every email-shaped token uses a reserved fictional TLD.
    for (const match of serialized.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []) {
      expect(match.toLowerCase()).toMatch(/\.(example|test|invalid)$/);
    }
  });

  it('the PII scan throws when a real-looking email is injected', () => {
    const poisoned = {
      schema: 'cognitia.gtm.integrated_run_packet.v1',
      crm: { timeline: [{ summary: 'contact attacker@gmail.com' }] },
    } as unknown as IntegratedRunPacket;
    expect(() => assertIntegratedPacketNoRawPii(poisoned)).toThrow(/raw email PII/);
  });

  it('rejects a row from a disallowed audience source rather than scoring it', async () => {
    await expect(buildPacket({ audienceRow: { source: 'scraped_google_maps' } })).rejects.toThrow(
      /audience row was rejected/,
    );
  });
});

/* ===================================================== no network/vendor imports */

describe('mock-safety: no network/vendor imports in the integration sources', () => {
  it('production sources import no network/DB/vendor primitives', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const banned =
      /\b(fetch|child_process|node:net|node:http|node:https|node:tls|axios|ApifyClient|new\s+Anthropic|Twilio)\b/;
    for (const file of readdirSync(here).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
    )) {
      const src = readFileSync(join(here, file), 'utf8');
      expect(banned.test(src), `${file} must make no network/vendor calls`).toBe(false);
      expect(src.includes('@cognitia/db')).toBe(false);
      expect(src.includes('@cognitia/integrations')).toBe(false);
    }
  });
});
