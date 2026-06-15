import { describe, it, expect } from 'vitest';
import { buildRegressionScenario, loadRegressionDataset } from './regression.js';
import { runGoldenScenario } from './harness.js';

/**
 * REGR-1 — rejection→regression flywheel. Proves: (1) anonymization is real,
 * (2) an unfixed rejection FAILS the harness (the candidate is a to-fix
 * artifact, not decoration), (3) a fixed behavior PASSES, and (4) the
 * adopted dataset exists and carries rejection provenance.
 */

const baseInputs = {
  action: {
    id: 'aaaaaaaa-1111-2222-3333-444444444444',
    action_type: 'crm.task.create',
    target_ref: 'account:real-tenant-account-id',
  },
  reasonCode: 'wrong_target',
  accounts: [
    {
      id: 'real-tenant-account-id',
      industry: 'Retail',
      employee_count: 8,
      region: 'EU',
      fit_score: 0.2,
      timing_score: 0.2,
    },
  ],
  contacts: [
    {
      id: 'real-contact-id',
      account_id: 'real-tenant-account-id',
      persona: 'champion',
      is_suppressed: false,
    },
  ],
};

describe('buildRegressionScenario', () => {
  it('anonymizes everything identifying: no tenant ids, names, or domains survive', () => {
    const s = buildRegressionScenario(baseInputs);
    const json = JSON.stringify(s);
    expect(json).not.toContain('real-tenant-account-id');
    expect(json).not.toContain('real-contact-id');
    expect(s.accounts[0]!.name).toBe('Regression Account 1');
    expect(s.contacts[0]!.fullName).toBe('Regression Contact 1');
    // The rejected target is remapped into the synthetic id space.
    expect(s.expect.mustNotTargetRefs).toEqual([`account:${s.accounts[0]!.id}`]);
    expect(s.source).toEqual({
      kind: 'operator_rejection',
      reason_code: 'wrong_target',
      rejected_target_ref: `account:${s.accounts[0]!.id}`,
    });
  });

  it('an UNFIXED rejection fails the harness — the candidate demands a behavior change', async () => {
    // Only one account exists, so the runtime will still propose it: the
    // must-not-target pin fails. This is the honest semantics of a candidate.
    const s = buildRegressionScenario(baseInputs);
    const result = await runGoldenScenario(s);
    expect(result.passed).toBe(false);
    expect(result.results.find((r) => r.rubric === 'icp_targeting')?.score).toBe(0);
  });

  it('once the behavior is fixed, the same pin passes and locks the fix', async () => {
    // The "fix": a fit account now exists and ranking excludes the rejected
    // one (maxAccounts=1) — the exact shape an adopted regression takes.
    const s = buildRegressionScenario({
      ...baseInputs,
      icp: { industries: ['SaaS'], minEmployees: 50 },
      maxAccounts: 1,
      accounts: [
        ...baseInputs.accounts,
        {
          id: 'fit-account-id',
          industry: 'SaaS',
          employee_count: 200,
          region: 'NA',
          fit_score: 0.9,
          timing_score: 0.9,
        },
      ],
    });
    const result = await runGoldenScenario(s);
    expect(result.passed).toBe(true);
  });
});

describe('loadRegressionDataset', () => {
  it('loads the adopted dataset with provenance on every scenario', () => {
    const ds = loadRegressionDataset();
    expect(ds).not.toBeNull();
    for (const s of ds!.scenarios) {
      expect(s.source?.kind).toBe('operator_rejection');
    }
  });
});
