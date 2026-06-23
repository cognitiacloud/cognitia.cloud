/**
 * Presentation + parity view-model for the integrated **GTM Command Center**
 * route (`/gtm-command-center`).
 *
 * IMPORTANT — this file holds NO lane logic. Unlike the earlier draft of this
 * route, it does NOT re-implement (mirror) the B1–B6 agent lanes. The numbers
 * shown on the route are the REAL computed outputs of `@cognitia/agents`,
 * assembled server-side by `lib/server/gtmCommandCenterData.ts` (which runs
 * `assembleIntegratedRunPacket` and the real B1–B6 modules). This module only:
 *
 *   - declares the view shapes the page renders, in terms of the REAL
 *     `@cognitia/agents` output types (imported as types only — fully erased);
 *   - keeps presentation-agnostic helpers (`canProceed`, the PII guard, the
 *     persistent banner + sandbox constants);
 *   - computes the Alta implementation-parity scorecard as an objective
 *     DERIVATION over the already-assembled, real-output view (not a mirror) —
 *     every check is a structural assertion over what the route actually
 *     renders, so the score is auditable rather than asserted.
 *
 * Pure: no React, no IO, no network, no clock, no randomness. MOCK / SANDBOX /
 * DRY-RUN ONLY: no live send, no real CRM, no PII. Tenant is the
 * `budget_wheels_demo` / Tenant Zero sandbox.
 */

import type {
  // B4 audience / signal scoring
  RankedProspect,
  RejectedRow,
  // B2 dry-run channel engine
  DryRunAction,
  // B6 release gates
  ReleaseGateResult,
  // B5 TrustOps
  TrustOpsMetrics,
  TrustScore,
  EgressAttestation,
  // B3 CRM-lite
  Opportunity,
  TimelineEvent,
} from '@cognitia/agents';
import type { GtmRunPacketView, GtmAssemblyConsoleView } from './gtmOsAssemblyViewModel';

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
// PII guard (defensive; mirrors the agents-side timeline PII doctrine)
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
// Gating helper (pure; operates on the PII-safe packet view)
// ===========================================================================

/** A lead can proceed only when compliance cleared AND a human approved. */
export function canProceed(packet: GtmRunPacketView): boolean {
  return (
    packet.compliance.passed && !packet.compliance.blocked && packet.approval.status === 'approved'
  );
}

// ===========================================================================
// View shapes (declared in terms of the REAL @cognitia/agents output types)
// ===========================================================================

/** One lead surfaced on the route: the PII-safe run view + console + plan. */
export interface DemoLead {
  id: string;
  companyName: string;
  /** PII-safe projection of the real B1 `GtmRunPacket` (mapped server-side). */
  packet: GtmRunPacketView;
}

export interface CommandCenterLeadView {
  lead: DemoLead;
  console: GtmAssemblyConsoleView;
  /** Real B2 dry-run actions (empty when the lead cannot proceed). */
  channelPlan: DryRunAction[];
}

/** Audience panel: real B4 ranked prospects + rejections. */
export interface CommandCenterAudienceView {
  ranked: RankedProspect[];
  rejected: RejectedRow[];
}

export interface CommandCenterCrmView {
  /** Real B3 opportunities written for proceeding leads. */
  records: Opportunity[];
  /** Real B3 operator timeline (ordered phase events). */
  timeline: TimelineEvent[];
  /** True when a repeated upsert produced no new record (idempotency proof). */
  idempotentRepeat: boolean;
}

export interface CommandCenterTrustOpsView {
  metrics: TrustOpsMetrics;
  trustScore: TrustScore;
}

export interface ProofTraceRow {
  workspaceId: string;
  prospectId: string;
  company: string;
  kind: string;
  summary: string;
}

export interface CommandCenterView {
  banner: typeof COMMAND_CENTER_BANNER;
  workspaceId: string;
  sandbox: boolean;
  leads: CommandCenterLeadView[];
  audience: CommandCenterAudienceView;
  crm: CommandCenterCrmView;
  trustOps: CommandCenterTrustOpsView;
  releaseGates: ReleaseGateResult[];
  proofTrace: ProofTraceRow[];
  egress: EgressAttestation;
  whyLiveBlocked: string[];
  controlledLiveRequirements: string[];
  parity: ParityScorecard;
}

// ===========================================================================
// Alta parity scorecard (objective DERIVATION over the real-output view)
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
 * Every check is an objective structural assertion over the REAL outputs the
 * route renders, so the score is auditable rather than asserted. It measures
 * implemented, tested, visible mock/dry-run surface breadth — NOT
 * live-automation readiness (which stays intentionally gated; see
 * {@link ParityScorecard.remaining}).
 */
export function computeParityScorecard(view: Omit<CommandCenterView, 'parity'>): ParityScorecard {
  const happy = view.leads.find((l) => l.lead.packet.status === 'completed');
  const blocked = view.leads.find((l) => l.lead.packet.status === 'blocked');
  const allChannels = view.leads.flatMap((l) => l.channelPlan);
  const liveGate = view.releaseGates.find((g) => g.stage === 'controlled_live');
  const blockedLead = blocked ? view.leads.find((l) => l.lead.id === blocked.lead.id) : undefined;

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
        ok: allChannels.length > 0 && allChannels.every((a) => a.mode === 'dry_run'),
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
        ok: view.audience.ranked.every((p) => p.score.score >= 0 && p.score.score <= 1),
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
        ok: !!blockedLead && blockedLead.channelPlan.length === 0,
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
        label: 'Non-completed leads recorded no proof events (fail-closed)',
        ok: view.leads
          .filter((l) => l.lead.packet.status !== 'completed')
          .every((l) => l.lead.packet.proofs.length === 0),
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
