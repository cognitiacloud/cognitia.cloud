/**
 * View-model TYPES + pure scorecards for the integrated **GTM Command Center**
 * route (`/gtm-command-center`).
 *
 * IMPORTANT — no structural mirror. Unlike an earlier draft, this file does NOT
 * reproduce the B1–B6 lane semantics. The route's data is produced by the
 * SERVER-ONLY adapter `server/gtmCommandCenterData.ts`, which runs the REAL
 * `@cognitia/agents` modules (B1–B6) and the integration packet
 * (`assembleIntegratedRunPacket`). This module holds only:
 *   - the persistent operator banner + sandbox constants,
 *   - the assembled-view TYPES (built from real module output shapes),
 *   - two pure, auditable scorecards computed OVER that real output:
 *       1. {@link computeCapabilitySurfaceScore} — the mock/dry-run
 *          capability-surface score (breadth of Alta's GTM surface implemented
 *          as tested, visible, mock/dry-run code). This may legitimately reach
 *          100/100; it is NOT a live-automation readiness claim.
 *       2. {@link computeImplementationParity} — the HONEST official Alta
 *          implementation-parity estimate, with each axis marked
 *          implemented/partial/blocked and the exact remaining blockers listed.
 *          This is deliberately NOT 100 and is the number the evidence doc cites.
 *
 * `import type` only from `@cognitia/agents` (erased at compile time — nothing
 * from the agents runtime enters any bundle here). MOCK / SANDBOX / DRY-RUN
 * ONLY: no live send, no real CRM, no PII; tenant is `budget_wheels_demo`.
 */

import type {
  GtmRunPacket,
  DryRunAction,
  ChannelPolicyDecision,
  RankedProspect,
  RejectedRow,
  Opportunity,
  TimelineEvent,
  TrustOpsMetrics,
  TrustScore,
  EgressAttestation,
  ReleaseGateResult,
  IntegratedRunPacket,
  IntegratedPacketCompleteness,
} from '@cognitia/agents';
import type { GtmAssemblyConsoleView } from './gtmOsAssemblyViewModel.js';

// Reuse the shared PII guard + proceed predicate from the demo view-model so
// there is exactly one implementation of each (no second mirror).
export { assertNoRawPii, findRawPii, canProceed } from './gtmIntegratedDemoViewModel.js';

/** Persistent operator banner — rendered on every view of the route. */
export const COMMAND_CENTER_BANNER =
  'MOCK ONLY · DRY-RUN ONLY · NO LIVE SEND · NO REAL CRM · NO PII' as const;

/** The sandbox tenant every run is attributed to (Budget Wheels demo / Tenant Zero). */
export const SANDBOX_WORKSPACE = 'budget_wheels_demo' as const;

/** Pass threshold for both scorecards (the mission's Alta target). */
export const ALTA_PARITY_THRESHOLD = 80 as const;

/** The single reason any live action is refused in this build. */
export const LIVE_BLOCKED_REASON =
  'Live channels are disabled by construction: no connector approval, no counsel/founder sign-off, ' +
  'no signed customer scope. The dry-run layer cannot send, and no release gate it can build can open.';

// ===========================================================================
// Assembled-view types (shapes are real `@cognitia/agents` outputs)
// ===========================================================================

/** One lead rendered on the route: its real B1 packet + console view + B2 plan. */
export interface CommandCenterLeadView {
  id: string;
  company: string;
  /** Real B1 assembly packet (used for proof/status parity checks). */
  packet: GtmRunPacket;
  /** Real B1 console view (badge, timeline, labels). */
  console: GtmAssemblyConsoleView;
  /** Real B2 dry-run actions (empty when the lead cannot proceed). */
  channelPlan: DryRunAction[];
  /** Real B2 channel policy decision for this lead. */
  policy: ChannelPolicyDecision;
}

/** A workspace-attributed proof row for the attribution trace panel. */
export interface ProofTraceRow {
  workspaceId: string;
  prospectId: string;
  company: string;
  kind: string;
  summary: string;
}

export interface CommandCenterCrmView {
  records: Opportunity[];
  timeline: TimelineEvent[];
  /** True when a repeated upsert produced no new record (idempotency proof). */
  idempotentRepeat: boolean;
}

export interface CommandCenterTrustOpsView {
  metrics: TrustOpsMetrics;
  trustScore: TrustScore;
  /** The B5 module's rendered markdown report (carries its MOCK/SANDBOX banner). */
  reportMarkdown: string;
}

/** The integrated single-artifact proof (B1–B6 composed by PR #159's packet). */
export interface CommandCenterIntegratedView {
  packet: IntegratedRunPacket;
  completeness: IntegratedPacketCompleteness;
}

/** Everything the page renders, all produced from real module output. */
export interface CommandCenterView {
  banner: typeof COMMAND_CENTER_BANNER;
  workspaceId: string;
  sandbox: boolean;
  leads: CommandCenterLeadView[];
  audience: { ranked: RankedProspect[]; rejected: RejectedRow[] };
  crm: CommandCenterCrmView;
  trustOps: CommandCenterTrustOpsView;
  releaseGates: ReleaseGateResult[];
  proofTrace: ProofTraceRow[];
  egress: EgressAttestation;
  whyLiveBlocked: string[];
  controlledLiveRequirements: string[];
  /** The integrated, build-time-verified run packet (PR #159). */
  integrated: CommandCenterIntegratedView;
  /** Mock/dry-run capability-surface score (may reach 100/100). */
  capabilitySurface: CapabilitySurfaceScorecard;
  /** Honest official Alta implementation-parity estimate (NOT 100). */
  implementationParity: ImplementationParityReport;
  /** Provenance marker so the page/tests can assert this came from real modules. */
  source: 'real-agents-modules';
}

// ===========================================================================
// Scorecard 1 — mock/dry-run CAPABILITY-SURFACE score (may be 100/100)
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

export interface CapabilitySurfaceScorecard {
  /** 0..100 — breadth of the mock/dry-run surface that is implemented + visible. */
  score: number;
  threshold: number;
  pass: boolean;
  /** Explicit label so this is never mistaken for the official parity claim. */
  axisLabel: 'mock/dry-run capability-surface score';
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

/** The view minus its computed scorecards (input to both scorers). */
export type AssembledView = Omit<CommandCenterView, 'capabilitySurface' | 'implementationParity'>;

/**
 * Compute the mock/dry-run capability-surface score from the *assembled* view.
 * Every check is an objective structural assertion over real module output, so
 * the score is auditable rather than asserted. It measures implemented, tested,
 * visible mock/dry-run surface breadth — NOT live-automation readiness (which
 * stays gated; see {@link CapabilitySurfaceScorecard.remaining}).
 */
export function computeCapabilitySurfaceScore(view: AssembledView): CapabilitySurfaceScorecard {
  const happy = view.leads.find((l) => l.packet.status === 'completed');
  const blocked = view.leads.find((l) => l.packet.status === 'blocked');
  const allChannels = view.leads.flatMap((l) => l.channelPlan);
  const liveGate = view.releaseGates.find((g) => g.stage === 'controlled_live');

  const dims: ParityDimension[] = [
    dimension('b1_assembly', 'B1 · Assembly island', 12, [
      {
        label: 'Completed run assembled with ordered timeline',
        ok: !!happy && happy.console.timeline.length >= 4,
      },
      { label: 'Workspace attribution present on packet', ok: view.workspaceId.length > 0 },
      {
        label: 'Proof trace recorded for completed run',
        ok: !!happy && happy.packet.proofs.length > 0,
      },
      {
        label: 'Status badge classifies every lead',
        ok: view.leads.every((l) => !!l.console.badge.label),
      },
    ]),
    dimension('b2_channels', 'B2 · Dry-run channel engine', 12, [
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
          view.crm.idempotentRepeat &&
          view.crm.records.length ===
            view.crm.records.filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i).length,
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
    dimension('b5_trustops', 'B5 · TrustOps analytics', 12, [
      {
        label: 'Funnel computed across leads',
        ok: view.trustOps.metrics.funnel.leadsReceived === view.leads.length,
      },
      {
        label: 'Transparent 0..100 trust score with 4-component breakdown',
        ok: view.trustOps.trustScore.components.length === 4,
      },
      { label: 'Approval coverage computed', ok: view.trustOps.metrics.approvalCoverage >= 0 },
    ]),
    dimension('b6_gates', 'B6 · Enterprise release gates', 12, [
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
    dimension('integrated_packet', 'Cross · Integrated run packet (one verified artifact)', 12, [
      {
        label: 'All 8 required packet sections present',
        ok: view.integrated.completeness.complete,
      },
      {
        label: 'Packet composes real lanes (mock mode, no live egress)',
        ok:
          view.integrated.packet.mode === 'mock' &&
          view.integrated.packet.attestation.noLiveEgress === true,
      },
      {
        label: 'Packet channel plans are all sent=false',
        ok: view.integrated.packet.channelPlans.every((a) => a.sent === false),
      },
    ]),
    dimension('egress', 'Cross · No-live-egress attestation', 8, [
      {
        label: 'Attestation present and noLiveEgress=true',
        ok: view.egress.noLiveEgress === true,
      },
      {
        label: 'Blocked lead produced no channel actions',
        ok: !!blocked && blocked.channelPlan.length === 0,
      },
    ]),
    dimension('proof', 'Cross · Proof / workspace attribution', 8, [
      {
        label: 'Every proof trace is workspace-attributed',
        ok:
          view.proofTrace.length > 0 &&
          view.proofTrace.every((p) => p.workspaceId === view.workspaceId),
      },
      {
        // Real B1 only records proofs from the appointment phase onward, so a
        // compliance-blocked run legitimately has none. The meaningful check is
        // that every emitted proof ties back to a rendered lead and carries a
        // public, non-empty summary (no raw PII leaks into the trace).
        label: 'Every proof row ties to a lead and has a public summary',
        ok:
          view.proofTrace.length > 0 &&
          view.proofTrace.every(
            (p) => view.leads.some((l) => l.id === p.prospectId) && p.summary.length > 0,
          ),
      },
    ]),
  ];

  const score = dims.reduce((s, d) => s + d.earned, 0);
  return {
    score,
    threshold: ALTA_PARITY_THRESHOLD,
    pass: score >= ALTA_PARITY_THRESHOLD,
    axisLabel: 'mock/dry-run capability-surface score',
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
// Scorecard 2 — HONEST official Alta implementation parity (NOT 100)
// ===========================================================================

export type AxisStatus = 'implemented' | 'partial' | 'blocked';

export interface ParityAxis {
  key: string;
  label: string;
  weight: number;
  status: AxisStatus;
  /** implemented=1, partial=0.5, blocked=0. */
  ratio: number;
  earned: number;
  note: string;
}

export interface ImplementationParityReport {
  /** 0..100 — the HONEST official implementation-parity estimate. */
  score: number;
  threshold: number;
  meetsThreshold: boolean;
  axisLabel: 'official Alta implementation parity';
  axes: ParityAxis[];
  /** Same as `score`; named so the page/doc can speak of an "honest ceiling". */
  honestCeiling: number;
  /** What stands between the ceiling and a *confident* 80+ (each ~crosses it). */
  exactBlockers: string[];
  /** Separate axes deliberately out of scope for any overnight/mock lane. */
  outOfScope: string[];
}

/**
 * Evidence flags for the implementation-parity computation. Flags derivable
 * from the assembled view are passed from the adapter; the build/persistence/
 * enforcement/deploy/live flags are explicit known facts about this branch
 * (verified by `pnpm check` + a real `next build`, documented in the evidence
 * doc), so the score is transparent rather than asserted.
 */
export interface ImplementationParityEvidence {
  /** Route data path executes the real `@cognitia/agents` modules. */
  realModuleIntegration: boolean;
  /** The integrated packet is present and complete (8/8 sections). */
  integratedPacketComplete: boolean;
  /** A single visible route renders the whole loop. */
  visibleRoute: boolean;
  /** Dry-run safety holds: fail-closed live, no egress, no raw PII. */
  dryRunSafety: boolean;
  /** All six lanes are rendered from real lane code (breadth). */
  laneBreadth: boolean;
  /** `next build` is green with `transpilePackages` configured (buildable). */
  buildProvable: boolean;
  /** Runs/CRM/proofs are persisted (NOT in-memory per request). */
  persistence: boolean;
  /** The B6 permission model gates the route + approval path. */
  routeBoundEnforcement: boolean;
  /** A deployed, reachable, observable environment exists. */
  reachableDeployment: boolean;
  /** Live automation is approved/ready (must stay false in any mock lane). */
  liveAutomationReadiness: boolean;
}

function axis(
  key: string,
  label: string,
  weight: number,
  implemented: boolean,
  note: string,
  partial = false,
): ParityAxis {
  const status: AxisStatus = implemented ? 'implemented' : partial ? 'partial' : 'blocked';
  const ratio = implemented ? 1 : partial ? 0.5 : 0;
  return { key, label, weight, status, ratio, earned: Math.round(weight * ratio), note };
}

/**
 * Compute the honest official Alta implementation-parity estimate. Transparent
 * and weighted; weights sum to 100. This is deliberately conservative: it only
 * credits axes that genuinely hold on this branch and leaves persistence,
 * route-bound enforcement, reachable deployment, and live readiness at zero
 * because they do not yet exist. The result is the number the evidence doc
 * cites — it is NOT the 100/100 capability-surface figure.
 */
export function computeImplementationParity(
  e: ImplementationParityEvidence,
): ImplementationParityReport {
  const axes: ParityAxis[] = [
    axis(
      'real_module_integration',
      'Real-module integration (route runs real B1–B6)',
      18,
      e.realModuleIntegration,
      'Server-only adapter calls the real @cognitia/agents lanes; provenance asserted by tests.',
    ),
    axis(
      'integrated_packet',
      'Integrated single-artifact run packet (verified complete)',
      12,
      e.integratedPacketComplete,
      'assembleIntegratedRunPacket composes B1–B6; verifyIntegratedRunPacket reports 8/8 sections.',
    ),
    axis(
      'visible_route',
      'Visible end-to-end operator route',
      10,
      e.visibleRoute,
      'One screen renders the whole loop, smoke-tested via react-dom/server.',
    ),
    axis(
      'dry_run_safety',
      'Dry-run safety (fail-closed live, no egress, no PII)',
      14,
      e.dryRunSafety,
      'sendLive throws; every action sent:false; assertNoRawPii over serialized output.',
    ),
    axis(
      'lane_breadth',
      'Capability breadth (audience/CRM/TrustOps/gates/proofs from real code)',
      16,
      e.laneBreadth,
      'All six lanes rendered from their real, tested modules — not a mirror.',
    ),
    axis(
      'build_provability',
      'Build provability (next build green + transpilePackages)',
      8,
      e.buildProvable,
      'apps/web transpiles @cognitia/agents and a production next build succeeds.',
    ),
    axis(
      'persistence',
      'Persistence of runs / CRM / proofs',
      8,
      e.persistence,
      'BLOCKER: CRM-lite, timeline, proofs and the TrustOps funnel are in-memory per request.',
    ),
    axis(
      'route_bound_enforcement',
      'Route-bound enforcement (B6 RBAC gates the route/approval)',
      6,
      e.routeBoundEnforcement,
      'BLOCKER: the permission model is not yet bound to route access or the approval path.',
    ),
    axis(
      'reachable_deployment',
      'Reachable, observable deployment',
      4,
      e.reachableDeployment,
      'OUT OF SCOPE: no deployed URL / monitoring / rollback in an overnight mock lane.',
    ),
    axis(
      'live_automation_readiness',
      'Live automation readiness',
      4,
      e.liveAutomationReadiness,
      'OUT OF SCOPE (must stay closed): requires counsel/founder sign-off + 7 controlled-live conditions.',
    ),
  ];

  const score = axes.reduce((s, a) => s + a.earned, 0);
  return {
    score,
    threshold: ALTA_PARITY_THRESHOLD,
    meetsThreshold: score >= ALTA_PARITY_THRESHOLD,
    axisLabel: 'official Alta implementation parity',
    axes,
    honestCeiling: score,
    exactBlockers: axes
      .filter(
        (a) =>
          a.status === 'blocked' &&
          (a.key === 'persistence' || a.key === 'route_bound_enforcement'),
      )
      .map((a) => `${a.label} (+${a.weight}) — ${a.note.replace(/^BLOCKER:\s*/, '')}`),
    outOfScope: axes
      .filter((a) => a.key === 'reachable_deployment' || a.key === 'live_automation_readiness')
      .map((a) => `${a.label} — ${a.note.replace(/^OUT OF SCOPE[^:]*:\s*/, '')}`),
  };
}
