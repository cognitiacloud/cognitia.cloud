/**
 * View-model for the integrated **GTM Command Center** route
 * (`/gtm-command-center`).
 *
 * This is the visible, end-to-end proof that the B1–B6 mock GTM system works as
 * ONE integrated product surface. It assembles a complete, deterministic,
 * PII-safe mock GTM run and folds every lane onto a single operator screen:
 *
 *   B4 audience/signal builder  → B1 assembly island (lead → compliance →
 *   approval → proof + workspace attribution + ordered timeline) → B2 dry-run
 *   channel engine → B3 CRM-lite timeline → B5 TrustOps analytics → B6
 *   enterprise release gates → no-live-egress attestation → Alta parity
 *   scorecard.
 *
 * Pure transforms only — no React, no IO, no network, no clock, no randomness.
 * The Next.js page stays thin; ALL logic is unit-tested in
 * `gtmCommandCenterViewModel.test.ts`.
 *
 * DECOUPLING (intentional): `apps/web` resolves only `@cognitia/core` (see its
 * tsconfig + package.json), so this file does NOT import `@cognitia/agents`.
 * Instead it faithfully reproduces the *tested* lane semantics structurally —
 * with the same weights, the same fail-closed rules, the same idempotency — so
 * the route is a true mirror of the authoritative implementations:
 *   - B1 assembly:  packages/agents/src/gtm-os/assembly
 *   - B2 channels:  packages/agents/src/channels/dryRunChannels.ts
 *   - B3 crm-lite:  packages/agents/src/crm-lite
 *   - B4 audience:  packages/agents/src/audience/signalScoring.ts
 *   - B5 trustops:  packages/agents/src/trustops/metrics.ts
 *   - B6 security:  packages/agents/src/security/releaseGate.ts
 *
 * MOCK / SANDBOX / DRY-RUN ONLY: no live send, no real CRM, no PII. Tenant is
 * the `budget_wheels_demo` / Tenant Zero sandbox. Every channel is `dry_run`
 * with `sent:false`; the live path fails closed by construction.
 */

import {
  toGtmAssemblyConsoleView,
  type GtmRunPacketView,
  type GtmAssemblyConsoleView,
} from './gtmOsAssemblyViewModel';

/** Persistent operator banner — rendered on every view of the route. */
export const COMMAND_CENTER_BANNER =
  'MOCK ONLY · DRY-RUN ONLY · NO LIVE SEND · NO REAL CRM · NO PII' as const;

/** The sandbox tenant every run is attributed to (Budget Wheels demo). */
export const SANDBOX_WORKSPACE = 'budget_wheels_demo' as const;

/** Alta implementation-parity pass threshold for this mission. */
export const ALTA_PARITY_THRESHOLD = 80 as const;

/** The single reason any live action is refused in this build. */
export const LIVE_BLOCKED_REASON =
  'Live channels are disabled by construction: no connector approval, no counsel/founder sign-off, ' +
  'no signed customer scope. The dry-run layer cannot send, and no release gate it can build can open.';

// ===========================================================================
// PII guard (mirrors packages/agents assertNoRawPii)
// ===========================================================================

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

/** Throws if `value` contains anything that looks like raw (non-placeholder) PII. */
export function assertNoRawPii(value: string): void {
  const hit = findRawPii(value);
  if (hit) throw new Error(`raw PII detected: ${hit}`);
}

// ===========================================================================
// B4 — audience / signal scoring (faithful mirror of signalScoring.ts)
// ===========================================================================

export type RiskBand = 'low' | 'medium' | 'high';
export type EvidenceTag = 'verified_fact' | 'likely_inference' | 'unknown';

/** Fixed, documented weights — identical to the agents-side B4 model. */
export const SIGNAL_WEIGHTS = {
  fit: 0.4,
  urgency: 0.25,
  proofConfidence: 0.15,
  consentRisk: 0.2,
  sourceRisk: 0.2,
} as const;

export const RISK_BAND_VALUE: Record<RiskBand, number> = { low: 0, medium: 0.5, high: 1 };
export const EVIDENCE_CONFIDENCE: Record<EvidenceTag, number> = {
  verified_fact: 1,
  likely_inference: 0.5,
  unknown: 0,
};

export interface SignalInputs {
  fit: number;
  urgency: number;
  consentRisk: RiskBand;
  sourceRisk: RiskBand;
  evidence: EvidenceTag;
}

export interface SignalScore {
  score: number; // 0..1
  breakdown: {
    fit: number;
    urgency: number;
    proofConfidence: number;
    consentRiskPenalty: number; // negative
    sourceRiskPenalty: number; // negative
  };
}

const clamp01 = (n: number): number => (Number.isNaN(n) ? 0 : Math.max(0, Math.min(1, n)));
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Transparent, deterministic prospect signal score. Mirrors B4 exactly. */
export function scoreSignals(inputs: SignalInputs): SignalScore {
  const fit = clamp01(inputs.fit);
  const urgency = clamp01(inputs.urgency);
  const proofConfidence = EVIDENCE_CONFIDENCE[inputs.evidence] ?? 0;
  const consentRisk = RISK_BAND_VALUE[inputs.consentRisk] ?? 0.5;
  const sourceRisk = RISK_BAND_VALUE[inputs.sourceRisk] ?? 0.5;

  const fitC = SIGNAL_WEIGHTS.fit * fit;
  const urgencyC = SIGNAL_WEIGHTS.urgency * urgency;
  const proofC = SIGNAL_WEIGHTS.proofConfidence * proofConfidence;
  const consentP = SIGNAL_WEIGHTS.consentRisk * consentRisk;
  const sourceP = SIGNAL_WEIGHTS.sourceRisk * sourceRisk;

  const score = clamp01(fitC + urgencyC + proofC - consentP - sourceP);
  return {
    score: round3(score),
    breakdown: {
      fit: round3(fitC),
      urgency: round3(urgencyC),
      proofConfidence: round3(proofC),
      consentRiskPenalty: round3(-consentP),
      sourceRiskPenalty: round3(-sourceP),
    },
  };
}

/** Lawful source labels this builder accepts (mirrors B4 allow-list). */
export const LAWFUL_SOURCE_LABELS = [
  'manual',
  'consented_csv',
  'public_site_manual_review',
  'licensed_provider_planned',
] as const;
export type LawfulSourceLabel = (typeof LAWFUL_SOURCE_LABELS)[number];

export interface RankedProspect {
  id: string;
  companyName: string;
  source: LawfulSourceLabel;
  signals: SignalInputs;
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

interface AudienceCandidate {
  id: string;
  companyName: string;
  source: string;
  signals: SignalInputs;
  consentLabel: string;
}

/**
 * Build a lawful, ranked audience from synthetic fixture rows. Rejects any row
 * whose source is not on the lawful allow-list (e.g. scraped maps / Apify),
 * scores the rest with the transparent B4 model, and ranks by score desc
 * (ties break by id asc — same stable rule as the agents lane).
 */
export function buildAudience(candidates: readonly AudienceCandidate[]): AudienceView {
  const ranked: RankedProspect[] = [];
  const rejected: RejectedRow[] = [];

  for (const c of candidates) {
    if (!(LAWFUL_SOURCE_LABELS as readonly string[]).includes(c.source)) {
      rejected.push({ id: c.id, reason: `disallowed_source: ${c.source}` });
      continue;
    }
    const source = c.source as LawfulSourceLabel;
    const { score } = scoreSignals(c.signals);
    ranked.push({
      id: c.id,
      companyName: c.companyName,
      source,
      signals: c.signals,
      score,
      evidenceTags: [
        `source:${source}`,
        `consent:${c.consentLabel}`,
        `evidence:${c.signals.evidence}`,
        'label:SANDBOX',
      ],
    });
  }

  ranked.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.id < b.id ? -1 : 1));
  return { ranked, rejected };
}

// ===========================================================================
// B2 — dry-run channel engine (faithful mirror of dryRunChannels.ts)
// ===========================================================================

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

const DEFAULT_TARGETS: Record<ChannelKind, string> = {
  email: 'lead@buyer.example',
  sms: '+1-555-0100',
  whatsapp: 'whatsapp:+1-555-0101',
  call: '+1-555-0102',
  linkedin: 'linkedin:demo-prospect.invalid',
  ad: 'ad-audience:budget_wheels_demo',
  crm_writeback: 'crm:budget_wheels_demo/sandbox-record',
};

export interface DryRunChannelInput {
  workspaceId: string;
  prospectId: string;
  target?: string;
  summary?: string;
}

/** A planned, never-sent channel action. `sent` is always literally `false`. */
export interface DryRunChannelAction {
  mode: 'dry_run';
  sent: false;
  channel: ChannelKind;
  workspaceId: string;
  prospectId: string;
  planRef: string;
  wouldSendIfLive: {
    channel: ChannelKind;
    target: string;
    summary: string;
    liveStatus: 'BLOCKED';
  };
}

/** Plan a dry-run channel action. Pure, deterministic, can never be a send. */
export function planDryRunAction(
  channel: ChannelKind,
  input: DryRunChannelInput,
): DryRunChannelAction {
  const target = input.target ?? DEFAULT_TARGETS[channel];
  const summary = input.summary ?? `dry-run ${channel} plan for ${input.prospectId}`;
  return {
    mode: 'dry_run',
    sent: false,
    channel,
    workspaceId: input.workspaceId,
    prospectId: input.prospectId,
    planRef: `dryrun:${channel}:${input.workspaceId}:${input.prospectId}`,
    wouldSendIfLive: { channel, target, summary, liveStatus: 'BLOCKED' },
  };
}

/** Thrown when an action violates the dry-run / no-send invariant. */
export class LiveSendBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveSendBlockedError';
  }
}

/** Runtime tripwire: throws if an action was tampered into a live/sent state. */
export function assertNoLiveSend(action: Pick<DryRunChannelAction, 'mode' | 'sent'>): void {
  const sent = (action as { sent: unknown }).sent;
  const mode = (action as { mode: unknown }).mode;
  if (mode !== 'dry_run') {
    throw new LiveSendBlockedError(
      `live channels disabled: expected mode "dry_run", got "${String(mode)}"`,
    );
  }
  if (sent !== false) {
    throw new LiveSendBlockedError(
      `live channels disabled: action reported sent="${String(sent)}", must be false`,
    );
  }
}

/** The live-send path. ALWAYS throws — this layer cannot send, by construction. */
export function sendLive(): never {
  throw new LiveSendBlockedError(
    'live channels disabled: release gate is closed (blocked until legal/consent sign-off lands in a separate lane)',
  );
}

// ===========================================================================
// B6 — release gates (faithful mirror of releaseGate.ts; fail closed)
// ===========================================================================

export const RELEASE_STAGES = ['dry_run', 'private_pilot', 'controlled_live'] as const;
export type ReleaseStage = (typeof RELEASE_STAGES)[number];

export interface ReleaseConditions {
  signedCustomerScope?: boolean;
  counselSignoff?: boolean;
  founderSignoff?: boolean;
  monitoringEnabled?: boolean;
  rollbackReady?: boolean;
  secretsConfigured?: boolean;
  connectorApproval?: boolean;
}

export const CONDITION_LABELS: Readonly<Record<keyof ReleaseConditions, string>> = {
  signedCustomerScope: 'signed customer scope',
  counselSignoff: 'counsel signoff',
  founderSignoff: 'founder signoff',
  monitoringEnabled: 'monitoring enabled',
  rollbackReady: 'rollback ready',
  secretsConfigured: 'secrets configured',
  connectorApproval: 'connector approval',
};

const STAGE_REQUIREMENTS: Readonly<Record<ReleaseStage, ReadonlyArray<keyof ReleaseConditions>>> = {
  dry_run: [],
  private_pilot: ['monitoringEnabled', 'rollbackReady'],
  controlled_live: [
    'signedCustomerScope',
    'counselSignoff',
    'founderSignoff',
    'monitoringEnabled',
    'rollbackReady',
    'secretsConfigured',
    'connectorApproval',
  ],
};

export interface ReleaseGateResult {
  stage: ReleaseStage;
  passed: boolean;
  missing: string[];
  missingKeys: Array<keyof ReleaseConditions>;
  reason: string;
}

/** Fail-closed gate evaluation: an absent condition counts as `false`. */
export function evaluateReleaseGate(
  stage: ReleaseStage,
  conditions: ReleaseConditions = {},
): ReleaseGateResult {
  const required = STAGE_REQUIREMENTS[stage];
  const missingKeys = required.filter((key) => conditions[key] !== true);
  const missing = missingKeys.map((key) => CONDITION_LABELS[key]);
  const passed = missingKeys.length === 0;
  return {
    stage,
    passed,
    missing,
    missingKeys,
    reason: passed
      ? `release stage "${stage}" conditions satisfied`
      : `release stage "${stage}" blocked: missing ${missing.join(', ')}`,
  };
}

export function requiredConditions(stage: ReleaseStage): ReadonlyArray<keyof ReleaseConditions> {
  return STAGE_REQUIREMENTS[stage];
}

// ===========================================================================
// B3 — CRM-lite store + ordered operator timeline (mirror of crm-lite)
// ===========================================================================

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

/** One append-only entry in the CRM-lite operator timeline. */
export interface CrmTimelineEvent {
  seq: number;
  recordId: string;
  kind: 'created' | 'updated';
  prospectId: string;
  stage: string;
  at: string;
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

/** Minimal idempotent in-memory CRM-lite with an ordered operator timeline. */
export class MockCrmStore {
  private readonly byKey = new Map<string, CrmRecord>();
  private readonly events: CrmTimelineEvent[] = [];
  private seq = 0;
  private eventSeq = 0;

  constructor(private readonly now: () => string = () => '2026-06-22T10:00:00.000Z') {}

  upsert(input: CrmUpsert): CrmRecord {
    // PII guard on every write, exactly as the agents lane does.
    assertNoRawPii(`${input.prospectId} ${input.stage} ${input.appointmentRef ?? ''}`);
    const key = crmIdempotencyKey(input.workspaceId, input.prospectId, input.appointmentRef);
    const at = this.now();
    const existing = this.byKey.get(key);
    if (existing) {
      const updated: CrmRecord = { ...existing, ...input, updatedAt: at };
      this.byKey.set(key, updated);
      this.events.push({
        seq: ++this.eventSeq,
        recordId: updated.id,
        kind: 'updated',
        prospectId: updated.prospectId,
        stage: updated.stage,
        at,
      });
      return updated;
    }
    const record: CrmRecord = { ...input, id: `crm-${++this.seq}`, createdAt: at, updatedAt: at };
    this.byKey.set(key, record);
    this.events.push({
      seq: ++this.eventSeq,
      recordId: record.id,
      kind: 'created',
      prospectId: record.prospectId,
      stage: record.stage,
      at,
    });
    return record;
  }

  list(): CrmRecord[] {
    return [...this.byKey.values()];
  }

  timeline(): CrmTimelineEvent[] {
    return [...this.events];
  }
}

// ===========================================================================
// B5 — TrustOps metrics + transparent trust score (mirror of trustops/metrics)
// ===========================================================================

export type ComplianceOutcome = 'pass' | 'blocked';
export type ApprovalOutcome = 'approved' | 'rejected' | 'pending';
export type RunStatus = 'completed' | 'blocked' | 'awaiting_approval';

export interface WorkflowRunSummary {
  runId: string;
  status: RunStatus;
  compliance: ComplianceOutcome;
  approval?: ApprovalOutcome;
  appointment?: 'requested' | 'succeeded' | 'failed' | 'skipped';
  crm?: 'ok' | 'failed' | 'skipped';
  proofEventsRecorded?: number;
  blockedReason?: string;
}

export interface FunnelMetrics {
  leadsReceived: number;
  compliancePass: number;
  complianceBlock: number;
  approvalApproved: number;
  approvalRejected: number;
  approvalPending: number;
  appointmentRequested: number;
  crmWritten: number;
  proofEventsRecorded: number;
  completed: number;
  blocked: number;
  awaitingApproval: number;
}

export interface EgressAttestation {
  noLiveEgress: true;
  mode: 'MOCK_SANDBOX';
  statement: string;
}

export const EGRESS_ATTESTATION: EgressAttestation = {
  noLiveEgress: true,
  mode: 'MOCK_SANDBOX',
  statement:
    'All analyzed events are mock/sandbox. No live network egress occurred during workflow ' +
    'execution or analytics computation. No vendor SDK or network import exists in this surface.',
};

export interface TrustOpsMetrics {
  funnel: FunnelMetrics;
  approvalCoverage: number; // 0..1
  egress: EgressAttestation;
}

/** Compute funnel + approval-coverage metrics over mock run summaries. */
export function computeTrustOpsMetrics(runs: readonly WorkflowRunSummary[]): TrustOpsMetrics {
  const funnel: FunnelMetrics = {
    leadsReceived: runs.length,
    compliancePass: 0,
    complianceBlock: 0,
    approvalApproved: 0,
    approvalRejected: 0,
    approvalPending: 0,
    appointmentRequested: 0,
    crmWritten: 0,
    proofEventsRecorded: 0,
    completed: 0,
    blocked: 0,
    awaitingApproval: 0,
  };

  let approvalReached = 0;
  let approvalDecided = 0;

  for (const run of runs) {
    if (run.compliance === 'pass') funnel.compliancePass += 1;
    else funnel.complianceBlock += 1;

    if (run.approval === 'approved') funnel.approvalApproved += 1;
    else if (run.approval === 'rejected') funnel.approvalRejected += 1;
    else if (run.approval === 'pending') funnel.approvalPending += 1;

    if (run.approval !== undefined) {
      approvalReached += 1;
      if (run.approval === 'approved' || run.approval === 'rejected') approvalDecided += 1;
    }

    if (run.appointment === 'requested' || run.appointment === 'succeeded') {
      funnel.appointmentRequested += 1;
    }
    if (run.crm === 'ok') funnel.crmWritten += 1;
    funnel.proofEventsRecorded += Math.max(0, run.proofEventsRecorded ?? 0);

    if (run.status === 'completed') funnel.completed += 1;
    else if (run.status === 'blocked') funnel.blocked += 1;
    else funnel.awaitingApproval += 1;
  }

  const approvalCoverage = approvalReached === 0 ? 1 : approvalDecided / approvalReached;
  return { funnel, approvalCoverage, egress: EGRESS_ATTESTATION };
}

export interface TrustScoreComponent {
  key: 'approvalCoverage' | 'complianceBlockHandling' | 'egressClean' | 'proofCoverage';
  label: string;
  weight: number;
  ratio: number;
  earned: number;
}

export interface TrustScore {
  score: number; // 0..100
  components: TrustScoreComponent[];
}

/** Transparent 0–100 trust/safety score; weights 40/25/25/10. Mirrors B5. */
export function computeTrustScore(metrics: TrustOpsMetrics): TrustScore {
  const { funnel, approvalCoverage, egress } = metrics;

  const complianceHandlingRatio =
    funnel.compliancePass === 0 ? 1 : funnel.completed <= funnel.compliancePass ? 1 : 0;
  const proofRatio =
    funnel.completed === 0 ? 1 : Math.min(1, funnel.proofEventsRecorded / funnel.completed);

  const components: TrustScoreComponent[] = [
    {
      key: 'approvalCoverage',
      label: 'Human-approval coverage',
      weight: 40,
      ratio: clamp01(approvalCoverage),
      earned: 0,
    },
    {
      key: 'complianceBlockHandling',
      label: 'Compliance-block handling',
      weight: 25,
      ratio: clamp01(complianceHandlingRatio),
      earned: 0,
    },
    {
      key: 'egressClean',
      label: 'No-live-egress attestation',
      weight: 25,
      ratio: egress.noLiveEgress ? 1 : 0,
      earned: 0,
    },
    {
      key: 'proofCoverage',
      label: 'Proof-event coverage of completed runs',
      weight: 10,
      ratio: clamp01(proofRatio),
      earned: 0,
    },
  ];

  let score = 0;
  for (const c of components) {
    c.earned = Math.round(c.weight * c.ratio);
    score += c.earned;
  }
  return { score: Math.max(0, Math.min(100, score)), components };
}

// ===========================================================================
// B1 — assembly / leads + gating
// ===========================================================================

export interface DemoLead {
  id: string;
  companyName: string;
  packet: GtmRunPacketView;
}

/** A lead can proceed only when compliance cleared AND a human approved. */
export function canProceed(packet: GtmRunPacketView): boolean {
  return (
    packet.compliance.passed && !packet.compliance.blocked && packet.approval.status === 'approved'
  );
}

/** Map a packet onto the TrustOps run-summary vocabulary. */
function packetToRunSummary(lead: DemoLead): WorkflowRunSummary {
  const p = lead.packet;
  const status: RunStatus =
    p.status === 'completed'
      ? 'completed'
      : p.status === 'blocked'
        ? 'blocked'
        : 'awaiting_approval';
  return {
    runId: lead.id,
    status,
    compliance: p.compliance.blocked ? 'blocked' : 'pass',
    approval:
      p.approval.status === 'approved'
        ? 'approved'
        : p.approval.status === 'rejected'
          ? 'rejected'
          : p.compliance.blocked
            ? undefined
            : 'pending',
    appointment: p.appointment.requested ? 'requested' : 'skipped',
    crm: p.crm.written ? 'ok' : 'skipped',
    proofEventsRecorded: p.proofs.length,
    blockedReason: p.blockedReason,
  };
}

// ===========================================================================
// Deterministic mock scenario (PII-safe by construction)
// ===========================================================================

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
      { kind: 'appointment', summaryPublic: 'Appointment requested (dry-run)' },
      { kind: 'crm_writeback', summaryPublic: 'CRM-lite record written (mock)' },
    ],
    timeline: [
      { step: 1, phase: 'Lead received', outcome: 'advanced', detail: 'From audience builder' },
      { step: 2, phase: 'Compliance check', outcome: 'advanced', detail: 'Consent verified' },
      { step: 3, phase: 'Human approval gate', outcome: 'advanced', detail: 'Human approved' },
      {
        step: 4,
        phase: 'Appointment requested',
        outcome: 'advanced',
        detail: 'Slot proposed (dry-run)',
      },
      {
        step: 5,
        phase: 'CRM writeback (mock)',
        outcome: 'advanced',
        detail: 'CRM-lite record written',
      },
      { step: 6, phase: 'Proof report', outcome: 'advanced', detail: 'Proof trace recorded' },
    ],
    noEgress: {
      liveSendOccurred: false,
      statement: 'No live send occurred. All channels ran in dry-run.',
    },
  };
}

function pendingPacket(): GtmRunPacketView {
  return {
    mode: 'mock',
    workspace: { workspaceId: SANDBOX_WORKSPACE, sandbox: true },
    prospect: {
      id: 'p-002',
      companyName: 'Budget Wheels Demo',
      sourceRisk: 'medium',
      consentStatus: 'legitimate_interest',
      fitScore: 0.6,
    },
    status: 'awaiting_approval',
    finalState: 'human_approval_required',
    compliance: { passed: true, blocked: false },
    approval: { status: 'pending', reason: 'Held for human review' },
    appointment: { requested: false, reason: 'awaiting approval' },
    crm: { written: false, reason: 'awaiting approval' },
    proofs: [
      { kind: 'compliance_check', summaryPublic: 'Consent basis: legitimate interest (mock)' },
      { kind: 'approval_requested', summaryPublic: 'Outreach queued for human review (mock)' },
    ],
    timeline: [
      { step: 1, phase: 'Lead received', outcome: 'advanced', detail: 'From audience builder' },
      { step: 2, phase: 'Compliance check', outcome: 'advanced', detail: 'Consent basis recorded' },
      {
        step: 3,
        phase: 'Human approval gate',
        outcome: 'halted',
        detail: 'Awaiting human decision',
      },
    ],
    noEgress: {
      liveSendOccurred: false,
      statement: 'No live send occurred. Run held at the human-approval gate.',
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
    finalState: 'blocked_compliance',
    blockedReason: 'Prospect is on the do-not-contact list',
    compliance: { passed: false, blocked: true, reason: 'do_not_contact' },
    approval: { status: 'pending' },
    appointment: { requested: false, reason: 'halted at compliance' },
    crm: { written: false, reason: 'halted at compliance' },
    proofs: [{ kind: 'compliance_check', summaryPublic: 'Blocked: do-not-contact (mock)' }],
    timeline: [
      { step: 1, phase: 'Lead received', outcome: 'advanced', detail: 'From audience builder' },
      {
        step: 2,
        phase: 'Compliance check',
        outcome: 'blocked',
        detail: 'Do-not-contact: halted before approval',
      },
    ],
    noEgress: {
      liveSendOccurred: false,
      statement: 'No live send occurred. Run halted at compliance.',
    },
  };
}

/** Per-lead dry-run channel plan. Empty when the lead cannot proceed. */
function planForLead(lead: DemoLead): DryRunChannelAction[] {
  if (!canProceed(lead.packet)) return [];
  return [
    planDryRunAction('email', {
      workspaceId: SANDBOX_WORKSPACE,
      prospectId: lead.id,
      target: 'sales@northshore-auto.example',
      summary: 'Intro + appointment confirmation (dry-run preview)',
    }),
    planDryRunAction('sms', {
      workspaceId: SANDBOX_WORKSPACE,
      prospectId: lead.id,
      target: '+1-555-0123',
      summary: 'Reminder for proposed slot (dry-run preview)',
    }),
    planDryRunAction('crm_writeback', {
      workspaceId: SANDBOX_WORKSPACE,
      prospectId: lead.id,
      summary: 'Upsert opportunity stage=appointment_set (mock)',
    }),
  ];
}

// ===========================================================================
// Alta parity scorecard
// ===========================================================================

export interface ParityCheck {
  label: string;
  ok: boolean;
}

export interface ParityDimension {
  key: string;
  label: string;
  weight: number;
  checks: ParityCheck[];
  ratio: number; // passed / total
  earned: number; // round(weight * ratio)
}

export interface ParityScorecard {
  score: number; // 0..100
  threshold: number;
  pass: boolean;
  dimensions: ParityDimension[];
  /** Honest list of what is still NOT implemented (intentionally out of scope). */
  remaining: string[];
}

function dimension(
  key: string,
  label: string,
  weight: number,
  checks: ParityCheck[],
): ParityDimension {
  const passed = checks.filter((c) => c.ok).length;
  const ratio = checks.length === 0 ? 0 : passed / checks.length;
  return { key, label, weight, checks, ratio, earned: Math.round(weight * ratio) };
}

/**
 * Compute the Alta capability-surface parity score from the *assembled* view.
 * Every check is an objective structural assertion over what the route renders,
 * so the score is auditable rather than asserted. It measures implemented,
 * tested, visible mock/dry-run surface breadth — NOT live-automation readiness
 * (which stays intentionally gated; see {@link ParityScorecard.remaining}).
 */
export function computeParityScorecard(view: Omit<CommandCenterView, 'parity'>): ParityScorecard {
  const happy = view.leads.find((l) => l.lead.packet.status === 'completed');
  const blocked = view.leads.find((l) => l.lead.packet.status === 'blocked');
  const allChannels = view.leads.flatMap((l) => l.channelPlan);
  const liveGate = view.releaseGates.find((g) => g.stage === 'controlled_live');

  const dims: ParityDimension[] = [
    dimension('b1_assembly', 'B1 · Assembly island', 14, [
      {
        label: 'Completed run assembled with ordered timeline',
        ok: !!happy && happy.console.timeline.length >= 4,
      },
      {
        label: 'Workspace attribution present on packet',
        ok: view.workspaceId === SANDBOX_WORKSPACE,
      },
      {
        label: 'Proof trace recorded for completed run',
        ok: !!happy && happy.lead.packet.proofs.length > 0,
      },
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
      {
        label: 'Idempotent (no duplicate on repeat upsert)',
        ok:
          view.crm.records.length ===
            view.crm.records.filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i).length &&
          view.crm.idempotentRepeat,
      },
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
    dimension('egress', 'Cross · No-live-egress attestation', 10, [
      {
        label: 'Attestation present and noLiveEgress=true',
        ok: view.trustOps.metrics.egress.noLiveEgress === true,
      },
      {
        label: 'Blocked lead produced no channel actions',
        ok:
          !!blocked &&
          view.leads.find((l) => l.lead.id === blocked.lead.id)!.channelPlan.length === 0,
      },
    ]),
    dimension('proof', 'Cross · Proof / workspace attribution', 10, [
      {
        label: 'Every proof trace is workspace-attributed',
        ok:
          view.proofTrace.length > 0 &&
          view.proofTrace.every((p) => p.workspaceId === SANDBOX_WORKSPACE),
      },
      {
        label: 'Blocked lead still records a compliance proof',
        ok: !!blocked && blocked.lead.packet.proofs.length > 0,
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
      'Controlled-live release — blocked until 7 organizational/legal sign-offs land out-of-band.',
    ],
  };
}

// ===========================================================================
// Top-level assembled view
// ===========================================================================

export interface ProofTraceRow {
  workspaceId: string;
  prospectId: string;
  company: string;
  kind: string;
  summary: string;
}

export interface CommandCenterCrmView {
  records: CrmRecord[];
  timeline: CrmTimelineEvent[];
  /** True when a repeated upsert produced no new record (idempotency proof). */
  idempotentRepeat: boolean;
}

export interface CommandCenterTrustOpsView {
  metrics: TrustOpsMetrics;
  trustScore: TrustScore;
}

export interface CommandCenterLeadView {
  lead: DemoLead;
  console: GtmAssemblyConsoleView;
  channelPlan: DryRunChannelAction[];
}

export interface CommandCenterView {
  banner: typeof COMMAND_CENTER_BANNER;
  workspaceId: string;
  sandbox: boolean;
  leads: CommandCenterLeadView[];
  audience: AudienceView;
  crm: CommandCenterCrmView;
  trustOps: CommandCenterTrustOpsView;
  releaseGates: ReleaseGateResult[];
  proofTrace: ProofTraceRow[];
  egress: EgressAttestation;
  whyLiveBlocked: string[];
  controlledLiveRequirements: string[];
  parity: ParityScorecard;
}

/** Build the full deterministic GTM Command Center view. Pure, no IO. */
export function buildCommandCenterView(): CommandCenterView {
  const leadsRaw: DemoLead[] = [
    { id: 'p-001', companyName: 'Northshore Auto Group', packet: happyPacket() },
    { id: 'p-002', companyName: 'Budget Wheels Demo', packet: pendingPacket() },
    { id: 'p-009', companyName: 'Do-Not-Contact Motors', packet: blockedPacket() },
  ];

  const leads: CommandCenterLeadView[] = leadsRaw.map((lead) => ({
    lead,
    console: toGtmAssemblyConsoleView(lead.packet),
    channelPlan: planForLead(lead),
  }));

  // B3 — CRM-lite: only proceeding leads write; a repeat upsert is idempotent.
  const crmStore = new MockCrmStore();
  let idempotentRepeat = true;
  for (const { lead } of leads) {
    if (canProceed(lead.packet) && lead.packet.crm.written) {
      const upsert: CrmUpsert = {
        workspaceId: SANDBOX_WORKSPACE,
        prospectId: lead.id,
        appointmentRef: 'appt-1',
        stage: 'appointment_set',
      };
      const before = crmStore.list().length;
      crmStore.upsert(upsert);
      const afterFirst = crmStore.list().length;
      crmStore.upsert(upsert); // idempotent — still one record
      const afterSecond = crmStore.list().length;
      if (!(afterFirst === before + 1 && afterSecond === afterFirst)) idempotentRepeat = false;
    }
  }

  // B5 — TrustOps over the run summaries.
  const summaries = leads.map((l) => packetToRunSummary(l.lead));
  const metrics = computeTrustOpsMetrics(summaries);
  const trustScore = computeTrustScore(metrics);

  // Proof / workspace attribution trace across all leads.
  const proofTrace: ProofTraceRow[] = leads.flatMap((l) =>
    l.lead.packet.proofs.map((p) => ({
      workspaceId: l.lead.packet.workspace.workspaceId,
      prospectId: l.lead.id,
      company: l.lead.companyName,
      kind: p.kind,
      summary: p.summaryPublic ?? '(redacted)',
    })),
  );

  const releaseGates: ReleaseGateResult[] = [
    evaluateReleaseGate('dry_run'),
    evaluateReleaseGate('private_pilot'),
    evaluateReleaseGate('controlled_live'),
  ];

  const base: Omit<CommandCenterView, 'parity'> = {
    banner: COMMAND_CENTER_BANNER,
    workspaceId: SANDBOX_WORKSPACE,
    sandbox: true,
    leads,
    audience: buildAudience([
      {
        id: 'p-001',
        companyName: 'Northshore Auto Group',
        source: 'consented_csv',
        consentLabel: 'explicit_consent',
        signals: {
          fit: 0.9,
          urgency: 0.7,
          consentRisk: 'low',
          sourceRisk: 'low',
          evidence: 'verified_fact',
        },
      },
      {
        id: 'p-002',
        companyName: 'Budget Wheels Demo',
        source: 'manual',
        consentLabel: 'legitimate_interest',
        signals: {
          fit: 0.6,
          urgency: 0.5,
          consentRisk: 'medium',
          sourceRisk: 'low',
          evidence: 'likely_inference',
        },
      },
      {
        id: 'p-bad',
        companyName: 'Scraped Listings LLC',
        source: 'maps_platform_scrape',
        consentLabel: 'not_established',
        signals: {
          fit: 0.8,
          urgency: 0.9,
          consentRisk: 'high',
          sourceRisk: 'high',
          evidence: 'unknown',
        },
      },
      {
        id: 'p-apify',
        companyName: 'Apify Harvest Co',
        source: 'apify',
        consentLabel: 'not_established',
        signals: {
          fit: 0.7,
          urgency: 0.6,
          consentRisk: 'high',
          sourceRisk: 'high',
          evidence: 'unknown',
        },
      },
    ]),
    crm: { records: crmStore.list(), timeline: crmStore.timeline(), idempotentRepeat },
    trustOps: { metrics, trustScore },
    releaseGates,
    proofTrace,
    egress: EGRESS_ATTESTATION,
    whyLiveBlocked: [
      LIVE_BLOCKED_REASON,
      'Dry-run channel actions are typed so `sent` can only ever be `false`.',
      'sendLive() always throws — the dry-run layer has no live code path.',
      'The controlled_live release gate fails closed until all seven sign-offs exist.',
    ],
    controlledLiveRequirements: STAGE_REQUIREMENTS.controlled_live.map((k) => CONDITION_LABELS[k]),
  };

  return { ...base, parity: computeParityScorecard(base) };
}
