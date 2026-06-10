import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { GoldenDataset, GoldenScenario } from './harness.js';

/**
 * REGR-1 — the rejection→regression flywheel. An operator rejection is a
 * labeled statement: "under these inputs, this proposal was wrong." This
 * module turns that statement into a golden-scenario candidate that pins the
 * corrected behavior: the rejected target must not be proposed again under
 * the same inputs.
 *
 * Honest semantics, by design:
 *  - The export is a CANDIDATE. If the runtime still proposes the target,
 *    the scenario fails — that is the point: it can only be adopted into
 *    `datasets/regressions-v1.json` alongside the behavior fix (ICP
 *    refinement, suppression, scoring change) that makes it pass, and from
 *    then on CI locks the fix forever.
 *  - Candidates are ANONYMIZED: tenant account/contact names, domains, and
 *    ids never leave the tenant — only the behavioral inputs (industry,
 *    employee count, region, scores, suppression flags) survive, which are
 *    exactly what the deterministic runtime ranks on.
 */

export interface RegressionInputs {
  /** The rejected action (target + run linkage). */
  action: { id: string; action_type: string; target_ref: string };
  /** The structured rejection. */
  reasonCode: string;
  note?: string;
  /** The tenant rows that were in play (will be anonymized). */
  accounts: Array<{
    id: string;
    industry: string | null;
    employee_count: number | null;
    region: string | null;
    fit_score: number | null;
    timing_score: number | null;
  }>;
  contacts: Array<{
    id: string;
    account_id: string | null;
    persona: string | null;
    is_suppressed: boolean;
  }>;
  /** Run inputs that shaped the proposal. */
  objective?: string;
  icp?: GoldenScenario['icp'];
  maxAccounts?: number;
}

/** Deterministic synthetic ids: stable within one candidate, meaningless outside it. */
function syntheticAccountId(n: number): string {
  return `a1000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`;
}
function syntheticContactId(n: number): string {
  return `c1000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`;
}

export function buildRegressionScenario(input: RegressionInputs): GoldenScenario {
  const accountIdMap = new Map<string, string>();
  const accounts = input.accounts.map((a, i) => {
    const id = syntheticAccountId(i);
    accountIdMap.set(a.id, id);
    return {
      id,
      name: `Regression Account ${i + 1}`,
      industry: a.industry ?? 'Unknown',
      employeeCount: a.employee_count ?? 0,
      region: a.region ?? 'NA',
      fitScore: a.fit_score ?? 0.5,
      timingScore: a.timing_score ?? 0.5,
    };
  });
  const contacts = input.contacts.map((c, i) => ({
    id: syntheticContactId(i),
    accountId: (c.account_id && accountIdMap.get(c.account_id)) || syntheticAccountId(0),
    fullName: `Regression Contact ${i + 1}`,
    title: 'Unknown',
    persona: c.persona ?? 'unknown',
    suppressed: c.is_suppressed,
  }));

  // Map the rejected target into the anonymized id space.
  const [kind, rawId] = input.action.target_ref.split(':') as [string, string];
  const mappedId = kind === 'account' ? (accountIdMap.get(rawId) ?? rawId) : rawId;
  const rejectedRef = `${kind}:${mappedId}`;

  return {
    id: `regression-${input.reasonCode}-${input.action.id.slice(0, 8)}`,
    description:
      `Operator rejected ${input.action.action_type} on ${kind} (reason: ${input.reasonCode}` +
      `${input.note ? `; note: ${input.note}` : ''}). ` +
      'Pin: this target must not be proposed again under these inputs. ' +
      'Adopt into regressions-v1.json together with the behavior fix that makes it pass.',
    objective: input.objective ?? 'build outbound pipeline',
    ...(input.icp ? { icp: input.icp } : {}),
    ...(input.maxAccounts !== undefined ? { maxAccounts: input.maxAccounts } : {}),
    accounts,
    contacts,
    expect: {
      minProposals: 0,
      allowedActionTypes: ['crm.task.create', 'crm.note.create'],
      mustNotTargetRefs: [rejectedRef],
      idempotentRerun: true,
      allEvidenceBacked: true,
    },
    source: {
      kind: 'operator_rejection',
      reason_code: input.reasonCode,
      rejected_target_ref: rejectedRef,
    },
  };
}

/** Load the adopted regression dataset; null when none has been adopted yet. */
export function loadRegressionDataset(): GoldenDataset | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, '..', 'datasets', 'regressions-v1.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as GoldenDataset;
}
