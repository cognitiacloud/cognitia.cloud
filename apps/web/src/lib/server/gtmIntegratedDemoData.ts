/**
 * SERVER-ONLY adapter for `/gtm-os-integrated-demo`.
 *
 * This is the real integration: it imports the actual PR #158 modules from
 * `@cognitia/agents` and runs them to produce the demo data. There is no
 * hand-authored mirror here — every surface is the output of real module code:
 *
 *   - B1 assembly:   `assembleGtmRunPacket(...)`
 *   - B2 channels:   `planDryRunAction(...)` + `evaluateChannelPolicy(...)`
 *   - B3 CRM-lite:   `createMockCrmLite(...)` (idempotent upserts + timeline)
 *   - B4 audience:   `buildAudience(...)`
 *   - B5 TrustOps:   `computeTrustOpsMetrics(...)` + `buildTrustOpsReport(...)`
 *   - B6 gates:      `evaluateReleaseGate(...)`
 *
 * Server-only because `@cognitia/agents` is a server/runtime package (and the
 * assembly entrypoint is async). It must never be imported by a client
 * component. The route (`page.tsx`) is a server component that awaits this.
 *
 * MOCK / DRY-RUN ONLY: `assembleGtmRunPacket` uses mock ports (no IO), channel
 * actions are typed `sent:false`, CRM is in-memory, release gates fail closed.
 * Tenant is the `budget_wheels_demo` / Tenant Zero sandbox. No PII: a defensive
 * `assertNoRawPii` runs over the serialized result before it is returned.
 */

import {
  assembleGtmRunPacket,
  type GtmRunPacket,
  planDryRunAction,
  evaluateChannelPolicy,
  type DryRunAction,
  type ChannelKind,
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
  type WorkflowRunSummary,
  evaluateReleaseGate,
  type ReleaseGateResult,
  type ReleaseStage,
} from '@cognitia/agents';
import {
  toGtmAssemblyConsoleView,
  type GtmAssemblyConsoleView,
} from '../gtmOsAssemblyViewModel.js';
import { toPacketView } from './gtmPacketView.js';
import {
  DEMO_BANNER,
  SANDBOX_WORKSPACE,
  LIVE_BLOCKED_REASON,
  canProceed,
  assertNoRawPii,
} from '../gtmIntegratedDemoViewModel.js';

const RELEASE_STAGE_ORDER: readonly ReleaseStage[] = [
  'dry_run',
  'private_pilot',
  'controlled_live',
];

const DEMO_CHANNELS: readonly ChannelKind[] = ['email', 'sms', 'crm_writeback'];

/** A lead rendered on the route: its real assembly packet + console view + plan. */
export interface DemoLeadData {
  id: string;
  company: string;
  console: GtmAssemblyConsoleView;
  /** Real B2 dry-run actions (empty when the lead cannot proceed). */
  channelPlan: DryRunAction[];
  /** Real B2 policy decision for this lead. */
  policy: ChannelPolicyDecision;
}

export interface IntegratedDemoData {
  banner: string;
  workspaceId: string;
  sandbox: boolean;
  leads: DemoLeadData[];
  audience: { ranked: RankedProspect[]; rejected: RejectedRow[] };
  crm: { records: Opportunity[]; timeline: TimelineEvent[] };
  trustOps: { metrics: TrustOpsMetrics; score: TrustScore; reportMarkdown: string };
  releaseGates: ReleaseGateResult[];
  whyLiveBlocked: string[];
  controlledLiveRequirements: string[];
  /** Provenance marker so the page/tests can assert this came from the adapter. */
  source: 'real-agents-modules';
}

/** Map a real assembly packet into a TrustOps run summary (B5 input). */
function toRunSummary(packet: GtmRunPacket): WorkflowRunSummary {
  const status =
    packet.status === 'completed' || packet.status === 'awaiting_approval'
      ? packet.status
      : 'blocked';
  return {
    runId: `run-${packet.prospect.id}`,
    tenant: packet.workspace.workspaceId,
    status,
    compliance: packet.compliance.blocked ? 'blocked' : 'pass',
    approval: packet.approval.status,
    appointment: packet.appointment.requested ? 'requested' : 'skipped',
    crm: packet.crm.written ? 'ok' : 'skipped',
    proofEventsRecorded: packet.proofs.length,
    blockedReason: packet.blockedReason,
  };
}

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

/**
 * Run the real integrated modules and assemble the demo data. Async because the
 * assembly entrypoint is async (mock ports resolve in-memory, no IO).
 */
export async function loadIntegratedDemoData(): Promise<IntegratedDemoData> {
  // --- B1: assemble three real runs (happy / compliance-blocked / rejected) ---
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
  });
  const rejected = await assembleGtmRunPacket({
    lead: {
      companyName: 'Maybe Later Auto',
      source: 'public_registry',
      consentStatus: 'implied_possible',
    },
    workspaceId: SANDBOX_WORKSPACE,
    portOverrides: { approval: { status: 'rejected', reason: 'operator declined' } },
  });

  const packets: GtmRunPacket[] = [happy, blocked, rejected];

  const leads: DemoLeadData[] = packets.map((packet) => {
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
      console: toGtmAssemblyConsoleView(view),
      channelPlan,
      policy,
    };
  });

  // --- B3: real CRM-lite, idempotent upsert for the proceeding lead ----------
  const crm = createMockCrmLite();
  for (const packet of packets) {
    if (canProceed(toPacketView(packet)) && packet.crm.written) {
      const company = crm.upsertCompany({
        workspaceId: packet.workspace.workspaceId,
        companyName: packet.prospect.companyName,
      });
      const input = {
        workspaceId: packet.workspace.workspaceId,
        prospectId: packet.prospect.id,
        companyId: company.id,
        stage: 'appointment_set' as const,
        appointmentRef: 'appt-1',
      };
      crm.upsertOpportunity(input);
      crm.upsertOpportunity(input); // idempotent — still one record
    }
  }

  // --- B4: real audience ranking ---------------------------------------------
  const audienceResult = buildAudience(AUDIENCE_ROWS);

  // --- B5: real TrustOps over the real runs ----------------------------------
  const summaries = packets.map(toRunSummary);
  const metrics = computeTrustOpsMetrics(summaries);
  const report = buildTrustOpsReport(summaries);

  // --- B6: real release gates (fail closed) ----------------------------------
  const releaseGates = RELEASE_STAGE_ORDER.map((stage) => evaluateReleaseGate(stage));
  const controlled = evaluateReleaseGate('controlled_live');

  const data: IntegratedDemoData = {
    banner: DEMO_BANNER,
    workspaceId: SANDBOX_WORKSPACE,
    sandbox: true,
    leads,
    audience: { ranked: audienceResult.prospects, rejected: audienceResult.rejected },
    crm: { records: crm.listOpportunities(SANDBOX_WORKSPACE), timeline: crm.readTimeline() },
    trustOps: { metrics, score: report.score, reportMarkdown: report.markdown },
    releaseGates,
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
