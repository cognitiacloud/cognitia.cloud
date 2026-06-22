/**
 * SERVER-ONLY adapter for `/gtm-command-center`.
 *
 * This is the real integration that feeds the Command Center route. It imports
 * the actual PR #158 B1–B6 modules from `@cognitia/agents` and runs them to
 * produce every rendered surface — there is NO hand-authored structural mirror
 * of lane semantics here. Each section is the output of real module code:
 *
 *   - B1 assembly:   `assembleGtmRunPacket(...)`
 *   - B2 channels:   `planDryRunAction(...)` + `evaluateChannelPolicy(...)`
 *   - B3 CRM-lite:   `createMockCrmLite(...)` (idempotent upserts + timeline)
 *   - B4 audience:   `buildAudience(...)`
 *   - B5 TrustOps:   `computeTrustOpsMetrics(...)` + `buildTrustOpsReport(...)`
 *   - B6 gates:      `evaluateReleaseGate(...)`
 *   - integration:   `assembleIntegratedRunPacket(...)` + `verifyIntegratedRunPacket(...)`
 *
 * The integration packet is the canonical composing artifact (PR #159): one
 * server-only read-model that calls the lane modules and proves the whole loop
 * for a single lead. We surface its completeness checklist so the page can prove
 * the route is backed by the real composing adapter, not a reproduction.
 *
 * Server-only because `@cognitia/agents` is a server/runtime package (and the
 * assembly entrypoint is async). It must NEVER be imported by a client
 * component. The route (`page.tsx`) is a server component that awaits this.
 *
 * MOCK / DRY-RUN ONLY: channel actions are typed `sent:false`, CRM is in-memory,
 * release gates fail closed, the live send path always throws. Tenant is the
 * `budget_wheels_demo` / Tenant Zero sandbox. No PII: a defensive
 * `assertNoRawPii` runs over the serialized result before it is returned.
 */

import {
  assembleGtmRunPacket,
  type GtmRunPacket,
  planDryRunAction,
  evaluateChannelPolicy,
  CHANNEL_KINDS,
  type DryRunAction,
  type ChannelPolicyDecision,
  createMockCrmLite,
  type Opportunity,
  type TimelineEvent,
  buildAudience,
  type AudienceInputRow,
  type RankedProspect,
  type RejectedRow,
  computeTrustOpsMetrics,
  buildTrustOpsReport,
  type TrustOpsMetrics,
  type TrustScore,
  type EgressAttestation,
  type WorkflowRunSummary,
  evaluateReleaseGate,
  type ReleaseGateResult,
  type ReleaseStage,
  assembleIntegratedRunPacket,
  verifyIntegratedRunPacket,
  type IntegratedPacketCompleteness,
} from '@cognitia/agents';
import {
  toGtmAssemblyConsoleView,
  type GtmRunPacketView,
  type GtmAssemblyConsoleView,
} from '../gtmOsAssemblyViewModel.js';
import {
  COMMAND_CENTER_BANNER,
  SANDBOX_WORKSPACE,
  LIVE_BLOCKED_REASON,
  canProceed,
  assertNoRawPii,
} from '../gtmCommandCenterViewModel.js';

const RELEASE_STAGE_ORDER: readonly ReleaseStage[] = [
  'dry_run',
  'private_pilot',
  'controlled_live',
];

/** Deterministic clock + id generator so the route renders identically every time. */
const FIXED_NOW = () => new Date('2026-06-22T00:00:00.000Z');
function fixedIdFactory(): () => string {
  let counter = 0;
  return () => `cc-${(counter++).toString(36).padStart(8, '0')}`;
}

/** A lead rendered on the route: its real assembly packet view + console + plan. */
export interface CommandCenterLeadData {
  lead: { id: string; companyName: string; packet: GtmRunPacketView };
  console: GtmAssemblyConsoleView;
  /** Real B2 dry-run actions (empty when the lead cannot proceed). */
  channelPlan: DryRunAction[];
  /** Real B2 policy decision for this lead. */
  policy: ChannelPolicyDecision;
}

export interface ProofTraceRow {
  workspaceId: string;
  prospectId: string;
  company: string;
  kind: string;
  summary: string;
}

/** The full real-module data for the Command Center route. */
export interface CommandCenterData {
  banner: typeof COMMAND_CENTER_BANNER;
  workspaceId: string;
  sandbox: boolean;
  leads: CommandCenterLeadData[];
  audience: { ranked: RankedProspect[]; rejected: RejectedRow[] };
  crm: { records: Opportunity[]; timeline: TimelineEvent[]; idempotentRepeat: boolean };
  trustOps: { metrics: TrustOpsMetrics; trustScore: TrustScore; reportMarkdown: string };
  releaseGates: ReleaseGateResult[];
  proofTrace: ProofTraceRow[];
  egress: { mode: EgressAttestation['mode']; statement: string };
  whyLiveBlocked: string[];
  controlledLiveRequirements: string[];
  /** Completeness checklist from the real composing adapter (PR #159). */
  integration: IntegratedPacketCompleteness;
  /** Provenance marker so the page/tests can assert this came from the adapter. */
  source: 'real-agents-modules';
}

/** Map a real assembly packet into the existing console view shape. Pure. */
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

/** Map a real assembly packet into a TrustOps run summary (B5 input). Pure. */
function toRunSummary(packet: GtmRunPacket): WorkflowRunSummary {
  const status =
    packet.status === 'completed' || packet.status === 'awaiting_approval'
      ? packet.status
      : 'blocked';
  return {
    runId: packet.prospect.id,
    tenant: packet.workspace.workspaceId,
    status,
    compliance: packet.compliance.blocked ? 'blocked' : 'pass',
    approval: packet.compliance.blocked ? undefined : packet.approval.status,
    appointment: packet.appointment.requested ? 'requested' : undefined,
    crm: packet.crm.written ? 'ok' : undefined,
    proofEventsRecorded: packet.proofs.length,
    blockedReason: packet.blockedReason,
  };
}

/** Lawful + unlawful audience rows. The builder must reject the scraped ones. */
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
  // Unlawful sources — the real builder must reject these rows.
  { id: 'p-bad', companyName: 'Scraped Listings LLC', source: 'maps_platform_scrape' },
  { id: 'p-apify', companyName: 'Apify Harvest Co', source: 'apify' },
];

/**
 * Run the real integrated modules and assemble the Command Center data. Async
 * because the assembly entrypoint is async (mock ports resolve in-memory, no IO).
 */
export async function loadCommandCenterData(): Promise<CommandCenterData> {
  const now = FIXED_NOW;

  // --- B1: assemble three real runs (happy / pending / compliance-blocked) ----
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
    newId: fixedIdFactory(),
  });
  const pending = await assembleGtmRunPacket({
    lead: {
      companyName: 'Budget Wheels Demo',
      source: 'public_registry',
      consentStatus: 'implied_possible',
    },
    workspaceId: SANDBOX_WORKSPACE,
    portOverrides: { approval: { status: 'pending' } },
    now,
    newId: fixedIdFactory(),
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
    newId: fixedIdFactory(),
  });

  const named: Array<{ id: string; companyName: string; packet: GtmRunPacket }> = [
    { id: 'p-001', companyName: 'Northshore Auto Group', packet: happy },
    { id: 'p-002', companyName: 'Budget Wheels Demo', packet: pending },
    { id: 'p-009', companyName: 'Do-Not-Contact Motors', packet: blocked },
  ];

  const leads: CommandCenterLeadData[] = named.map(({ id, companyName, packet }) => {
    const view = toPacketView(packet);
    const proceed = canProceed(view);
    // B2: a real policy decision, then real dry-run plans (only if proceeding).
    const policy = evaluateChannelPolicy({
      channel: 'email',
      consent: packet.approval.status === 'approved' && !packet.compliance.blocked,
      approval: packet.approval.status,
      workspaceId: packet.workspace.workspaceId,
      live: false,
    });
    const channelPlan = proceed
      ? CHANNEL_KINDS.map((channel) =>
          planDryRunAction(channel, {
            workspaceId: packet.workspace.workspaceId,
            prospectId: id,
          }),
        )
      : [];
    return {
      lead: { id, companyName, packet: view },
      console: toGtmAssemblyConsoleView(view),
      channelPlan,
      policy,
    };
  });

  // --- B3: real CRM-lite, idempotent upsert for the proceeding lead ----------
  const crm = createMockCrmLite({ now });
  let idempotentRepeat = true;
  for (const { id, packet } of named) {
    if (canProceed(toPacketView(packet)) && packet.crm.written) {
      const company = crm.upsertCompany({
        workspaceId: packet.workspace.workspaceId,
        companyName: packet.prospect.companyName,
      });
      const input = {
        workspaceId: packet.workspace.workspaceId,
        prospectId: id,
        companyId: company.id,
        stage: 'appointment_set' as const,
        appointmentRef: 'appt-1',
      };
      const before = crm.listOpportunities(packet.workspace.workspaceId).length;
      crm.upsertOpportunity(input);
      const afterFirst = crm.listOpportunities(packet.workspace.workspaceId).length;
      crm.upsertOpportunity(input); // idempotent — still one record
      const afterSecond = crm.listOpportunities(packet.workspace.workspaceId).length;
      if (!(afterFirst === before + 1 && afterSecond === afterFirst)) idempotentRepeat = false;
    }
  }

  // --- B4: real audience ranking ---------------------------------------------
  const audienceResult = buildAudience(AUDIENCE_ROWS);

  // --- B5: real TrustOps over the real runs ----------------------------------
  const summaries = named.map(({ packet }) => toRunSummary(packet));
  const metrics = computeTrustOpsMetrics(summaries);
  const report = buildTrustOpsReport(summaries);

  // --- B6: real release gates (fail closed) ----------------------------------
  const releaseGates = RELEASE_STAGE_ORDER.map((stage) => evaluateReleaseGate(stage));
  const controlled = evaluateReleaseGate('controlled_live');

  // Proof / workspace attribution trace across all leads.
  const proofTrace: ProofTraceRow[] = named.flatMap(({ id, companyName, packet }) =>
    packet.proofs.map((p) => ({
      workspaceId: packet.workspace.workspaceId,
      prospectId: id,
      company: companyName,
      kind: p.kind,
      summary: p.summaryPublic ?? '(redacted)',
    })),
  );

  // --- Integration: the canonical composing adapter (PR #159), used to prove
  //     the route is backed by the real integrated run packet, not a mirror. ---
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
    now,
    newId: fixedIdFactory(),
  });
  const integration = verifyIntegratedRunPacket(integratedPacket);

  const data: CommandCenterData = {
    banner: COMMAND_CENTER_BANNER,
    workspaceId: SANDBOX_WORKSPACE,
    sandbox: true,
    leads,
    audience: { ranked: audienceResult.prospects, rejected: audienceResult.rejected },
    crm: {
      records: crm.listOpportunities(SANDBOX_WORKSPACE),
      timeline: crm.readTimeline({ workspaceId: SANDBOX_WORKSPACE }),
      idempotentRepeat,
    },
    trustOps: { metrics, trustScore: report.score, reportMarkdown: report.markdown },
    releaseGates,
    proofTrace,
    egress: { mode: metrics.egress.mode, statement: metrics.egress.statement },
    whyLiveBlocked: [
      LIVE_BLOCKED_REASON,
      'Real B2 dry-run actions are typed so `sent` can only ever be false.',
      'Real B2 `sendLive()` always throws — the dry-run layer has no live code path.',
      `Real B6 controlled_live gate is not satisfied: missing ${controlled.missing.length} condition(s).`,
    ],
    controlledLiveRequirements: controlled.missing,
    integration,
    source: 'real-agents-modules',
  };

  // Defensive: never serve raw PII, even from real module output.
  assertNoRawPii(JSON.stringify(data));
  return data;
}
