/**
 * Human-readable MOCK/SANDBOX TrustOps report.
 *
 * Renders a deterministic markdown string from {@link TrustOpsMetrics} +
 * {@link TrustScore}. The report is clearly labelled as mock/sandbox and
 * carries no raw PII — only aggregate counts, reason strings, and references.
 */

import {
  computeTrustOpsMetrics,
  computeTrustScore,
  type TrustOpsMetrics,
  type TrustScore,
  type WorkflowRunSummary,
} from './metrics.js';

export interface TrustOpsReport {
  metrics: TrustOpsMetrics;
  score: TrustScore;
  /** Rendered markdown. */
  markdown: string;
}

/** Banner stamped at the top of every report. */
export const MOCK_SANDBOX_BANNER =
  '> **MOCK / SANDBOX** — all figures below are derived from mock workflow events. ' +
  'No live data, no production claims, no live network egress.';

function pct(ratio: number): string {
  return `${Math.round(clamp01(ratio) * 100)}%`;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Render a markdown report from already-computed metrics + score. */
export function renderTrustOpsReport(metrics: TrustOpsMetrics, score: TrustScore): string {
  const f = metrics.funnel;
  const lines: string[] = [];

  lines.push('# TrustOps Analytics Report');
  lines.push('');
  lines.push(MOCK_SANDBOX_BANNER);
  lines.push('');

  lines.push(`## Trust / Safety Score: ${score.score} / 100`);
  lines.push('');
  lines.push('| Component | Weight | Achieved | Points |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const c of score.components) {
    lines.push(`| ${c.label} | ${c.weight} | ${pct(c.ratio)} | ${c.earned} |`);
  }
  lines.push('');

  lines.push('## Funnel');
  lines.push('');
  lines.push('| Stage | Count |');
  lines.push('| --- | ---: |');
  lines.push(`| Leads received | ${f.leadsReceived} |`);
  lines.push(`| Compliance pass | ${f.compliancePass} |`);
  lines.push(`| Compliance block | ${f.complianceBlock} |`);
  lines.push(`| Approval approved | ${f.approvalApproved} |`);
  lines.push(`| Approval rejected | ${f.approvalRejected} |`);
  lines.push(`| Approval pending | ${f.approvalPending} |`);
  lines.push(`| Appointment requested | ${f.appointmentRequested} |`);
  lines.push(`| Appointment succeeded | ${f.appointmentSucceeded} |`);
  lines.push(`| CRM mock writes | ${f.crmWritten} |`);
  lines.push(`| Proof events recorded | ${f.proofEventsRecorded} |`);
  lines.push('');
  lines.push('### Run dispositions');
  lines.push('');
  lines.push(`- Completed: ${f.completed}`);
  lines.push(`- Blocked: ${f.blocked}`);
  lines.push(`- Awaiting approval: ${f.awaitingApproval}`);
  lines.push('');

  lines.push('## Safety');
  lines.push('');
  lines.push(`- Approval coverage: ${pct(metrics.approvalCoverage)}`);
  lines.push('');
  lines.push('### Blocked reasons');
  lines.push('');
  if (metrics.blockedReasons.length === 0) {
    lines.push('_No blocked runs._');
  } else {
    lines.push('| Stage | Reason | Count |');
    lines.push('| --- | --- | ---: |');
    for (const g of metrics.blockedReasons) {
      lines.push(`| ${g.stage} | ${g.reason} | ${g.count} |`);
    }
  }
  lines.push('');

  lines.push('## Egress attestation');
  lines.push('');
  lines.push(`- Mode: ${metrics.egress.mode}`);
  lines.push(`- No live egress: ${metrics.egress.noLiveEgress ? 'yes' : 'no'}`);
  lines.push(`- ${metrics.egress.statement}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * One-shot: compute metrics + score from runs and render the report. Pure and
 * deterministic.
 */
export function buildTrustOpsReport(runs: readonly WorkflowRunSummary[]): TrustOpsReport {
  const metrics = computeTrustOpsMetrics(runs);
  const score = computeTrustScore(metrics);
  return { metrics, score, markdown: renderTrustOpsReport(metrics, score) };
}
