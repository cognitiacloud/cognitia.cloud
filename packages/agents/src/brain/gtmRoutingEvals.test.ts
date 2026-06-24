import { describe, expect, it } from 'vitest';
import {
  GTM_ROUTING_SUITE,
  GTM_ROUTING_V1_CASES,
  assertNoRawPiiInEvalReport,
  runGtmRoutingV1Suite,
} from './gtmRoutingEvals.js';
import { evalModelRouterSuite, type EvalReport } from './brainApi.js';

describe('gtm-routing-v1 eval suite (over the #206 ModelRouter)', () => {
  it('every scenario meets its expected routing outcome', async () => {
    const report = await runGtmRoutingV1Suite();
    expect(report.suite).toBe(GTM_ROUTING_SUITE);
    expect(report.total).toBe(GTM_ROUTING_V1_CASES.length);
    const failures = report.cases.filter((c) => !c.passed);
    expect(failures, JSON.stringify(failures, null, 2)).toHaveLength(0);
    expect(report.passed).toBe(report.total);
    expect(report.score).toBe(100);
  });

  it('exercises each governed gate exactly once via the real router', async () => {
    const report = await runGtmRoutingV1Suite();
    const byName = new Map(report.cases.map((c) => [c.name, c]));

    expect(byName.get('routing-to-mock')?.actualOk).toBe(true);
    expect(byName.get('fallback-to-mock')?.actualOk).toBe(true);
    expect(byName.get('provider-not-allowed-block')?.blockedReason).toBe('provider_not_allowed');
    expect(byName.get('high-risk-approval-required')?.blockedReason).toBe(
      'high_risk_requires_approval',
    );
    expect(byName.get('local-only-block')?.blockedReason).toBe('local_only_policy');
    expect(byName.get('cost-ceiling-block')?.blockedReason).toBe('cost_ceiling_exceeded');
    expect(byName.get('disabled-provider-block')?.blockedReason).toBe('provider_disabled');
    expect(byName.get('unknown-task-fail-closed')?.blockedReason).toBe('unknown_task_type');
    expect(byName.get('v1-mock-only-invariant')?.blockedReason).toBe('v1_mock_only');
  });

  it('is deterministic: every case reports a stable re-run', async () => {
    const report = await runGtmRoutingV1Suite();
    for (const c of report.cases) {
      expect(c.deterministic, `case ${c.name} was non-deterministic`).toBe(true);
    }
  });

  it('an injected enabled non-mock provider can never execute (V1 invariant)', async () => {
    const report = await runGtmRoutingV1Suite();
    const rogue = report.cases.find((c) => c.name === 'v1-mock-only-invariant');
    expect(rogue?.actualOk).toBe(false);
    expect(rogue?.blockedReason).toBe('v1_mock_only');
  });

  it('the assembled report carries no raw PII', async () => {
    const report = await runGtmRoutingV1Suite();
    expect(() => assertNoRawPiiInEvalReport(report)).not.toThrow();
  });

  it('PII tripwire throws if a raw email/phone leaks into a report', () => {
    const dirty: EvalReport = {
      suite: GTM_ROUTING_SUITE,
      total: 1,
      passed: 1,
      score: 100,
      cases: [
        {
          name: 'buyer@example.com',
          passed: true,
          expectedOk: true,
          actualOk: true,
          deterministic: true,
        },
      ],
    };
    expect(() => assertNoRawPiiInEvalReport(dirty)).toThrow(/raw email PII/);
  });

  it('the default model-router suite still passes (no #206 regression)', async () => {
    const report = await evalModelRouterSuite();
    expect(report.passed).toBe(report.total);
    expect(report.score).toBe(100);
  });
});
