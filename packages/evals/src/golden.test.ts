import { describe, it, expect } from 'vitest';
import { loadGoldenDataset, runGoldenEval } from './harness.js';
import { loadRegressionDataset } from './regression.js';

/**
 * EVAL-1 — the CI eval gate. Runs the golden dataset through the real Mira
 * runtime and requires EVERY rubric to score 1.0. These are deterministic
 * safety invariants (fence, suppression, targeting, idempotency, evidence) —
 * a regression in any of them fails `pnpm test` and therefore the
 * `build-test` CI job. Do not lower the bar; fix the regression.
 */
describe('EVAL-1 — golden dataset gate', () => {
  it('loads a versioned dataset with scenarios', () => {
    const ds = loadGoldenDataset();
    expect(ds.version).toBe('golden-v1');
    expect(ds.scenarios.length).toBeGreaterThanOrEqual(4);
  });

  it('every golden scenario passes every rubric (gate)', async () => {
    const summary = await runGoldenEval();
    const failures = summary.results
      .filter((r) => !r.passed)
      .map((r) => ({
        scenario: r.scenarioId,
        failed: r.results.filter((x) => x.score !== 1),
      }));
    // Surface the precise failing rubric + detail in the assertion message.
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(summary.scenarios);
  });

  it('every adopted regression scenario passes (REGR-1 gate)', async () => {
    const ds = loadRegressionDataset();
    expect(ds, 'regressions-v1.json should exist (seeded in REGR-1)').not.toBeNull();
    expect(ds!.version).toBe('regressions-v1');
    expect(ds!.scenarios.length).toBeGreaterThanOrEqual(1);
    // Promoted scenarios carry rejection provenance.
    for (const s of ds!.scenarios) {
      expect(s.source?.kind).toBe('operator_rejection');
      expect(s.source?.reason_code).toBeTruthy();
    }
    const summary = await runGoldenEval(ds!);
    const failures = summary.results
      .filter((r) => !r.passed)
      .map((r) => ({ scenario: r.scenarioId, failed: r.results.filter((x) => x.score !== 1) }));
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
  });
});
