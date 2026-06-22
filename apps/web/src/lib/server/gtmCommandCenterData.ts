/**
 * SERVER-ONLY adapter for `/gtm-command-center`.
 *
 * This is the real integration behind the investor-facing Command Center. It
 * imports the actual PR #158 lane modules AND PR #159's integration packet from
 * `@cognitia/agents` and runs them to produce every panel. There is NO
 * hand-authored structural mirror — each surface is real module output:
 *
 *   - B1 assembly:        `assembleGtmRunPacket(...)` (×3 deterministic runs)
 *   - B2 channels:        `evaluateChannelPolicy(...)` + `planDryRunAction(...)`
 *   - B3 CRM-lite:        `createMockCrmLite(...)` (idempotent upserts + timeline)
 *   - B4 audience:        `buildAudience(...)`
 *   - B5 TrustOps:        `buildTrustOpsReport(...)` (metrics + trust score + md)
 *   - B6 release gates:   `evaluateReleaseGate(...)`
 *   - Integration packet: `assembleIntegratedRunPacket(...)` +
 *                         `verifyIntegratedRunPacket(...)` — one verified
 *                         artifact composing B1–B6 for the headline lead.
 *
 * Two scorecards are computed OVER this real output:
 *   - the mock/dry-run capability-surface score (may reach 100/100), and
 *   - the HONEST official Alta implementation-parity estimate (NOT 100), whose
 *     blocked axes (persistence, route-bound enforcement, deployment, live) are
 *     declared explicitly so the number is conservative and auditable.
 *
 * Server-only because `@cognitia/agents` is a server/runtime package and the
 * assembly entrypoint is async. It must never be imported by a client
 * component. The route (`page.tsx`) is an async server component that awaits it.
 *
 * MOCK / DRY-RUN ONLY: channel actions are typed `sent:false`, CRM is in-memory,
 * release gates fail closed, `sendLive` always throws. Tenant is the
 * `budget_wheels_demo` / Tenant Zero sandbox. A defensive `assertNoRawPii` runs
 * over the serialized result before it is returned.
 */

import {
  assembleGtmRunPacket,
  type GtmRunPacket,
  assembleIntegratedRunPacket,
  verifyIntegratedRunPacket,
  toWorkflowRunSummary,
  projectCrmLite,
  planDryRunAction,
  evaluateChannelPolicy,
  type ChannelKind,
  createMockCrmLite,
  type Opportunity,
  type TimelineEvent,
  buildAudience,
  type AudienceInputRow,
  buildTrustOpsReport,
  evaluateReleaseGate,
  type ReleaseStage,
  type ReleaseGateResult,
} from '@cognitia/agents';
import { toGtmAssemblyConsoleView } from '../gtmOsAssemblyViewModel.js';
import { toPacketView } from './gtmPacketView.js';
import {
  COMMAND_CENTER_BANNER,
  SANDBOX_WORKSPACE,
  LIVE_BLOCKED_REASON,
  computeCapabilitySurfaceScore,
  computeImplementationParity,
  canProceed,
  assertNoRawPii,
  type AssembledView,
  type CommandCenterView,
  type CommandCenterLeadView,
  type ProofTraceRow,
} from '../gtmCommandCenterViewModel.js';

const RELEASE_STAGE_ORDER: readonly ReleaseStage[] = [
  'dry_run',
  'private_pilot',
  'controlled_live',
];

/** Channels previewed per proceeding lead (dry-run plans only). */
const DEMO_CHANNELS: readonly ChannelKind[] = ['email', 'sms', 'crm_writeback'];

/** Deterministic monotonic clock so the rendered view is stable across renders. */
function fixedClock(startIso = '2026-01-01T00:00:00.000Z'): () => Date {
  let t = Date.parse(startIso);
  return () => new Date(t++);
}

/** Deterministic id generator with a readable, stable prefix. */
function idGen(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

/**
 * Prove B3 idempotency with the real `MockCrmLite`: upserting the same
 * opportunity twice keeps exactly one record. Returns true iff the count is 1
 * after both upserts (a focused, real-module probe — no bespoke store).
 */
function proveCrmIdempotent(packet: GtmRunPacket, now: () => Date): boolean {
  const probe = createMockCrmLite({ now, newId: idGen('crm-probe') });
  const workspaceId = packet.workspace.workspaceId;
  const company = probe.upsertCompany({ workspaceId, companyName: packet.prospect.companyName });
  const input = {
    workspaceId,
    prospectId: packet.prospect.id,
    companyId: company.id,
    stage: 'appointment_set' as const,
    appointmentRef: 'appt-1',
  };
  probe.upsertOpportunity(input);
  const afterFirst = probe.listOpportunities(workspaceId).length;
  probe.upsertOpportunity(input); // idempotent — still one record
  const afterSecond = probe.listOpportunities(workspaceId).length;
  return afterFirst === 1 && afterSecond === 1;
}

/** Lawful + intentionally-unlawful fixture rows for the B4 audience panel. */
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
  // Unlawful sources — the real builder must reject these rows (no scraping).
  { id: 'p-scrape', companyName: 'Scraped Listings LLC', source: 'maps_platform_scrape' },
  { id: 'p-apify', companyName: 'Apify Harvest Co', source: 'apify' },
];

/**
 * Run the real integrated modules and assemble the Command Center view. Async
 * because the B1 assembly entrypoint is async (mock ports resolve in-memory,
 * no IO).
 */
export async function loadCommandCenterData(): Promise<CommandCenterView> {
  const now = fixedClock();

  // --- B1: three real runs — completed / awaiting-approval / compliance-blocked.
  const happy = await assembleGtmRunPacket({
    lead: {
      companyName: 'Northshore Auto Group',
      source: 'public_registry',
      sourceRisk: 'low',
      contactBasis: 'conspicuously_published_business_contact',
      consentStatus: 'implied_possible',
      unsubscribeStatus: 'subscribed',
      doNotContact: false,
    },
    workspaceId: SANDBOX_WORKSPACE,
    now,
    newId: idGen('happy'),
  });
  const pending = await assembleGtmRunPacket({
    lead: {
      companyName: 'Budget Wheels Demo',
      source: 'public_registry',
      consentStatus: 'implied_possible',
    },
    workspaceId: SANDBOX_WORKSPACE,
    portOverrides: { approval: { status: 'pending', reason: 'awaiting operator review' } },
    now,
    newId: idGen('pending'),
  });
  const blocked = await assembleGtmRunPacket({
    lead: {
      companyName: 'Do-Not-Contact Motors',
      source: 'public_registry',
      sourceRisk: 'high',
      consentStatus: 'do_not_contact',
      doNotContact: true,
    },
    workspaceId: SANDBOX_WORKSPACE,
    portOverrides: { compliance: { status: 'blocked', reason: 'do_not_contact' } },
    now,
    newId: idGen('blocked'),
  });

  const packets: GtmRunPacket[] = [happy, pending, blocked];

  // Per-lead: real console view + real B2 policy + real dry-run plans (if proceeding).
  const leads: CommandCenterLeadView[] = packets.map((packet) => {
    const view = toPacketView(packet);
    const proceed = canProceed(view);
    const policy = evaluateChannelPolicy({
      channel: 'email',
      consent: packet.approval.status === 'approved' && !packet.compliance.blocked,
      approval: packet.approval.status,
      workspaceId: packet.workspace.workspaceId,
      live: false,
    });
    const channelPlan = proceed
      ? DEMO_CHANNELS.map((channel) =>
          planDryRunAction(channel, {
            workspaceId: packet.workspace.workspaceId,
            prospectId: packet.prospect.id,
          }),
        )
      : [];
    return {
      id: packet.prospect.id,
      company: packet.prospect.companyName,
      packet,
      console: toGtmAssemblyConsoleView(view),
      channelPlan,
      policy,
    };
  });

  // --- B3: real CRM-lite. Project the proceeding (completed) lead through the
  //     real B3 projection (entity graph + ordered operator timeline), then
  //     prove idempotency with a focused double-upsert probe (count stays 1).
  const proceedingPacket = packets.find((p) => canProceed(toPacketView(p)) && p.crm.written);
  let crmRecords: Opportunity[] = [];
  let crmTimeline: TimelineEvent[] = [];
  let idempotentRepeat = true;
  if (proceedingPacket) {
    const projection = projectCrmLite(proceedingPacket, { now, newId: idGen('crm') });
    crmRecords = projection.opportunities;
    crmTimeline = projection.timeline;
    idempotentRepeat = proveCrmIdempotent(proceedingPacket, now);
  }

  // --- B4: real audience ranking (scraped/apify sources rejected).
  const audienceResult = buildAudience(AUDIENCE_ROWS);

  // --- B5: real TrustOps over the real runs (metrics + trust score + markdown).
  const summaries = packets.map(toWorkflowRunSummary);
  const report = buildTrustOpsReport(summaries);

  // --- B6: real release gates (all three stages; live fails closed).
  const releaseGates: ReleaseGateResult[] = RELEASE_STAGE_ORDER.map((stage) =>
    evaluateReleaseGate(stage),
  );
  const controlled = releaseGates.find((g) => g.stage === 'controlled_live')!;

  // --- Integration packet (PR #159): one verified artifact composing B1–B6 for
  //     the headline (completed) lead. assembleIntegratedRunPacket asserts no
  //     live egress + no raw PII at build time before returning.
  const integratedPacket = await assembleIntegratedRunPacket({
    lead: {
      companyName: 'Northshore Auto Group',
      source: 'public_registry',
      sourceRisk: 'low',
      contactBasis: 'conspicuously_published_business_contact',
      consentStatus: 'implied_possible',
      unsubscribeStatus: 'subscribed',
      doNotContact: false,
    },
    workspaceId: SANDBOX_WORKSPACE,
    audienceRow: { source: 'consented_csv', fit: 0.9, urgency: 0.8, evidence: 'verified_fact' },
    now,
    newId: idGen('integrated'),
  });
  const completeness = verifyIntegratedRunPacket(integratedPacket);

  // Proof / workspace attribution trace across all leads.
  const proofTrace: ProofTraceRow[] = leads.flatMap((l) =>
    l.packet.proofs.map((p) => ({
      workspaceId: l.packet.workspace.workspaceId,
      prospectId: l.id,
      company: l.company,
      kind: p.kind,
      summary: p.summaryPublic ?? '(redacted)',
    })),
  );

  const base: AssembledView = {
    banner: COMMAND_CENTER_BANNER,
    workspaceId: SANDBOX_WORKSPACE,
    sandbox: true,
    leads,
    audience: { ranked: audienceResult.prospects, rejected: audienceResult.rejected },
    crm: { records: crmRecords, timeline: crmTimeline, idempotentRepeat },
    trustOps: {
      metrics: report.metrics,
      trustScore: report.score,
      reportMarkdown: report.markdown,
    },
    releaseGates,
    proofTrace,
    egress: report.metrics.egress,
    whyLiveBlocked: [
      LIVE_BLOCKED_REASON,
      'Real B2 dry-run actions are typed so `sent` can only ever be false.',
      'sendLive() always throws — the dry-run layer has no live code path.',
      `Real B6 controlled_live gate is not satisfied: missing ${controlled.missing.length} condition(s).`,
    ],
    controlledLiveRequirements: controlled.missing,
    integrated: { packet: integratedPacket, completeness },
    source: 'real-agents-modules',
  };

  // Scorecard 1 — mock/dry-run capability surface (computed over real output).
  const capabilitySurface = computeCapabilitySurfaceScore(base);

  // Scorecard 2 — HONEST official Alta implementation parity. Most flags are
  // derived from the assembled real output; build/persistence/enforcement/
  // deploy/live are explicit known facts about this branch (verified by
  // `pnpm check` + a real `next build`, recorded in the evidence doc).
  const implementationParity = computeImplementationParity({
    realModuleIntegration: base.source === 'real-agents-modules',
    integratedPacketComplete: completeness.complete,
    visibleRoute: true,
    dryRunSafety:
      leads.flatMap((l) => l.channelPlan).every((a) => a.sent === false) &&
      integratedPacket.attestation.noLiveEgress === true,
    laneBreadth:
      audienceResult.prospects.length > 0 &&
      crmRecords.length > 0 &&
      releaseGates.length === 3 &&
      report.score.components.length === 4,
    // Verified out-of-band on this branch:
    buildProvable: true, // next build green with transpilePackages (see evidence doc)
    // Genuinely not yet implemented (kept at zero — conservative + honest):
    persistence: false,
    routeBoundEnforcement: false,
    // Separate out-of-scope axes (must stay false in any overnight/mock lane):
    reachableDeployment: false,
    liveAutomationReadiness: false,
  });

  const data: CommandCenterView = { ...base, capabilitySurface, implementationParity };

  // Defensive: never serve raw PII, even from real module output.
  assertNoRawPii(JSON.stringify(data));
  return data;
}
