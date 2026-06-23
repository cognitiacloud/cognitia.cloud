/**
 * SERVER-ONLY adapter for `/gtm-command-center`.
 *
 * This is the real integration. It imports the actual `@cognitia/agents`
 * modules (B1–B6 + the integration-hardening island) and RUNS them to produce
 * the Command Center data. There is NO hand-authored mirror here — every surface
 * is the output of real, tested module code:
 *
 *   - B1+B2+B3+B4+B5+B6: `assembleIntegratedRunPacket(...)` — the unified,
 *     mock-safe integrated run packet (audience score, workflow state, dry-run
 *     channel plans, CRM projection, TrustOps, release gate) for one lead.
 *   - B4 audience panel:  `buildAudience(...)` over a lawful fixture set.
 *   - B5 cross-lead:      `toWorkflowRunSummary(...)` + `buildTrustOpsReport(...)`.
 *   - B3 CRM read model:  `projectCrmLite(...)` + a real `createMockCrmLite`
 *     idempotency probe.
 *   - B6 release gates:   `evaluateReleaseGate(...)` for all three stages.
 *
 * Server-only because `@cognitia/agents` is a server/runtime package (and the
 * assembly entrypoint is async). It must never be imported by a client
 * component. The route (`page.tsx`) is a server component that awaits this.
 *
 * MOCK / DRY-RUN ONLY: mock ports (no IO), channel actions are typed `sent:false`,
 * CRM is in-memory, release gates fail closed. Tenant is the
 * `budget_wheels_demo` / Tenant Zero sandbox. A defensive `assertNoRawPii` runs
 * over the serialized result before it is returned.
 */

import type { RawGtmProspectInput } from '@cognitia/core';
import {
  assembleIntegratedRunPacket,
  buildAudience,
  buildTrustOpsReport,
  createMockCrmLite,
  evaluateReleaseGate,
  projectCrmLite,
  toWorkflowRunSummary,
  type AudienceInputRow,
  type GtmRunPacket,
  type IntegratedRunPacket,
  type Opportunity,
  type ReleaseStage,
  type TimelineEvent,
  type WorkflowRunSummary,
} from '@cognitia/agents';
import { toGtmAssemblyConsoleView, type GtmRunPacketView } from '../gtmOsAssemblyViewModel';
import {
  COMMAND_CENTER_BANNER,
  LIVE_BLOCKED_REASON,
  SANDBOX_WORKSPACE,
  assertNoRawPii,
  canProceed,
  computeParityScorecard,
  type CommandCenterLeadView,
  type CommandCenterView,
  type ProofTraceRow,
} from '../gtmCommandCenterViewModel';

/** Fixed sandbox clock so the route + tests are deterministic. */
const FIXED_NOW = new Date('2026-06-22T10:00:00.000Z');

/** Deterministic clock + id generator (distinct seed per lead avoids collisions). */
function deterministicDeps(seed: string): { now: () => Date; newId: () => string } {
  let counter = 0;
  return { now: () => FIXED_NOW, newId: () => `${seed}${(counter++).toString(36)}` };
}

const RELEASE_STAGE_ORDER: readonly ReleaseStage[] = [
  'dry_run',
  'private_pilot',
  'controlled_live',
];

/** Map a real B1 run packet into the existing PII-safe console view shape. */
function toPacketView(packet: GtmRunPacket): GtmRunPacketView {
  const status: GtmRunPacketView['status'] =
    packet.status === 'completed' || packet.status === 'awaiting_approval'
      ? packet.status
      : 'blocked';
  return {
    mode: 'mock',
    workspace: { workspaceId: packet.workspace.workspaceId, sandbox: packet.workspace.sandbox },
    prospect: {
      id: packet.prospect.id,
      companyName: packet.prospect.companyName,
      sourceRisk: packet.prospect.sourceRisk,
      consentStatus: packet.prospect.consentStatus,
      fitScore: packet.prospect.fitScore,
    },
    status,
    finalState: packet.finalState,
    blockedReason: packet.blockedReason,
    compliance: packet.compliance,
    approval: packet.approval,
    appointment: packet.appointment,
    crm: packet.crm,
    proofs: packet.proofs.map((p) => ({ kind: p.kind, summaryPublic: p.summaryPublic })),
    timeline: packet.timeline.map((t) => ({
      step: t.step,
      phase: t.phase,
      outcome: t.outcome,
      detail: t.detail,
    })),
    noEgress: { liveSendOccurred: false, statement: packet.noEgress.statement },
  };
}

/** Lawful B4 fixture rows — `.example` contacts only; two unlawful rows rejected. */
const AUDIENCE_ROWS: AudienceInputRow[] = [
  {
    id: 'p-001',
    companyName: 'Northshore Auto Group',
    source: 'consented_csv',
    fit: 0.9,
    urgency: 0.7,
    consentBasis: 'explicit_consent',
    evidence: 'verified_fact',
    region: 'BC',
    contactEmailExample: 'sales@northshore-auto.example',
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
  // Unlawful sources — the real builder must reject these (never scored).
  { id: 'p-bad', companyName: 'Scraped Listings LLC', source: 'maps_platform_scrape' },
  { id: 'p-apify', companyName: 'Apify Harvest Co', source: 'apify' },
];

/** The three leads driven through the real workflow (happy / pending / blocked). */
interface LeadSpec {
  seed: string;
  lead: RawGtmProspectInput;
  portOverrides?: Parameters<typeof assembleIntegratedRunPacket>[0]['portOverrides'];
}

// Letter-only (hex) seeds keep ids opaque + deterministic without resembling a
// phone/PII token to the defensive serialization guard.
const LEAD_SPECS: LeadSpec[] = [
  {
    seed: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa',
    lead: {
      companyName: 'Northshore Auto Group',
      source: 'public_registry',
      sourceRisk: 'low',
      contactBasis: 'conspicuously_published_business_contact',
      consentStatus: 'implied_possible',
      unsubscribeStatus: 'subscribed',
      doNotContact: false,
    },
  },
  {
    seed: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb',
    lead: {
      companyName: 'Budget Wheels Demo',
      source: 'public_registry',
      sourceRisk: 'low',
      contactBasis: 'conspicuously_published_business_contact',
      consentStatus: 'implied_possible',
      unsubscribeStatus: 'subscribed',
      doNotContact: false,
    },
    portOverrides: { approval: { status: 'pending', reason: 'Held for human review' } },
  },
  {
    seed: 'cccccccc-cccc-cccc-cccc-ccccccccccc',
    lead: {
      companyName: 'Do-Not-Contact Motors',
      source: 'public_registry',
      sourceRisk: 'high',
      consentStatus: 'do_not_contact',
      doNotContact: true,
    },
    portOverrides: { compliance: { status: 'blocked', reason: 'do_not_contact' } },
  },
];

/**
 * Run the real integrated modules and assemble the Command Center view. Async
 * because the assembly entrypoint is async (mock ports resolve in-memory, no IO).
 */
export async function loadCommandCenterData(): Promise<CommandCenterView> {
  // --- B1–B6: one real integrated run packet per lead ------------------------
  const packets: IntegratedRunPacket[] = [];
  for (const spec of LEAD_SPECS) {
    const deps = deterministicDeps(spec.seed);
    packets.push(
      await assembleIntegratedRunPacket({
        lead: spec.lead,
        workspaceId: SANDBOX_WORKSPACE,
        portOverrides: spec.portOverrides,
        now: deps.now,
        newId: deps.newId,
      }),
    );
  }

  const leads: CommandCenterLeadView[] = packets.map((packet) => {
    const view = toPacketView(packet.run);
    const proceed = canProceed(view);
    return {
      lead: {
        id: packet.run.prospect.id,
        companyName: packet.run.prospect.companyName,
        packet: view,
      },
      console: toGtmAssemblyConsoleView(view),
      // Real B2 dry-run plans, surfaced only for leads that may proceed.
      channelPlan: proceed ? packet.channelPlans : [],
    };
  });

  // --- B4: real lawful audience ranking (two unlawful rows rejected) ---------
  const audienceResult = buildAudience(AUDIENCE_ROWS);

  // --- B3: real CRM-lite read model for proceeding leads + idempotency probe --
  const records: Opportunity[] = [];
  const timeline: TimelineEvent[] = [];
  for (const packet of packets) {
    if (!canProceed(toPacketView(packet.run))) continue;
    const projection = projectCrmLite(packet.run, { now: () => FIXED_NOW });
    records.push(...projection.opportunities);
    timeline.push(...projection.timeline);
  }
  const idempotentRepeat = proveCrmIdempotency();

  // --- B5: real TrustOps across all runs (via the integration run-summary adapter) ---
  const summaries: WorkflowRunSummary[] = packets.map((p) => toWorkflowRunSummary(p.run));
  const trustReport = buildTrustOpsReport(summaries);

  // --- B6: real release gates (fail closed) ----------------------------------
  const releaseGates = RELEASE_STAGE_ORDER.map((stage) => evaluateReleaseGate(stage));
  const controlledLive = releaseGates.find((g) => g.stage === 'controlled_live');

  // Proof / workspace attribution trace across all leads (real proof events).
  const proofTrace: ProofTraceRow[] = packets.flatMap((packet) =>
    packet.run.proofs.map((p) => ({
      workspaceId: packet.run.workspace.workspaceId,
      prospectId: packet.run.prospect.id,
      company: packet.run.prospect.companyName,
      kind: p.kind,
      summary: p.summaryPublic ?? '(redacted)',
    })),
  );

  const base: Omit<CommandCenterView, 'parity'> = {
    banner: COMMAND_CENTER_BANNER,
    workspaceId: SANDBOX_WORKSPACE,
    sandbox: true,
    leads,
    audience: { ranked: audienceResult.prospects, rejected: audienceResult.rejected },
    crm: { records, timeline, idempotentRepeat },
    trustOps: { metrics: trustReport.metrics, trustScore: trustReport.score },
    releaseGates,
    proofTrace,
    egress: trustReport.metrics.egress,
    whyLiveBlocked: [
      LIVE_BLOCKED_REASON,
      'Dry-run channel actions are typed so `sent` can only ever be `false`.',
      'sendLive() always throws — the dry-run layer has no live code path.',
      `The controlled_live release gate fails closed (${controlledLive?.missing.length ?? 0} sign-offs missing).`,
    ],
    controlledLiveRequirements: controlledLive?.missing ?? [],
  };

  const view: CommandCenterView = { ...base, parity: computeParityScorecard(base) };

  // Defensive: never serve raw PII, even from real module output.
  assertNoRawPii(JSON.stringify(view));
  return view;
}

/** Prove B3 idempotency with the REAL CRM-lite: a repeat upsert adds no record. */
function proveCrmIdempotency(): boolean {
  const crm = createMockCrmLite({ now: () => FIXED_NOW });
  const company = crm.upsertCompany({
    workspaceId: SANDBOX_WORKSPACE,
    companyName: 'Northshore Auto Group',
  });
  const input = {
    workspaceId: SANDBOX_WORKSPACE,
    prospectId: 'idempotency-probe',
    companyId: company.id,
    stage: 'appointment_set' as const,
    appointmentRef: 'appt-1',
  };
  const first = crm.upsertOpportunity(input);
  const second = crm.upsertOpportunity(input); // same key — must not duplicate
  return first.id === second.id && crm.listOpportunities(SANDBOX_WORKSPACE).length === 1;
}
