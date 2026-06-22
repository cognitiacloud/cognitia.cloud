/**
 * View-model for the integrated GTM operator demo route (`/gtm-os-integrated-demo`).
 *
 * Proves the integrated mock GTM system end-to-end on ONE screen:
 *   audience/signal -> compliance/approval -> dry-run channel plan ->
 *   CRM-lite timeline -> TrustOps metrics -> release gates -> proof/trace.
 *
 * Pure transforms only — no React, no IO, no network. The Next.js page stays
 * thin; all logic is unit-tested here.
 *
 * DECOUPLING (intentional, matches `gtmOsAssemblyViewModel.ts`): `apps/web`
 * depends only on `@cognitia/core` (per its tsconfig + package.json), so this
 * file does NOT import `@cognitia/agents`. Instead it reproduces the *tested*
 * lane semantics structurally:
 *   - dry-run channel action is always `{ mode:'dry_run', sent:false }`  (B2)
 *   - CRM-lite upserts are idempotent on (workspace, prospect, appointment) (B3)
 *   - release gates fail closed; controlled_live needs 7 signoffs           (B6)
 *   - TrustOps metrics are computed from mock run outcomes                  (B5)
 * The authoritative implementations + their tests live in `packages/agents`.
 *
 * MOCK/SANDBOX/DRY-RUN ONLY: no live send, no real CRM, no PII. Tenant is the
 * `budget_wheels_demo` / Tenant Zero sandbox.
 */

import {
  toGtmAssemblyConsoleView,
  type GtmRunPacketView,
  type GtmAssemblyConsoleView,
} from './gtmOsAssemblyViewModel.js';

/** Persistent operator banner — shown on every render of the demo route. */
export const DEMO_BANNER = 'MOCK ONLY / DRY-RUN ONLY / NO LIVE SEND / NO REAL CRM' as const;

export const SANDBOX_WORKSPACE = 'budget_wheels_demo' as const;

/** The single reason any live action is refused in this build. */
export const LIVE_BLOCKED_REASON =
  'Live channels are disabled by construction: no connector approval, no counsel/founder sign-off, no signed customer scope.';

// ---------------------------------------------------------------------------
// PII guard (mirrors packages/agents assertNoRawPii)
// ---------------------------------------------------------------------------

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const RESERVED_TLD = /\.(example|test|invalid)$/i;
const PHONE_RE = /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b/g;
const RESERVED_PHONE = /555[\s.-]?01\d{2}/;

/** Returns the first raw-PII fragment found, or null if the string is safe. */
export function findRawPii(value: string): string | null {
  for (const email of value.match(EMAIL_RE) ?? []) {
    if (email.includes('*')) continue; // masked
    const domain = email.slice(email.lastIndexOf('@') + 1);
    if (!RESERVED_TLD.test(domain)) return email;
  }
  for (const phone of value.match(PHONE_RE) ?? []) {
    if (!RESERVED_PHONE.test(phone)) return phone;
  }
  return null;
}

export function assertNoRawPii(value: string): void {
  const hit = findRawPii(value);
  if (hit) throw new Error(`raw PII detected: ${hit}`);
}

// ---------------------------------------------------------------------------
// B2 — dry-run channels (structural mirror)
// ---------------------------------------------------------------------------

export type ChannelKind =
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'call'
  | 'linkedin'
  | 'ad'
  | 'crm_writeback';

export const CHANNEL_KINDS: readonly ChannelKind[] = [
  'email',
  'sms',
  'whatsapp',
  'call',
  'linkedin',
  'ad',
  'crm_writeback',
];

export interface DryRunChannelAction {
  channel: ChannelKind;
  mode: 'dry_run';
  sent: false;
  preview: { to: string; summary: string };
  wouldSendIfLive: { liveStatus: 'BLOCKED'; reason: string };
}

/** Plan a channel action. Always dry-run; can never be a live send. */
export function planDryRunAction(
  channel: ChannelKind,
  preview: { to: string; summary: string },
): DryRunChannelAction {
  return {
    channel,
    mode: 'dry_run',
    sent: false,
    preview,
    wouldSendIfLive: { liveStatus: 'BLOCKED', reason: LIVE_BLOCKED_REASON },
  };
}

/** Throws if an action was tampered into anything other than a dry-run no-send. */
export function assertNoLiveSend(action: DryRunChannelAction): void {
  if (action.sent !== false || action.mode !== 'dry_run') {
    throw new Error('live send blocked: action is not a dry-run no-send');
  }
}

// ---------------------------------------------------------------------------
// B6 — release gates (structural mirror; fail closed)
// ---------------------------------------------------------------------------

export type ReleaseStage = 'dry_run' | 'private_pilot' | 'controlled_live';

export interface ReleaseConditions {
  signedCustomerScope?: boolean;
  counselSignoff?: boolean;
  founderSignoff?: boolean;
  monitoring?: boolean;
  rollback?: boolean;
  secrets?: boolean;
  connectorApproval?: boolean;
}

export const CONDITION_LABELS: Record<keyof ReleaseConditions, string> = {
  signedCustomerScope: 'Signed customer scope',
  counselSignoff: 'Counsel sign-off',
  founderSignoff: 'Founder sign-off',
  monitoring: 'Production monitoring',
  rollback: 'Rollback / kill-switch',
  secrets: 'Managed secrets',
  connectorApproval: 'Live connector approval',
};

const STAGE_REQUIREMENTS: Record<ReleaseStage, ReadonlyArray<keyof ReleaseConditions>> = {
  dry_run: [],
  private_pilot: ['monitoring', 'rollback'],
  controlled_live: [
    'signedCustomerScope',
    'counselSignoff',
    'founderSignoff',
    'monitoring',
    'rollback',
    'secrets',
    'connectorApproval',
  ],
};

export interface ReleaseGateResult {
  stage: ReleaseStage;
  passed: boolean;
  missing: ReadonlyArray<keyof ReleaseConditions>;
  missingLabels: string[];
}

/** Fail-closed gate evaluation: an absent condition counts as false. */
export function evaluateReleaseGate(
  stage: ReleaseStage,
  conditions: ReleaseConditions = {},
): ReleaseGateResult {
  const required = STAGE_REQUIREMENTS[stage];
  const missing = required.filter((key) => conditions[key] !== true);
  return {
    stage,
    passed: missing.length === 0,
    missing,
    missingLabels: missing.map((key) => CONDITION_LABELS[key]),
  };
}

export function requiredConditions(stage: ReleaseStage): ReadonlyArray<keyof ReleaseConditions> {
  return STAGE_REQUIREMENTS[stage];
}

// ---------------------------------------------------------------------------
// B3 — CRM-lite (structural mirror; idempotent in-memory store)
// ---------------------------------------------------------------------------

export interface CrmUpsert {
  workspaceId: string;
  prospectId: string;
  appointmentRef?: string;
  stage: string;
}

export interface CrmRecord extends CrmUpsert {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export function crmIdempotencyKey(
  workspaceId: string,
  prospectId: string,
  appointmentRef?: string,
): string {
  return appointmentRef
    ? `${workspaceId}::${prospectId}::${appointmentRef}`
    : `${workspaceId}::${prospectId}`;
}

/** Minimal idempotent CRM-lite store (mock; in-memory). */
export class MockCrmStore {
  private readonly byKey = new Map<string, CrmRecord>();
  private seq = 0;

  constructor(private readonly now: () => string = () => '2026-06-22T10:00:00.000Z') {}

  upsert(input: CrmUpsert): CrmRecord {
    const key = crmIdempotencyKey(input.workspaceId, input.prospectId, input.appointmentRef);
    const at = this.now();
    const existing = this.byKey.get(key);
    if (existing) {
      const updated: CrmRecord = { ...existing, ...input, updatedAt: at };
      this.byKey.set(key, updated);
      return updated;
    }
    const record: CrmRecord = { ...input, id: `crm-${++this.seq}`, createdAt: at, updatedAt: at };
    this.byKey.set(key, record);
    return record;
  }

  list(): CrmRecord[] {
    return [...this.byKey.values()];
  }
}

// ---------------------------------------------------------------------------
// B4 — audience / signal ranking (structural mirror)
// ---------------------------------------------------------------------------

export interface RankedProspect {
  id: string;
  companyName: string;
  source: string;
  score: number;
  evidenceTags: string[];
}

export interface RejectedRow {
  id: string;
  reason: string;
}

export interface AudienceView {
  ranked: RankedProspect[];
  rejected: RejectedRow[];
}

// ---------------------------------------------------------------------------
// B5 — TrustOps metrics / report (structural mirror)
// ---------------------------------------------------------------------------

export interface FunnelMetrics {
  leadsReceived: number;
  compliancePass: number;
  complianceBlocked: number;
  approvalApproved: number;
  approvalRejected: number;
  appointmentRequested: number;
  crmWritten: number;
  proofEvents: number;
}

export interface TrustOpsView {
  funnel: FunnelMetrics;
  approvalCoverage: number; // 0..1
  trustScore: number; // 0..100
  noLiveEgress: boolean;
  reportMarkdown: string;
}

// ---------------------------------------------------------------------------
// Integrated demo — leads + assembled view
// ---------------------------------------------------------------------------

export interface DemoLead {
  id: string;
  companyName: string;
  /** Whether this lead can proceed past compliance + approval. */
  canProceed: boolean;
  packet: GtmRunPacketView;
}

export interface IntegratedDemoView {
  banner: typeof DEMO_BANNER;
  workspaceId: string;
  sandbox: boolean;
  /** Per-lead assembled operator view (B1). */
  leads: Array<{
    lead: DemoLead;
    console: GtmAssemblyConsoleView;
    /** Dry-run channel plan for this lead (empty when the lead is blocked). */
    channelPlan: DryRunChannelAction[];
  }>;
  audience: AudienceView; // B4
  crm: CrmRecord[]; // B3
  trustOps: TrustOpsView; // B5
  releaseGates: ReleaseGateResult[]; // B6
  whyLiveBlocked: string[];
  controlledLiveRequirements: string[];
}

/** A lead can proceed only when compliance cleared AND a human approved. */
export function canProceed(packet: GtmRunPacketView): boolean {
  return (
    packet.compliance.passed && !packet.compliance.blocked && packet.approval.status === 'approved'
  );
}

// --- deterministic mock scenario (PII-safe by construction) ----------------

function happyPacket(): GtmRunPacketView {
  return {
    mode: 'mock',
    workspace: { workspaceId: SANDBOX_WORKSPACE, sandbox: true },
    prospect: {
      id: 'p-001',
      companyName: 'Northshore Auto Group',
      sourceRisk: 'low',
      consentStatus: 'explicit_consent',
      fitScore: 0.9,
    },
    status: 'completed',
    finalState: 'appointment_set',
    compliance: { passed: true, blocked: false },
    approval: { status: 'approved' },
    appointment: { requested: true },
    crm: { written: true },
    proofs: [
      { kind: 'compliance_check', summaryPublic: 'Consent verified (mock)' },
      { kind: 'approval', summaryPublic: 'Human approved outreach (mock)' },
      { kind: 'appointment', summaryPublic: 'Appointment requested (mock)' },
    ],
    timeline: [
      { step: 1, phase: 'compliance', outcome: 'advanced', detail: 'Consent verified' },
      { step: 2, phase: 'approval', outcome: 'advanced', detail: 'Human approved' },
      { step: 3, phase: 'appointment', outcome: 'advanced', detail: 'Slot proposed (dry-run)' },
      { step: 4, phase: 'crm', outcome: 'advanced', detail: 'CRM-lite record written (mock)' },
      { step: 5, phase: 'proof', outcome: 'advanced', detail: 'Proof trace recorded' },
    ],
    noEgress: {
      liveSendOccurred: false,
      statement: 'No live send occurred. All channels ran in dry-run.',
    },
  };
}

function blockedPacket(): GtmRunPacketView {
  return {
    mode: 'mock',
    workspace: { workspaceId: SANDBOX_WORKSPACE, sandbox: true },
    prospect: {
      id: 'p-009',
      companyName: 'Do-Not-Contact Motors',
      sourceRisk: 'high',
      consentStatus: 'do_not_contact',
      fitScore: 0.4,
    },
    status: 'blocked',
    finalState: 'compliance_blocked',
    blockedReason: 'Prospect is on the do-not-contact list',
    compliance: { passed: false, blocked: true, reason: 'do_not_contact' },
    approval: { status: 'pending' },
    appointment: { requested: false, reason: 'halted at compliance' },
    crm: { written: false, reason: 'halted at compliance' },
    proofs: [{ kind: 'compliance_check', summaryPublic: 'Blocked: do-not-contact (mock)' }],
    timeline: [
      { step: 1, phase: 'compliance', outcome: 'blocked', detail: 'Do-not-contact: halted' },
    ],
    noEgress: {
      liveSendOccurred: false,
      statement: 'No live send occurred. Run halted at compliance.',
    },
  };
}

function planForLead(packet: GtmRunPacketView): DryRunChannelAction[] {
  if (!canProceed(packet)) return [];
  return [
    planDryRunAction('email', {
      to: 'sales@northshore-auto.example',
      summary: 'Intro + appointment confirmation (dry-run preview)',
    }),
    planDryRunAction('sms', {
      to: '555-0123',
      summary: 'Reminder for proposed slot (dry-run preview)',
    }),
    planDryRunAction('crm_writeback', {
      to: SANDBOX_WORKSPACE,
      summary: 'Upsert opportunity stage=appointment_set (mock)',
    }),
  ];
}

function buildAudience(): AudienceView {
  return {
    ranked: [
      {
        id: 'p-001',
        companyName: 'Northshore Auto Group',
        source: 'consented_csv',
        score: 0.78,
        evidenceTags: ['source:consented_csv', 'consent:explicit_consent', 'label:SANDBOX'],
      },
      {
        id: 'p-002',
        companyName: 'Budget Wheels Demo',
        source: 'manual',
        score: 0.41,
        evidenceTags: ['source:manual', 'consent:legitimate_interest', 'label:SANDBOX'],
      },
    ],
    rejected: [
      { id: 'p-bad', reason: 'disallowed_source: maps_platform_scrape' },
      { id: 'p-apify', reason: 'disallowed_source: apify' },
    ],
  };
}

function computeTrustOps(funnel: FunnelMetrics): TrustOpsView {
  const decided = funnel.approvalApproved + funnel.approvalRejected;
  const approvalCoverage = funnel.leadsReceived === 0 ? 1 : decided / funnel.leadsReceived;
  // Transparent 0..100 score: approval coverage (40) + compliance-block handling
  // (25) + egress-clean (25) + proof coverage (10).
  const complianceHandled =
    funnel.leadsReceived === 0
      ? 1
      : (funnel.compliancePass + funnel.complianceBlocked) / funnel.leadsReceived;
  const proofCoverage =
    funnel.leadsReceived === 0 ? 1 : Math.min(1, funnel.proofEvents / funnel.leadsReceived);
  const trustScore = Math.round(
    approvalCoverage * 40 + complianceHandled * 25 + 25 + proofCoverage * 10,
  );
  const reportMarkdown = [
    '### TrustOps report (MOCK/SANDBOX)',
    '',
    `- Leads received: ${funnel.leadsReceived}`,
    `- Compliance pass / blocked: ${funnel.compliancePass} / ${funnel.complianceBlocked}`,
    `- Approval approved / rejected: ${funnel.approvalApproved} / ${funnel.approvalRejected}`,
    `- Appointments requested: ${funnel.appointmentRequested}`,
    `- CRM-lite writes (mock): ${funnel.crmWritten}`,
    `- Proof events: ${funnel.proofEvents}`,
    `- Approval coverage: ${(approvalCoverage * 100).toFixed(0)}%`,
    `- Trust score: ${trustScore}/100`,
    `- No live egress: ${'true'}`,
  ].join('\n');
  return { funnel, approvalCoverage, trustScore, noLiveEgress: true, reportMarkdown };
}

/** Build the full deterministic integrated demo view. Pure. */
export function buildIntegratedDemoView(): IntegratedDemoView {
  const leadsRaw: DemoLead[] = [
    { id: 'p-001', companyName: 'Northshore Auto Group', canProceed: true, packet: happyPacket() },
    {
      id: 'p-009',
      companyName: 'Do-Not-Contact Motors',
      canProceed: false,
      packet: blockedPacket(),
    },
  ];

  const leads = leadsRaw.map((lead) => ({
    lead,
    console: toGtmAssemblyConsoleView(lead.packet),
    channelPlan: planForLead(lead.packet),
  }));

  // CRM-lite: only the proceeding lead writes, and writing twice is idempotent.
  const crmStore = new MockCrmStore();
  for (const { lead } of leads) {
    if (canProceed(lead.packet) && lead.packet.crm.written) {
      const upsert: CrmUpsert = {
        workspaceId: SANDBOX_WORKSPACE,
        prospectId: lead.id,
        appointmentRef: 'appt-1',
        stage: 'appointment_set',
      };
      crmStore.upsert(upsert);
      crmStore.upsert(upsert); // idempotent — still one record
    }
  }

  const funnel: FunnelMetrics = {
    leadsReceived: leads.length,
    compliancePass: leads.filter((l) => l.lead.packet.compliance.passed).length,
    complianceBlocked: leads.filter((l) => l.lead.packet.compliance.blocked).length,
    approvalApproved: leads.filter((l) => l.lead.packet.approval.status === 'approved').length,
    approvalRejected: leads.filter((l) => l.lead.packet.approval.status === 'rejected').length,
    appointmentRequested: leads.filter((l) => l.lead.packet.appointment.requested).length,
    crmWritten: crmStore.list().length,
    proofEvents: leads.reduce((n, l) => n + l.lead.packet.proofs.length, 0),
  };

  return {
    banner: DEMO_BANNER,
    workspaceId: SANDBOX_WORKSPACE,
    sandbox: true,
    leads,
    audience: buildAudience(),
    crm: crmStore.list(),
    trustOps: computeTrustOps(funnel),
    releaseGates: [
      evaluateReleaseGate('dry_run'),
      evaluateReleaseGate('private_pilot'),
      evaluateReleaseGate('controlled_live'),
    ],
    whyLiveBlocked: [
      LIVE_BLOCKED_REASON,
      'Dry-run channel actions are typed so `sent` can only ever be false.',
      'The controlled_live release gate fails closed until all sign-offs exist.',
    ],
    controlledLiveRequirements: STAGE_REQUIREMENTS.controlled_live.map((k) => CONDITION_LABELS[k]),
  };
}
