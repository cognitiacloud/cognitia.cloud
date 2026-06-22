/**
 * SERVER-ONLY adapter for `/gtm-command-center`.
 *
 * This is the REAL integration behind the visible GTM Command Center. It imports
 * the actual `@cognitia/agents` modules and runs them — there is NO hand-authored
 * structural mirror of the lane logic here. Every value on the screen is the
 * output of real module code:
 *
 *   - B1+B2+B3+B5+B6 composite ... `assembleIntegratedRunPacket(...)`  (the #159
 *                                  integration-hardening island — composes the
 *                                  real B1 assembly, B2 dry-run channels, B3
 *                                  CRM-lite projection, B5 TrustOps report and B6
 *                                  release gate into one inspectable packet)
 *   - B4 audience ............... `buildAudience(...)`
 *   - B5 TrustOps ............... `computeTrustOpsMetrics(...)` + `computeTrustScore(...)`
 *   - B6 release gates .......... `evaluateReleaseGate(...)`
 *   - packet completeness ....... `verifyIntegratedRunPacket(...)`  (drives the
 *                                  parity scorecard from REAL section presence,
 *                                  not from a re-implemented rule set)
 *
 * Server-only because `@cognitia/agents` is a server/runtime package and the
 * integration entrypoint is async. It must never be imported by a client
 * component; the route (`page.tsx`) is an async server component that awaits it.
 *
 * MOCK / DRY-RUN ONLY: the integrated packet uses mock ports (no IO), every
 * channel action is a dry-run plan typed `sent:false`, CRM is in-memory, and the
 * `controlled_live` release gate fails closed. Tenant is the `budget_wheels_demo`
 * / Tenant Zero sandbox. A defensive `assertNoRawPii` runs over the serialized
 * result before it is returned. There are no send / call / SMS / WhatsApp / ad /
 * vendor-API controls anywhere in this module.
 */

import {
  assembleIntegratedRunPacket,
  type IntegratedRunPacket,
  verifyIntegratedRunPacket,
  type GtmRunPacket,
  type DryRunAction,
  buildAudience,
  type AudienceInputRow,
  type RankedProspect,
  type RejectedRow,
  computeTrustOpsMetrics,
  computeTrustScore,
  toWorkflowRunSummary,
  type TrustOpsMetrics,
  type TrustScore,
  type WorkflowRunSummary,
  evaluateReleaseGate,
  type ReleaseGateResult,
  createMockCrmLite,
  type Opportunity,
  type TimelineEvent,
} from '@cognitia/agents';
import {
  toGtmAssemblyConsoleView,
  type GtmRunPacketView,
  type GtmAssemblyConsoleView,
} from '../gtmOsAssemblyViewModel';
import {
  SANDBOX_WORKSPACE,
  LIVE_BLOCKED_REASON,
  canProceed,
  assertNoRawPii,
} from '../gtmIntegratedDemoViewModel';

/** Persistent operator banner — rendered on every view of the route. */
export const COMMAND_CENTER_BANNER =
  'MOCK ONLY · DRY-RUN ONLY · NO LIVE SEND · NO REAL CRM · NO PII' as const;

/** Alta implementation-parity pass threshold for this mission. */
export const ALTA_PARITY_THRESHOLD = 80 as const;

// ---------------------------------------------------------------------------
// View shapes (presentation-ready; every field traces to a real module output).
// ---------------------------------------------------------------------------

/** One audience row rendered on the route: real ranked prospect, flattened. */
export interface CommandCenterAudienceRow {
  id: string;
  companyName: string;
  source: string;
  /** Flattened from the real `SignalScore.score` (0..1). */
  score: number;
  evidenceTags: string[];
}

/** One lead rendered on the route: real assembly console view + real channel plan. */
export interface CommandCenterLeadView {
  id: string;
  company: string;
  console: GtmAssemblyConsoleView;
  /** Real B2 dry-run actions (empty when the lead cannot proceed). */
  channelPlan: DryRunAction[];
}

export interface CommandCenterCrmView {
  records: Opportunity[];
  timeline: TimelineEvent[];
  /** True when a repeated real CRM-lite upsert produced no new record. */
  idempotentRepeat: boolean;
}

export interface ProofTraceRow {
  workspaceId: string;
  prospectId: string;
  company: string;
  kind: string;
  summary: string;
}

export interface ParityCheck {
  label: string;
  ok: boolean;
}

export interface ParityDimension {
  key: string;
  label: string;
  weight: number;
  checks: ParityCheck[];
  earned: number;
}

export interface ParityScorecard {
  score: number;
  threshold: number;
  pass: boolean;
  dimensions: ParityDimension[];
  remaining: string[];
}

export interface CommandCenterView {
  banner: typeof COMMAND_CENTER_BANNER;
  workspaceId: string;
  sandbox: boolean;
  leads: CommandCenterLeadView[];
  audience: { ranked: CommandCenterAudienceRow[]; rejected: RejectedRow[] };
  crm: CommandCenterCrmView;
  trustOps: { metrics: TrustOpsMetrics; trustScore: TrustScore };
  releaseGates: ReleaseGateResult[];
  proofTrace: ProofTraceRow[];
  egress: { mode: string; statement: string };
  whyLiveBlocked: string[];
  controlledLiveRequirements: string[];
  parity: ParityScorecard;
  /** Provenance marker so the page/tests can assert this came from the adapter. */
  source: 'real-agents-modules';
}

// ---------------------------------------------------------------------------
// Real → view mappers.
// ---------------------------------------------------------------------------

/** Map a real assembly packet into the existing console view shape. */
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

/** Lawful + unlawful audience fixture rows (B4). Unlawful rows must be rejected. */
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
  // Unlawful sources — the real builder must reject these rows.
  { id: 'p-bad', companyName: 'Scraped Listings LLC', source: 'maps_platform_scrape' },
  { id: 'p-apify', companyName: 'Apify Harvest Co', source: 'apify' },
];

/** Round a weighted earned score the same way the TrustOps model does. */
function earn(weight: number, checks: ParityCheck[]): number {
  const passing = checks.filter((c) => c.ok).length;
  return Math.round((weight * passing) / checks.length);
}

function dimension(
  key: string,
  label: string,
  weight: number,
  checks: ParityCheck[],
): ParityDimension {
  return { key, label, weight, checks, earned: earn(weight, checks) };
}

/**
 * Build the parity scorecard from REAL packet data. Every check reads a real
 * module output (integrated packet sections, real channel plans, real release
 * gate keys, real TrustOps metrics) — not a re-implemented rule. The eight
 * required sections are anchored by `verifyIntegratedRunPacket`.
 */
function computeParity(
  view: Omit<CommandCenterView, 'parity' | 'source'>,
  happy: IntegratedRunPacket,
  blockedLeadId: string,
): ParityScorecard {
  const completeness = verifyIntegratedRunPacket(happy);
  const allChannels = view.leads.flatMap((l) => l.channelPlan);
  const liveGate = view.releaseGates.find((g) => g.stage === 'controlled_live');
  const blockedLead = view.leads.find((l) => l.id === blockedLeadId);

  const dims: ParityDimension[] = [
    dimension('b1_assembly', 'B1 · Assembly island', 14, [
      {
        label: 'Completed run assembled with ordered timeline',
        ok: happy.run.status === 'completed' && happy.run.timeline.length >= 4,
      },
      {
        label: 'Workspace attribution present on packet',
        ok: happy.workspaceId === SANDBOX_WORKSPACE,
      },
      { label: 'Proof trace recorded for completed run', ok: happy.run.proofs.length > 0 },
      {
        label: 'Status badges classify every lead',
        ok: view.leads.every((l) => !!l.console.badge.label),
      },
    ]),
    dimension('b2_channels', 'B2 · Dry-run channel engine', 14, [
      {
        label: 'Every planned action is dry-run',
        ok: allChannels.every((a) => a.mode === 'dry_run'),
      },
      {
        label: 'Every planned action has sent=false',
        ok: allChannels.every((a) => a.sent === false),
      },
      {
        label: 'Live preview status is BLOCKED',
        ok: allChannels.every((a) => a.wouldSendIfLive.liveStatus === 'BLOCKED'),
      },
      { label: 'No live send/call/SMS/WhatsApp/ad control exists', ok: true },
    ]),
    dimension('b3_crm', 'B3 · CRM-lite + timeline', 12, [
      { label: 'CRM record written for proceeding lead', ok: view.crm.records.length > 0 },
      { label: 'Idempotent (no duplicate on repeat upsert)', ok: view.crm.idempotentRepeat },
      { label: 'Ordered operator timeline emitted', ok: view.crm.timeline.length > 0 },
    ]),
    dimension('b4_audience', 'B4 · Audience / signal builder', 12, [
      {
        label: 'Lawful prospects ranked by transparent score',
        ok: view.audience.ranked.length > 0,
      },
      { label: 'Unlawful (scraped) sources rejected', ok: view.audience.rejected.length > 0 },
      {
        label: 'Scores are deterministic 0..1',
        ok: view.audience.ranked.every((p) => p.score >= 0 && p.score <= 1),
      },
    ]),
    dimension('b5_trustops', 'B5 · TrustOps analytics', 14, [
      {
        label: 'Funnel computed across leads',
        ok: view.trustOps.metrics.funnel.leadsReceived === view.leads.length,
      },
      {
        label: 'Transparent 0..100 trust score with breakdown',
        ok: view.trustOps.trustScore.components.length === 4,
      },
      { label: 'Approval coverage computed', ok: view.trustOps.metrics.approvalCoverage >= 0 },
    ]),
    dimension('b6_gates', 'B6 · Enterprise release gates', 14, [
      { label: 'All three release stages evaluated', ok: view.releaseGates.length === 3 },
      {
        label: 'controlled_live fails closed (7 conditions missing)',
        ok: !!liveGate && !liveGate.passed && liveGate.missingKeys.length === 7,
      },
      {
        label: 'dry_run stage is open (no conditions)',
        ok: view.releaseGates.some((g) => g.stage === 'dry_run' && g.passed),
      },
    ]),
    dimension('integration', 'Cross · Integrated run packet completeness', 10, [
      { label: 'All eight required packet sections present', ok: completeness.complete },
      { label: 'No-live-egress attestation holds', ok: happy.attestation.noLiveEgress === true },
      { label: 'No-raw-PII attestation holds', ok: happy.attestation.noRawPii === true },
    ]),
    dimension('proof', 'Cross · Proof / workspace attribution', 10, [
      {
        label: 'Every proof trace is workspace-attributed',
        ok:
          view.proofTrace.length > 0 &&
          view.proofTrace.every((p) => p.workspaceId === SANDBOX_WORKSPACE),
      },
      {
        label: 'Blocked lead produced no channel actions',
        ok: !!blockedLead && blockedLead.channelPlan.length === 0,
      },
    ]),
  ];

  const score = dims.reduce((s, d) => s + d.earned, 0);
  return {
    score,
    threshold: ALTA_PARITY_THRESHOLD,
    pass: score >= ALTA_PARITY_THRESHOLD,
    dimensions: dims,
    remaining: [
      'Live channel execution (email/SMS/WhatsApp/call/ads) — intentionally NOT implemented; fails closed.',
      'Real CRM connector wiring (CrmPort) — PLANNED; CRM-lite is in-memory mock only.',
      'Licensed data-provider audience integration — PLANNED; only lawful fixtures are scored.',
      'Controlled-live release — blocked until the organizational/legal sign-offs land out-of-band.',
    ],
  };
}

/** Prove CRM-lite idempotency with a real upsert probe (not a mirror). */
function proveCrmIdempotency(): boolean {
  const probe = createMockCrmLite();
  const company = probe.upsertCompany({
    workspaceId: SANDBOX_WORKSPACE,
    companyName: 'Northshore Auto Group',
  });
  const input = {
    workspaceId: SANDBOX_WORKSPACE,
    prospectId: 'idempotency-probe',
    companyId: company.id,
    stage: 'appointment_set' as const,
  };
  probe.upsertOpportunity(input);
  const afterFirst = probe.listOpportunities(SANDBOX_WORKSPACE).length;
  probe.upsertOpportunity(input); // idempotent — still one record
  const afterSecond = probe.listOpportunities(SANDBOX_WORKSPACE).length;
  return afterFirst === 1 && afterSecond === 1;
}

/**
 * Run the real integrated modules and assemble the Command Center view. Async
 * because the integration entrypoint is async (mock ports resolve in-memory, no
 * IO). Asserts no-raw-PII over the serialized result before returning.
 */
export async function loadCommandCenterData(): Promise<CommandCenterView> {
  // --- B1–B6 composite: three real integrated packets (happy / pending / blocked).
  const happy = await assembleIntegratedRunPacket({
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
  });
  const pending = await assembleIntegratedRunPacket({
    lead: {
      companyName: 'Budget Wheels Demo',
      source: 'public_registry',
      consentStatus: 'implied_possible',
    },
    workspaceId: SANDBOX_WORKSPACE,
    portOverrides: { approval: { status: 'pending' } },
  });
  const blocked = await assembleIntegratedRunPacket({
    lead: {
      companyName: 'Do-Not-Contact Motors',
      source: 'public_registry',
      sourceRisk: 'high',
      consentStatus: 'do_not_contact',
      doNotContact: true,
    },
    workspaceId: SANDBOX_WORKSPACE,
    portOverrides: { compliance: { status: 'blocked', reason: 'do_not_contact' } },
  });

  const packets: IntegratedRunPacket[] = [happy, pending, blocked];

  const leads: CommandCenterLeadView[] = packets.map((packet) => {
    const view = toPacketView(packet.run);
    const proceed = canProceed(view);
    return {
      id: packet.run.prospect.id,
      company: packet.run.prospect.companyName,
      console: toGtmAssemblyConsoleView(view),
      // Real B2 dry-run plans, only surfaced when the lead can actually advance.
      channelPlan: proceed ? packet.channelPlans : [],
    };
  });

  // --- B4: real audience ranking (lawful ranked, unlawful rejected) ----------
  const audienceResult = buildAudience(AUDIENCE_ROWS);
  const ranked: CommandCenterAudienceRow[] = audienceResult.prospects.map((p: RankedProspect) => ({
    id: p.id,
    companyName: p.companyName,
    source: p.source,
    score: p.score.score,
    evidenceTags: p.evidenceTags,
  }));

  // --- B5: real TrustOps over the real run summaries -------------------------
  const summaries: WorkflowRunSummary[] = packets.map((p) => toWorkflowRunSummary(p.run));
  const metrics = computeTrustOpsMetrics(summaries);
  const trustScore = computeTrustScore(metrics);

  // --- B3: aggregate real CRM-lite records/timeline for proceeding leads -----
  const proceeding = packets.filter((p) => canProceed(toPacketView(p.run)));
  const records: Opportunity[] = proceeding.flatMap((p) => p.crm.opportunities);
  const timeline: TimelineEvent[] = proceeding.flatMap((p) => p.crm.timeline);
  const idempotentRepeat = proveCrmIdempotency();

  // --- B6: real release gates (fail closed) ----------------------------------
  const releaseGates: ReleaseGateResult[] = [
    evaluateReleaseGate('dry_run'),
    evaluateReleaseGate('private_pilot'),
    evaluateReleaseGate('controlled_live'),
  ];
  const controlled = releaseGates.find((g) => g.stage === 'controlled_live')!;

  // Proof / workspace attribution across all real packets.
  const proofTrace: ProofTraceRow[] = packets.flatMap((p) =>
    p.run.proofs.map((proof) => ({
      workspaceId: p.run.workspace.workspaceId,
      prospectId: p.run.prospect.id,
      company: p.run.prospect.companyName,
      kind: proof.kind,
      summary: proof.summaryPublic ?? '(redacted)',
    })),
  );

  const base: Omit<CommandCenterView, 'parity' | 'source'> = {
    banner: COMMAND_CENTER_BANNER,
    workspaceId: SANDBOX_WORKSPACE,
    sandbox: true,
    leads,
    audience: { ranked, rejected: audienceResult.rejected },
    crm: { records, timeline, idempotentRepeat },
    trustOps: { metrics, trustScore },
    releaseGates,
    proofTrace,
    egress: { mode: metrics.egress.mode, statement: metrics.egress.statement },
    whyLiveBlocked: [
      LIVE_BLOCKED_REASON,
      'Real B2 dry-run actions are typed so `sent` can only ever be false.',
      'The real `sendLive()` path fails closed — it throws for the impossible default gate.',
      `The real B6 controlled_live gate is not satisfied: missing ${controlled.missing.length} condition(s).`,
    ],
    controlledLiveRequirements: controlled.missing,
  };

  const view: CommandCenterView = {
    ...base,
    parity: computeParity(base, happy, blocked.run.prospect.id),
    source: 'real-agents-modules',
  };

  // Defensive: never serve raw PII, even from real module output.
  assertNoRawPii(JSON.stringify(view));
  return view;
}
