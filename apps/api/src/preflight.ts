import { InMemoryRepository, type Repository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { buildHubspotWritePlan, type CrmWritePlan } from '@cognitia/integrations';

/**
 * SIM-1 — preflight simulation. Runs the REAL Mira runtime (v1Mode) against an
 * ephemeral in-memory copy of the tenant's synced accounts/contacts and reports
 * exactly what it WOULD propose — including the full typed write plan for each
 * would-be CRM write (GOV-1) — while guaranteeing zero writes to the live
 * ledger and zero CRM side effects. Same pattern as the EVAL-1 golden harness,
 * pointed at the tenant's own data: "we ran our CI harness on your CRM."
 *
 * Nothing is persisted: the simulation's runs/actions/events live and die in
 * the ephemeral repository. Note the lineage ids in the report are simulated —
 * a later live run mints its own.
 */

export interface PreflightInput {
  objective?: string;
  icp?: {
    industries?: string[];
    minEmployees?: number;
    maxEmployees?: number;
    regions?: string[];
  };
  maxAccounts?: number;
}

export interface PreflightProposal {
  action_type: string;
  target_ref: string;
  risk_level: string;
  evidence_refs: string[];
  /** The exact typed CRM write this proposal would perform (GOV-1 plan). */
  plan: CrmWritePlan;
}

export interface PreflightReport {
  simulated: true;
  writes_performed: 0;
  objective: string;
  accounts_considered: number;
  ranked_accounts: Array<{ accountId: string; combined: number }>;
  proposals: PreflightProposal[];
  excluded_suppressed: string[];
}

export async function runPreflight(
  liveRepo: Repository,
  tenantId: string,
  input: PreflightInput,
): Promise<PreflightReport> {
  // 1. Read-only snapshot of the tenant's CRM-synced rows into an ephemeral repo.
  const ephemeral = new InMemoryRepository();
  const accounts = await liveRepo.listAccounts(tenantId);
  for (const account of accounts) {
    ephemeral.seedAccount(account);
    for (const contact of await liveRepo.listContactsByAccount(tenantId, account.id)) {
      ephemeral.seedContact(contact);
    }
  }

  // 2. The REAL runtime, fenced exactly like production, over the copy.
  const services = createGtmServices({ repo: ephemeral, v1Mode: true });
  const objective = input.objective ?? 'preflight simulation';
  const run = await services.mira.run({
    tenantId,
    objective,
    traceId: `preflight:${tenantId}`,
    icp: input.icp,
    maxAccounts: input.maxAccounts,
  });

  // 3. Report what would happen — with the exact write plan per proposal.
  const actions = await ephemeral.listAgentActions(tenantId);
  const proposals: PreflightProposal[] = actions.map((a) => ({
    action_type: a.action_type,
    target_ref: a.target_ref,
    risk_level: a.risk_level,
    evidence_refs: a.evidence_refs,
    plan: buildHubspotWritePlan(a, {
      agent: 'mira',
      agent_run_id: a.agent_run_id,
      agent_action_id: a.id,
      evidence_count: a.evidence_refs.length,
      risk_level: a.risk_level as 'low' | 'medium' | 'high',
    }),
  }));

  return {
    simulated: true,
    writes_performed: 0,
    objective,
    accounts_considered: accounts.length,
    ranked_accounts: run.ranked,
    proposals,
    excluded_suppressed: run.excludedSuppressed,
  };
}
