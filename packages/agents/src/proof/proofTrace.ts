/**
 * Proof / action trace — the correlated, end-to-end evidence spine.
 *
 * This module strengthens the proof + TrustOps evidence story. It does NOT add
 * any new capability, network, vendor SDK, or DB; it READS an already-built,
 * mock-safe {@link IntegratedRunPacket} (the PR #159 integration island) and
 * folds it into a single, ordered, **correlated** proof/action trace mapped
 * across the canonical loop:
 *
 *     lead → compliance → approval → dry-run plan → CRM-lite → TrustOps
 *
 * Every step is tied to the same `correlationId` (the run's opaque prospect id)
 * and `workspaceId`, carries non-PII references to the real underlying evidence
 * (proof-event ids, channel plan refs, CRM timeline event ids, trust score), and
 * is classified by outcome. The trace is the artifact a Command Center renders to
 * prove "this exact lead walked these exact stages, and here is the evidence for
 * each".
 *
 * SAFETY (asserted before any trace is returned):
 *   - NO RAW PII — the whole serialized trace is scanned for raw emails (only
 *     reserved-TLD `.example`/`.test`/`.invalid` addresses are allowed) and every
 *     human-readable `summary` is additionally scanned for raw phone numbers
 *     (only the reserved `555-01xx` range is allowed). Opaque ids / uuids / plan
 *     refs are intentionally exempt from the phone scan (they are not PII), the
 *     same accepted boundary the integration packet already draws.
 *   - NO LIVE EGRESS — the trace is derived purely from a mock packet whose
 *     channel plans are all `sent:false`; the trace records that attestation.
 *
 * Pure and deterministic given a deterministic packet. Imports only sibling lane
 * modules + `@cognitia/core` types — never a network / vendor / DB primitive.
 */

import type { IsoTimestamp } from '@cognitia/core';
import type { IntegratedRunPacket } from '../gtm-os/integration/runPacket.js';
import { toWorkflowRunSummary } from '../gtm-os/integration/adapters.js';
import { buildTrustOpsReport, type TrustOpsReport } from '../trustops/report.js';

/** Schema tag stamped on every proof/action trace (versioned for consumers). */
export const PROOF_ACTION_TRACE_SCHEMA = 'cognitia.gtm.proof_action_trace.v1' as const;

/**
 * The canonical loop the trace maps across, in order. Used both to drive the
 * coverage checklist and to assert the trace's logical ordering.
 */
export const PROOF_TRACE_STAGES = [
  'lead',
  'compliance',
  'approval',
  'dry_run_plan',
  'crm_lite',
  'trustops',
] as const;

export type ProofTraceStage = (typeof PROOF_TRACE_STAGES)[number];

/** How a single trace step resolved. */
export type ProofTraceOutcome =
  | 'advanced' // moved forward to the next phase
  | 'halted' // paused awaiting a human (not a failure)
  | 'blocked' // stopped by a gate (compliance/approval)
  | 'planned' // a dry-run plan was produced (never sent)
  | 'recorded' // written to the mock CRM-lite read model
  | 'computed'; // an aggregate (TrustOps) was computed

/** A single non-PII reference from a step to its underlying evidence. */
export interface ProofTraceRef {
  /** What this reference is (e.g. `proof_event`, `plan_ref`, `crm_event`). */
  label: string;
  /** The opaque, non-PII reference value. */
  ref: string;
}

/** One ordered, correlated step in the proof/action trace. */
export interface ProofTraceStep {
  /** 1-based ordinal of the step within the trace. */
  seq: number;
  /** Which canonical loop stage this step belongs to. */
  stage: ProofTraceStage;
  /** Originating lane (B1 assembly, B2 channels, B3 CRM-lite, B5 TrustOps). */
  lane: string;
  /** Short operator-facing phase label. */
  phase: string;
  /** Correlation id shared by every step in this trace (opaque prospect id). */
  correlationId: string;
  /** Workspace/tenant this step is attributed to. */
  workspaceId: string;
  /** Evidence timestamp for the step (ISO-8601). */
  at: IsoTimestamp;
  /** Outcome classification. */
  outcome: ProofTraceOutcome;
  /** PII-safe human-readable one-liner. */
  summary: string;
  /** Non-PII references to the real underlying evidence. */
  refs: ProofTraceRef[];
}

/** Per-stage coverage: was each canonical stage reached for this run? */
export interface ProofTraceCoverage {
  stage: ProofTraceStage;
  present: boolean;
}

/** Combined no-egress / no-PII attestation carried on the trace. */
export interface ProofTraceAttestation {
  mode: 'mock';
  noLiveEgress: true;
  noRawPii: true;
  statement: string;
}

/** The correlated proof/action trace for a single integrated run packet. */
export interface ProofActionTrace {
  schema: typeof PROOF_ACTION_TRACE_SCHEMA;
  mode: 'mock';
  /** Opaque prospect/run id every step correlates on. */
  correlationId: string;
  workspaceId: string;
  generatedAt: IsoTimestamp;
  /** Ordered steps across lead → compliance → approval → plan → CRM-lite → TrustOps. */
  steps: ProofTraceStep[];
  /** Which canonical stages were reached (honest for halted/blocked runs). */
  coverage: ProofTraceCoverage[];
  /** True only when every canonical stage was reached (happy path). */
  complete: boolean;
  attestation: ProofTraceAttestation;
}

/* --------------------------------------------------------------- PII scanning */

const EMAIL_TOKEN_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const RESERVED_EMAIL_TLDS = ['.example', '.test', '.invalid'];

/** Throw if `text` contains a raw (non reserved-TLD, non-masked) email address. */
function scanForRawEmail(text: string, context: string): void {
  for (const match of text.match(EMAIL_TOKEN_RE) ?? []) {
    if (match.includes('*')) continue; // already masked/redacted
    const lower = match.toLowerCase();
    if (RESERVED_EMAIL_TLDS.some((tld) => lower.endsWith(tld))) continue;
    throw new Error(`proof trace: raw email PII detected in ${context}: "${match}"`);
  }
}

/**
 * Throw if `text` contains a raw phone number. ISO timestamps are stripped first
 * (their digit runs are not phones) and only the reserved fictional `555-01xx`
 * range is permitted. Intended for human-authored summary strings, which never
 * contain opaque uuids — a blanket scan over the whole packet would false-
 * positive on hyphenated uuids, so callers scan summaries, not refs/ids.
 */
function scanForRawPhone(text: string, context: string): void {
  if (text.includes('*')) return; // masked/redacted form is fine
  const withoutIso = text.replace(
    /\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?/g,
    ' ',
  );
  const phoneRe = /(?:\+\d[\d\s().-]{5,}\d|\d{2,}[\s().-]+[\d\s().-]*\d)/g;
  for (const rawMatch of withoutIso.match(phoneRe) ?? []) {
    const digits = rawMatch.replace(/\D/g, '');
    if (digits.length < 7) continue;
    if (/55501\d{2}$/.test(digits)) continue; // reserved 555-01xx
    throw new Error(`proof trace: raw phone PII detected in ${context}: "${rawMatch.trim()}"`);
  }
}

/**
 * Assert the proof/action trace carries no raw PII. Scans the whole serialized
 * trace for raw emails, and every human-readable summary for raw phones. Throws
 * on the first violation. Pure.
 */
export function assertProofTraceNoRawPii(trace: ProofActionTrace): void {
  const serialized = JSON.stringify(trace);
  scanForRawEmail(serialized, 'serialized trace');
  for (const step of trace.steps) {
    scanForRawPhone(step.summary, `step ${step.seq} (${step.stage}) summary`);
    for (const ref of step.refs) {
      // Reference *values* may be opaque uuids; scan only for emails there.
      scanForRawEmail(ref.ref, `step ${step.seq} ref "${ref.label}"`);
    }
  }
}

/* ----------------------------------------------------------------- the builder */

/** Find the operator-timeline row produced by a given workflow boundary. */
function timelineRowVia(packet: IntegratedRunPacket, via: string) {
  return packet.run.timeline.find((row) => row.via === via);
}

function pct(ratio: number): string {
  const clamped = Number.isNaN(ratio) ? 0 : ratio < 0 ? 0 : ratio > 1 ? 1 : ratio;
  return `${Math.round(clamped * 100)}%`;
}

/**
 * Build the correlated proof/action trace from a real integrated run packet.
 *
 * Honest by construction: a stage step is emitted only when that stage actually
 * occurred for the run, so a compliance-blocked lead yields a short trace (lead
 * → compliance) with later stages absent in `coverage` — there is no fabricated
 * downstream evidence. Asserts no-raw-PII before returning.
 */
export function buildProofActionTrace(packet: IntegratedRunPacket): ProofActionTrace {
  const correlationId = packet.run.prospect.id;
  const workspaceId = packet.workspaceId;
  const steps: ProofTraceStep[] = [];

  const initRow = timelineRowVia(packet, 'init');
  const complianceRow = timelineRowVia(packet, 'compliance');
  const approvalRow = timelineRowVia(packet, 'approval');
  const generatedAt = packet.generatedAt;

  let seq = 0;
  const push = (step: Omit<ProofTraceStep, 'seq'>) => {
    steps.push({ seq: ++seq, ...step });
  };

  // 1 — LEAD (B1 assembly + B4 audience). Always present: a run started.
  push({
    stage: 'lead',
    lane: 'B1+B4',
    phase: 'Lead received',
    correlationId,
    workspaceId,
    at: initRow?.at ?? generatedAt,
    outcome: 'advanced',
    summary:
      `Lead received for ${packet.run.prospect.companyName} ` +
      `(source: ${packet.run.prospect.source}; audience signal score ` +
      `${packet.audience.score.score.toFixed(2)}).`,
    refs: [
      { label: 'prospect', ref: correlationId },
      { label: 'audience_score', ref: packet.audience.score.score.toFixed(2) },
      { label: 'source_risk', ref: packet.run.prospect.sourceRisk },
    ],
  });

  // 2 — COMPLIANCE (B1). Always reached (every run hits the compliance gate).
  const complianceBlocked = packet.run.compliance.blocked;
  push({
    stage: 'compliance',
    lane: 'B1',
    phase: 'Compliance check',
    correlationId,
    workspaceId,
    at: complianceRow?.at ?? generatedAt,
    outcome: complianceBlocked ? 'blocked' : 'advanced',
    summary: complianceBlocked
      ? `Compliance gate BLOCKED the run${packet.run.compliance.reason ? `: ${packet.run.compliance.reason}` : '.'}`
      : 'Compliance gate passed.',
    refs: [
      { label: 'compliance', ref: complianceBlocked ? 'blocked' : 'pass' },
      ...packet.crm.timeline
        .filter((e) => e.kind === 'compliance')
        .map((e) => ({ label: 'crm_event', ref: e.id })),
    ],
  });

  // 3 — APPROVAL (B1). Only meaningful once compliance passed.
  if (!complianceBlocked) {
    const status = packet.run.approval.status;
    const outcome: ProofTraceOutcome =
      status === 'approved' ? 'advanced' : status === 'pending' ? 'halted' : 'blocked';
    push({
      stage: 'approval',
      lane: 'B1',
      phase: 'Human approval gate',
      correlationId,
      workspaceId,
      at: approvalRow?.at ?? generatedAt,
      outcome,
      summary: `Human approval gate: ${status}${packet.run.approval.reason ? ` — ${packet.run.approval.reason}` : '.'}`,
      refs: [
        { label: 'approval', ref: status },
        ...packet.crm.timeline
          .filter((e) => e.kind === 'approval')
          .map((e) => ({ label: 'crm_event', ref: e.id })),
      ],
    });
  }

  // 4 — DRY-RUN PLAN (B2). The integrated packet plans channels unconditionally
  // (a capability demo), but the *trace* is honest: a dry-run outreach plan is
  // only recorded once the lead actually cleared the human-approval gate.
  const approved = !complianceBlocked && packet.run.approval.status === 'approved';
  if (approved && packet.channelPlans.length > 0) {
    const channels = packet.channelPlans.map((p) => p.channel).join(', ');
    push({
      stage: 'dry_run_plan',
      lane: 'B2',
      phase: 'Dry-run channel plan',
      correlationId,
      workspaceId,
      at: generatedAt,
      outcome: 'planned',
      summary:
        `${packet.channelPlans.length} dry-run channel plan(s) produced ` +
        `(sent=false, live=BLOCKED): ${channels}.`,
      refs: packet.channelPlans.map((p) => ({ label: `plan_ref:${p.channel}`, ref: p.planRef })),
    });
  }

  // 5 — CRM-LITE (B3). The CRM-lite projection logs an event for every gate
  // (including a compliance block), so gate the trace step on the run actually
  // reaching CRM writeback / appointment — not merely on the timeline being
  // non-empty — so a blocked lead shows no fabricated opportunity record.
  const reachedCrm = packet.run.crm.written || packet.run.appointment.requested;
  if (reachedCrm && packet.crm.timeline.length > 0) {
    const stage = packet.crm.opportunities[0]?.stage ?? 'lead';
    push({
      stage: 'crm_lite',
      lane: 'B3',
      phase: 'CRM-lite (mock) record',
      correlationId,
      workspaceId,
      at: packet.crm.timeline[packet.crm.timeline.length - 1]?.at ?? generatedAt,
      outcome: 'recorded',
      summary:
        `CRM-lite recorded ${packet.crm.timeline.length} timeline event(s); ` +
        `opportunity stage = ${stage} (in-memory mock, idempotent).`,
      refs: [
        ...packet.crm.opportunities.map((o) => ({ label: 'opportunity', ref: o.id })),
        ...packet.crm.timeline.map((e) => ({ label: 'crm_event', ref: e.id })),
      ],
    });
  }

  // 6 — TRUSTOPS (B5). Always computed — the terminal evidence aggregation.
  push({
    stage: 'trustops',
    lane: 'B5',
    phase: 'TrustOps analytics',
    correlationId,
    workspaceId,
    at: generatedAt,
    outcome: 'computed',
    summary:
      `TrustOps computed: trust/safety score ${packet.trustOps.score.score}/100; ` +
      `approval coverage ${pct(packet.trustOps.metrics.approvalCoverage)}; ` +
      `proof events recorded ${packet.trustOps.metrics.funnel.proofEventsRecorded}; ` +
      `no live egress = ${packet.trustOps.metrics.egress.noLiveEgress}.`,
    refs: [
      { label: 'trust_score', ref: String(packet.trustOps.score.score) },
      { label: 'leads_received', ref: String(packet.trustOps.metrics.funnel.leadsReceived) },
      { label: 'egress_mode', ref: packet.trustOps.metrics.egress.mode },
    ],
  });

  // Coverage checklist over the canonical stages, honest for short runs.
  const reached = new Set(steps.map((s) => s.stage));
  const coverage: ProofTraceCoverage[] = PROOF_TRACE_STAGES.map((stage) => ({
    stage,
    present: reached.has(stage),
  }));

  const trace: ProofActionTrace = {
    schema: PROOF_ACTION_TRACE_SCHEMA,
    mode: 'mock',
    correlationId,
    workspaceId,
    generatedAt,
    steps,
    coverage,
    complete: coverage.every((c) => c.present),
    attestation: {
      mode: 'mock',
      noLiveEgress: true,
      noRawPii: true,
      statement:
        'MOCK/SANDBOX correlated proof/action trace. Every step is derived from a ' +
        'mock integrated run packet; channel plans are dry-run only (sent:false) and ' +
        'no live egress occurred. No raw PII: only reserved-TLD emails / 555-01xx phones may appear.',
    },
  };

  // Belt-and-braces: refuse to emit a trace carrying raw PII.
  assertProofTraceNoRawPii(trace);
  return trace;
}

/* ------------------------------------------------ TrustOps over integrated packets */

/**
 * Build a TrustOps report directly from one or more REAL integrated run packets.
 *
 * This is the "TrustOps over integrated packet outputs" entrypoint: rather than
 * hand-feeding {@link buildTrustOpsReport} synthetic summaries, it adapts each
 * packet's own workflow run (via the tested {@link toWorkflowRunSummary}) into
 * the analytics input unit, so the funnel + trust score are computed from the
 * exact runs the Command Center proved end-to-end. Pure and deterministic.
 */
export function buildTrustOpsReportFromPackets(
  packets: readonly IntegratedRunPacket[],
): TrustOpsReport {
  return buildTrustOpsReport(packets.map((p) => toWorkflowRunSummary(p.run)));
}
