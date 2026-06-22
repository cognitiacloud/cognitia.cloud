import { describe, expect, it } from 'vitest';
import { buildTrustOpsReport, renderTrustOpsReport, MOCK_SANDBOX_BANNER } from './report.js';
import { computeTrustOpsMetrics, computeTrustScore, type WorkflowRunSummary } from './metrics.js';

const RUNS: WorkflowRunSummary[] = [
  {
    runId: 'r1',
    tenant: 'budget_wheels_demo',
    status: 'completed',
    compliance: 'pass',
    approval: 'approved',
    appointment: 'succeeded',
    crm: 'ok',
    proofEventsRecorded: 2,
  },
  {
    runId: 'r2',
    status: 'blocked',
    compliance: 'blocked',
    blockedReason: 'prospect is not contactable',
  },
  {
    runId: 'r3',
    status: 'awaiting_approval',
    compliance: 'pass',
    approval: 'pending',
  },
];

describe('renderTrustOpsReport', () => {
  it('is clearly labelled MOCK / SANDBOX', () => {
    const { markdown } = buildTrustOpsReport(RUNS);
    expect(markdown).toContain(MOCK_SANDBOX_BANNER);
    expect(markdown).toMatch(/MOCK \/ SANDBOX/);
  });

  it('renders the trust score and funnel counts', () => {
    const { markdown, score } = buildTrustOpsReport(RUNS);
    expect(markdown).toContain(`Trust / Safety Score: ${score.score} / 100`);
    expect(markdown).toContain('Leads received | 3');
    expect(markdown).toContain('Compliance block | 1');
    expect(markdown).toContain('Approval pending | 1');
  });

  it('renders blocked reasons table', () => {
    const { markdown } = buildTrustOpsReport(RUNS);
    expect(markdown).toContain('### Blocked reasons');
    expect(markdown).toContain('prospect is not contactable');
  });

  it('renders "no blocked runs" when none are blocked', () => {
    const md = renderTrustOpsReport(
      computeTrustOpsMetrics([RUNS[0]!]),
      computeTrustScore(computeTrustOpsMetrics([RUNS[0]!])),
    );
    expect(md).toContain('_No blocked runs._');
  });

  it('renders the egress attestation', () => {
    const { markdown } = buildTrustOpsReport(RUNS);
    expect(markdown).toContain('## Egress attestation');
    expect(markdown).toContain('MOCK_SANDBOX');
    expect(markdown).toMatch(/No live egress: yes/);
  });

  it('is deterministic', () => {
    expect(buildTrustOpsReport(RUNS).markdown).toBe(buildTrustOpsReport(RUNS).markdown);
  });
});

describe('PII safety', () => {
  it('report contains no raw PII (emails / phone numbers)', () => {
    const { markdown } = buildTrustOpsReport([
      ...RUNS,
      {
        runId: 'r4',
        status: 'blocked',
        compliance: 'pass',
        approval: 'rejected',
        blockedReason: 'rejected by reviewer',
      },
    ]);
    expect(markdown).not.toMatch(/@/);
    expect(markdown).not.toMatch(/\b\d{3}[-.]\d{3}[-.]\d{4}\b/);
  });
});
