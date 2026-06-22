/**
 * SERVER-ONLY adapter for `/gtm-command-center` — the canonical Alta proof route.
 *
 * This is the real integration. It imports the actual PR #158 + PR #159 modules
 * from `@cognitia/agents` and runs them to produce every value the Command
 * Center renders. There is NO hand-authored mirror of lane logic here — each
 * surface is the output of real module code:
 *
 *   - B1 assembly:        `assembleGtmRunPacket(...)` (via the integration packet)
 *   - B2 channels:        `planDryRunAction(...)` (via the integration packet)
 *   - B3 CRM-lite:        `projectCrmLite(...)` + `createMockCrmLite(...)` idempotency probe
 *   - B4 audience:        `buildAudience(...)`
 *   - B5 TrustOps:        `buildTrustOpsReport(...)` over real run summaries
 *   - B6 release gates:   `evaluateReleaseGate(...)`
 *   - Integration (PR #159): `assembleIntegratedRunPacket(...)` +
 *                            `verifyIntegratedRunPacket(...)` — the unified, real
 *                            run packet whose completeness drives the parity score
 *   - Egress proof:       `assertSendLiveFailsClosed()` (the live path throws)
 *
 * Server-only because `@cognitia/agents` is a server/runtime package and the
 * assembly entrypoint is async. It must never be imported by a client component.
 * The route (`page.tsx`) is an async server component that awaits this.
 *
 * MOCK / DRY-RUN ONLY: integration packets use mock ports (no IO), channel
 * actions are typed `sent:false`, CRM is in-memory, release gates fail closed.
 * Tenant is the `budget_wheels_demo` / Tenant Zero sandbox. No PII: a defensive
 * `assertNoRawPii` runs over the serialized result before it is returned.
 *
 * Why this exists separately from `gtmIntegratedDemoData.ts`: the Command Center
 * is the canonical proof route and additionally renders a code-computed Alta
 * implementation-parity scorecard, backed by the PR #159 integration packet's
 * completeness check. `/gtm-os-integrated-demo` remains as a lower-level operator
 * demo over the same real modules.
 */

import {
  assembleIntegratedRunPacket,
  verifyIntegratedRunPacket,
  assertSendLiveFailsClosed,
  type IntegratedRunPacket,
  type IntegratedPacketCompleteness,
  toWorkflowRunSummary,
  createMockCrmLite,
  type Opportunity,
  type TimelineEvent,
  buildAudience,
  type AudienceInputRow,
  type RankedProspect,
  type RejectedRow,
  buildTrustOpsReport,
  type TrustOpsMetrics,
  type TrustScore,
  evaluateReleaseGate,
  type ReleaseGateResult,
  type ReleaseStage,
  type DryRunAction,
} from '@cognitia/agents';
import { toGtmAssemblyConsoleView, type GtmAssemblyConsoleView } from '../gtmOsAssemblyViewModel';
import {
  SANDBOX_WORKSPACE,
  LIVE_BLOCKED_REASON,
  canProceed,
  assertNoRawPii,
} from '../gtmIntegratedDemoViewModel';
import { toPacketView } from './gtmIntegratedDemoData';

/** Persistent operator banner — shown on every render of the Command Center. */
export const COMMAND_CENTER_BANNER =
  'MOCK ONLY · DRY-RUN ONLY · NO LIVE SEND · NO REAL CRM · NO PII' as const;

/** Pass threshold for the implementation-parity scorecard. */
export const PARITY_THRESHOLD = 80 as const;

const RELEASE_STAGE_ORDER: readonly ReleaseStage[] = [
  'dry_run',
  'private_pilot',
  'controlled_live',
];

type IntegratedOpts = Parameters<typeof assembleIntegratedRunPacket>[0];

/** One lead's raw input + the mock-port outcomes that drive its terminal path. */
interface LeadScenario {
  label: string;
  lead: IntegratedOpts['lead'];
  portOverrides?: IntegratedOpts['portOverrides'];
}

/**
 * Three lawful scenarios: a happy lead that proceeds end-to-end, a
 * compliance-blocked lead, and a human-rejected lead. Together they prove the
 * funnel and that blocked/rejected leads cannot advance.
 */
const LEAD_SCENARIOS: readonly LeadScenario[] = [
  {
    label: 'happy',
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
    label: 'compliance_blocked',
    lead: {
      companyName: 'Do-Not-Contact Motors',
      source: 'public_registry',
      sourceRisk: 'high',
      consentStatus: 'do_not_contact',
      doNotContact: true,
    },
    portOverrides: { compliance: { status: 'blocked', reason: 'do_not_contact' } },
  },
  {
    label: 'approval_rejected',
    lead: {
      companyName: 'Maybe Later Auto',
      source: 'public_registry',
      consentStatus: 'implied_possible',
    },
    portOverrides: { approval: { status: 'rejected', reason: 'operator declined' } },
  },
];

/** Audience rows for the B4 ranking panel — lawful prospects + one scraped row. */
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
  // Unlawful source — the real builder must reject this row.
  { id: 'p-bad', companyName: 'Scraped Co', source: 'maps_platform_scrape' },
];

/** A lead rendered on the route: its real run console view + dry-run plan. */
export interface CommandCenterLead {
  lead: { id: string };
  console: GtmAssemblyConsoleView;
  /** Real B2 dry-run actions; empty when the lead cannot advance. */
  channelPlan: DryRunAction[];
}

export interface ParityCheck {
  ok: boolean;
  label: string;
}

export interface ParityDimension {
  key: string;
  label: string;
  weight: number;
  earned: number;
  checks: ParityCheck[];
}

export interface ParityScorecard {
  score: number;
  threshold: number;
  pass: boolean;
  dimensions: ParityDimension[];
  /** Live-readiness items deliberately NOT counted in the parity score. */
  remaining: string[];
}

export interface CommandCenterAudienceRow {
  id: string;
  companyName: string;
  source: string;
  score: number;
  evidenceTags: string[];
}

export interface CommandCenterCrmTimelineRow {
  seq: number;
  recordId: string;
  kind: string;
  prospectId: string;
  stage: string;
}

export interface CommandCenterProofRow {
  workspaceId: string;
  prospectId: string;
  company: string;
  kind: string;
  summary: string;
}

export interface CommandCenterData {
  banner: string;
  workspaceId: string;
  parity: ParityScorecard;
  audience: { ranked: CommandCenterAudienceRow[]; rejected: RejectedRow[] };
  leads: CommandCenterLead[];
  crm: {
    records: Opportunity[];
    idempotentRepeat: boolean;
    timeline: CommandCenterCrmTimelineRow[];
  };
  trustOps: {
    trustScore: TrustScore;
    metrics: TrustOpsMetrics;
  };
  releaseGates: ReleaseGateResult[];
  proofTrace: CommandCenterProofRow[];
  egress: { mode: string; statement: string };
  whyLiveBlocked: string[];
  controlledLiveRequirements: string[];
  /** Provenance marker so the page/tests can assert this came from real modules. */
  source: 'real-agents-modules';
}

/** Round to an integer the same way the trust score does (weight * ratio). */
function award(weight: number, passed: number, total: number): number {
  return Math.round((weight * passed) / total);
}

/**
 * Compute the Alta implementation-parity scorecard from REAL packet structure.
 * Every check is a structural assertion over real module output (not an
 * assertion of intent): if a surface regressed, its check would fail and the
 * score would drop. Weights sum to 100.
 */
function computeParityScorecard(
  integrated: IntegratedRunPacket,
  completeness: IntegratedPacketCompleteness,
  ctx: {
    audienceRanked: RankedProspect[];
    audienceRejected: RejectedRow[];
    crmRecords: Opportunity[];
    crmTimeline: CommandCenterCrmTimelineRow[];
    idempotentRepeat: boolean;
    trustScore: TrustScore;
    metrics: TrustOpsMetrics;
    releaseGates: ReleaseGateResult[];
    proofTrace: CommandCenterProofRow[];
    sendLiveFailsClosed: boolean;
  },
): ParityScorecard {
  const gate = (stage: ReleaseStage) => ctx.releaseGates.find((g) => g.stage === stage);
  const controlledLive = gate('controlled_live');

  const dimensions: ParityDimension[] = [
    {
      key: 'b1',
      label: 'B1 · Assembly island',
      weight: 14,
      earned: 0,
      checks: [
        { ok: Boolean(integrated.run.status), label: 'run has a workflow status' },
        { ok: Boolean(integrated.run.finalState), label: 'run has a terminal state' },
        {
          ok: completeness.present.includes('workflow_state'),
          label: 'integration packet proves workflow_state',
        },
        {
          ok: completeness.present.includes('proof_action_trace'),
          label: 'integration packet proves proof/action trace',
        },
      ],
    },
    {
      key: 'b2',
      label: 'B2 · Dry-run channel engine',
      weight: 14,
      earned: 0,
      checks: [
        { ok: integrated.channelPlans.length > 0, label: 'dry-run plans produced' },
        {
          ok: integrated.channelPlans.every((p) => p.mode === 'dry_run'),
          label: 'every plan is mode=dry_run',
        },
        {
          ok: integrated.channelPlans.every((p) => p.sent === false),
          label: 'every plan has sent=false',
        },
        {
          ok: integrated.channelPlans.every((p) => p.wouldSendIfLive.liveStatus === 'BLOCKED'),
          label: 'every live path is BLOCKED',
        },
      ],
    },
    {
      key: 'b3',
      label: 'B3 · CRM-lite + timeline',
      weight: 12,
      earned: 0,
      checks: [
        { ok: ctx.crmRecords.length > 0, label: 'CRM records present' },
        { ok: ctx.crmTimeline.length > 0, label: 'operator timeline present' },
        { ok: ctx.idempotentRepeat, label: 'idempotent on repeat upsert' },
      ],
    },
    {
      key: 'b4',
      label: 'B4 · Audience / signal builder',
      weight: 12,
      earned: 0,
      checks: [
        { ok: ctx.audienceRanked.length > 0, label: 'lawful prospects ranked' },
        {
          ok: ctx.audienceRejected.some((r) => r.id === 'p-bad'),
          label: 'scraped source rejected',
        },
        {
          ok: ctx.audienceRanked.every((p) => p.score.score >= 0 && p.score.score <= 1),
          label: 'all scores in 0..1',
        },
      ],
    },
    {
      key: 'b5',
      label: 'B5 · TrustOps analytics',
      weight: 14,
      earned: 0,
      checks: [
        {
          ok: ctx.trustScore.score >= 0 && ctx.trustScore.score <= 100,
          label: 'trust score in 0..100',
        },
        { ok: ctx.metrics.funnel.leadsReceived > 0, label: 'funnel computed over runs' },
        { ok: ctx.metrics.egress.noLiveEgress === true, label: 'no-live-egress attested' },
      ],
    },
    {
      key: 'b6',
      label: 'B6 · Enterprise release gates',
      weight: 14,
      earned: 0,
      checks: [
        { ok: gate('dry_run')?.passed === true, label: 'dry_run stage open' },
        { ok: gate('private_pilot')?.passed === false, label: 'private_pilot fails closed' },
        {
          ok: controlledLive?.passed === false && (controlledLive?.missing.length ?? 0) > 0,
          label: 'controlled_live fails closed',
        },
      ],
    },
    {
      key: 'egress',
      label: 'Cross · No-live-egress attestation',
      weight: 10,
      earned: 0,
      checks: [
        {
          ok: integrated.attestation.noLiveEgress === true,
          label: 'packet attests no live egress',
        },
        { ok: ctx.sendLiveFailsClosed, label: 'sendLive() fails closed (throws)' },
      ],
    },
    {
      key: 'proof',
      label: 'Cross · Proof / workspace attribution',
      weight: 10,
      earned: 0,
      checks: [
        { ok: ctx.proofTrace.length > 0, label: 'proof events recorded' },
        {
          ok: ctx.proofTrace.every((p) => p.workspaceId === SANDBOX_WORKSPACE),
          label: 'every proof row workspace-attributed',
        },
      ],
    },
  ];

  for (const d of dimensions) {
    const passed = d.checks.filter((c) => c.ok).length;
    d.earned = award(d.weight, passed, d.checks.length);
  }

  const score = dimensions.reduce((sum, d) => sum + d.earned, 0);
  return {
    score,
    threshold: PARITY_THRESHOLD,
    pass: score >= PARITY_THRESHOLD,
    dimensions,
    remaining: [
      'Live channel execution (email/SMS/WhatsApp/call/ads) — not implemented; fails closed.',
      'Real CRM connector wiring (CrmPort) — PLANNED; CRM-lite is in-memory mock only.',
      'Licensed data-provider audience integration — PLANNED; only lawful fixtures are scored.',
      'Controlled-live release — blocked until the 7 organizational/legal sign-offs land.',
    ],
  };
}

/**
 * Run the real integrated modules and assemble the Command Center data. Async
 * because the assembly entrypoint is async (mock ports resolve in-memory, no IO).
 */
export async function loadCommandCenterData(): Promise<CommandCenterData> {
  // --- Real PR #159 integration packets, one per scenario --------------------
  const packets: IntegratedRunPacket[] = [];
  for (const scenario of LEAD_SCENARIOS) {
    packets.push(
      await assembleIntegratedRunPacket({
        lead: scenario.lead,
        workspaceId: SANDBOX_WORKSPACE,
        portOverrides: scenario.portOverrides,
      }),
    );
  }
  const canonical = packets[0]!; // the happy lead — the fully-proven loop
  const completeness = verifyIntegratedRunPacket(canonical);

  // --- Per-lead console view + dry-run plan (gated on can-proceed) ------------
  const leads: CommandCenterLead[] = packets.map((packet) => {
    const view = toPacketView(packet.run);
    const proceed = canProceed(view);
    return {
      lead: { id: packet.run.prospect.id },
      console: toGtmAssemblyConsoleView(view),
      // Real B2 plans only when the lead actually advances; a blocked/rejected
      // lead plans zero channel actions and cannot advance.
      channelPlan: proceed ? packet.channelPlans : [],
    };
  });

  // --- B4: real audience ranking (incl. the rejected scraped row) ------------
  const audienceResult = buildAudience(AUDIENCE_ROWS);
  const audienceRanked = audienceResult.prospects;

  // --- B3: CRM read-model from the canonical run + a real idempotency probe --
  const canonicalCrm = canonical.crm;
  const crmRecords = canonicalCrm.opportunities;
  const crmTimeline: CommandCenterCrmTimelineRow[] = canonicalCrm.timeline.map(
    (e: TimelineEvent) => ({
      seq: e.seq,
      recordId: e.id,
      kind: e.kind,
      prospectId: e.prospectId,
      stage: e.outcome,
    }),
  );
  // Prove B3 idempotency on the real module: a double upsert yields one record.
  const probe = createMockCrmLite();
  const opp = crmRecords[0];
  let idempotentRepeat = true;
  if (opp) {
    const input = {
      workspaceId: opp.workspaceId,
      prospectId: opp.prospectId,
      companyId: opp.companyId,
      stage: opp.stage,
    };
    probe.upsertOpportunity(input);
    probe.upsertOpportunity(input);
    idempotentRepeat = probe.listOpportunities(opp.workspaceId).length === 1;
  }

  // --- B5: real TrustOps over all three real runs ----------------------------
  const summaries = packets.map((p) => toWorkflowRunSummary(p.run));
  const trustReport = buildTrustOpsReport(summaries);

  // --- B6: real release gates (fail closed) ----------------------------------
  const releaseGates = RELEASE_STAGE_ORDER.map((stage) => evaluateReleaseGate(stage));
  const controlled = releaseGates.find((g) => g.stage === 'controlled_live')!;

  // --- Proof / workspace attribution trace -----------------------------------
  const proofTrace: CommandCenterProofRow[] = packets.flatMap((packet) =>
    packet.run.proofs.map((proof) => ({
      workspaceId: packet.run.workspace.workspaceId,
      prospectId: packet.run.prospect.id,
      company: packet.run.prospect.companyName,
      kind: proof.kind,
      summary: proof.summaryPublic ?? '—',
    })),
  );

  // --- Egress proof: the live send path genuinely fails closed ---------------
  let sendLiveFailsClosed = true;
  try {
    assertSendLiveFailsClosed();
  } catch {
    sendLiveFailsClosed = false;
  }

  const parity = computeParityScorecard(canonical, completeness, {
    audienceRanked,
    audienceRejected: audienceResult.rejected,
    crmRecords,
    crmTimeline,
    idempotentRepeat,
    trustScore: trustReport.score,
    metrics: trustReport.metrics,
    releaseGates,
    proofTrace,
    sendLiveFailsClosed,
  });

  const data: CommandCenterData = {
    banner: COMMAND_CENTER_BANNER,
    workspaceId: SANDBOX_WORKSPACE,
    parity,
    audience: {
      ranked: audienceRanked.map((p) => ({
        id: p.id,
        companyName: p.companyName,
        source: p.source,
        score: p.score.score,
        evidenceTags: p.evidenceTags,
      })),
      rejected: audienceResult.rejected,
    },
    leads,
    crm: { records: crmRecords, idempotentRepeat, timeline: crmTimeline },
    trustOps: { trustScore: trustReport.score, metrics: trustReport.metrics },
    releaseGates,
    proofTrace,
    egress: {
      mode: trustReport.metrics.egress.mode,
      statement: trustReport.metrics.egress.statement,
    },
    whyLiveBlocked: [
      LIVE_BLOCKED_REASON,
      'Real B2 dry-run actions are typed so `sent` can only ever be false.',
      `Real B6 controlled_live gate is not satisfied: missing ${controlled.missing.length} condition(s).`,
    ],
    controlledLiveRequirements: controlled.missing,
    source: 'real-agents-modules',
  };

  // Defensive: never serve raw PII, even from real module output.
  assertNoRawPii(JSON.stringify(data));
  return data;
}
