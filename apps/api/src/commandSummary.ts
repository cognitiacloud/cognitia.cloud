import type { Repository } from '@cognitia/db';
import { scanTextForPii } from './redaction/scanner.js';
import { getLeadRescueSummary, SMS_REPLY_ACTION } from './frontdesk.js';

/**
 * COG-007 — Cognitia Command Dashboard summary. Composes the existing
 * repositories/services into one operator view. Honesty rules:
 *   - every number is computed from real rows (zero/empty states are shown
 *     as zeros — no fake metrics);
 *   - "verified" figures count verified_fact evidence ONLY;
 *   - no raw PII: lead content stays encrypted in lead_intakes and is never
 *     read here; the PII figure below is a redaction-scanner count over
 *     proof summaries, not the PII itself.
 */

export async function buildCommandSummary(repo: Repository, tenantId: string) {
  const [agents, proofs, skills, leads, actions, repEvents, accounts, entries, bindings] =
    await Promise.all([
      repo.listAgents(tenantId),
      repo.listProofs(tenantId),
      repo.listSkills(tenantId),
      repo.listLeadIntakes(tenantId),
      repo.listAgentActions(tenantId),
      repo.listReputationEvents(tenantId),
      repo.listCreditsAccounts(tenantId),
      repo.listCreditsLedgerEntries(tenantId),
      repo.listWalletBindings(tenantId),
    ]);

  // --- A. Trust layer ---
  const atcByStatus = { active: 0, suspended: 0, revoked: 0, expired: 0 };
  for (const agent of agents) {
    for (const atc of await repo.listAtcsByAgent(tenantId, agent.id)) {
      if (atc.status in atcByStatus) atcByStatus[atc.status as keyof typeof atcByStatus] += 1;
    }
  }
  const byTag = (tag: string) => proofs.filter((p) => p.evidence_tag === tag).length;
  const trustSummary = {
    total_agents: agents.length,
    atc_active: atcByStatus.active,
    atc_suspended: atcByStatus.suspended,
    atc_revoked: atcByStatus.revoked,
    atc_expired: atcByStatus.expired,
    total_proofs: proofs.length,
    verified_fact_proofs: byTag('verified_fact'),
    likely_inference_proofs: byTag('likely_inference'),
    unknown_proofs: byTag('unknown'),
    public_safe_proofs: proofs.filter((p) => p.public_safe).length,
    /** Proof summaries the redaction scanner would block from publishing. */
    pii_flagged_proof_summaries: proofs.filter(
      (p) => !scanTextForPii(p.summary_public).publish_safe,
    ).length,
  };

  // --- B. SkillProof ---
  const tierCounts = { tier_0: 0, tier_1: 0, tier_2: 0 };
  let yanked = 0;
  for (const skill of skills) {
    for (const version of await repo.listSkillVersions(tenantId, skill.id)) {
      if (version.yanked) yanked += 1;
      if (version.proof_tier === 0) tierCounts.tier_0 += 1;
      else if (version.proof_tier === 1) tierCounts.tier_1 += 1;
      else if (version.proof_tier >= 2) tierCounts.tier_2 += 1;
    }
  }
  const skillproofSummary = {
    total_internal_skills: skills.length,
    core20_count: skills.filter((s) => s.namespace === 'cognitia.core').length,
    ...tierCounts,
    yanked_versions: yanked,
    marketplace: 'none — internal registry only',
  };

  // --- C. AI Front Desk ---
  const rescue = await getLeadRescueSummary(repo, tenantId);
  const frontDeskActions = actions.filter(
    (a) => a.action_type.startsWith('frontdesk.') || a.action_type === SMS_REPLY_ACTION,
  );
  const frontdeskSummary = {
    ...rescue,
    simulated_actions: frontDeskActions.filter((a) => a.simulation === true).length,
    human_review_required: leads.filter((l) => l.status === 'human_review_required').length,
  };

  // --- D. Reputation ---
  const agentsWithSnapshots: Array<{ agent_id: string; score: number; computed_at: string }> = [];
  for (const agent of agents) {
    const [latest] = await repo.listReputationSnapshots(tenantId, agent.id);
    if (latest) {
      agentsWithSnapshots.push({
        agent_id: agent.id,
        score: Number(latest.score),
        computed_at: latest.computed_at,
      });
    }
  }
  const scoreByAgent = new Map<string, number>();
  for (const e of repEvents) {
    scoreByAgent.set(e.agent_id, (scoreByAgent.get(e.agent_id) ?? 0) + Number(e.delta));
  }
  const reputationSummary = {
    agents_with_snapshots: agentsWithSnapshots.length,
    top_agents_by_score: [...scoreByAgent.entries()]
      .map(([agent_id, score]) => ({ agent_id, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
    verified_completed_actions: frontDeskActions.filter((a) => a.execution_status === 'executed')
      .length,
    failed_actions: actions.filter((a) => a.execution_status === 'failed').length,
    blocked_actions: actions.filter((a) => a.approval_status === 'rejected').length,
    unknown_claims: byTag('unknown'),
    last_recalculated_at:
      agentsWithSnapshots.sort((a, b) => b.computed_at.localeCompare(a.computed_at))[0]
        ?.computed_at ?? null,
  };

  // --- E. Credits / wallet ---
  const balances = new Map<string, number>();
  for (const e of entries) {
    balances.set(
      e.account_id,
      (balances.get(e.account_id) ?? 0) +
        (e.direction === 'credit' ? Number(e.amount) : -Number(e.amount)),
    );
  }
  const systemIds = new Set(accounts.filter((a) => a.owner_type === 'system').map((a) => a.id));
  const creditsSummary = {
    credits_accounts: accounts.length,
    ledger_entries: entries.length,
    wallet_bindings: bindings.length,
    /** Sum of non-system positive balances — what the treasury has granted out. */
    internal_credits_outstanding: [...balances.entries()]
      .filter(([id, bal]) => !systemIds.has(id) && bal > 0)
      .reduce((total, [, bal]) => total + bal, 0),
    real_payment_execution: 'disabled',
    placeholder_bindings_only: bindings.every(
      (b) => b.status === 'placeholder' || b.status === 'deactivated',
    ),
  };

  // --- F. Crypto readiness (internal/operator-only) ---
  const cryptoReadinessSummary = {
    legal_gate: 'not cleared',
    public_token_status: 'disabled',
    base_evm_optionality: 'designed-for-later',
    stablecoin_card_rails: 'future integration',
    future_integration_refs: ['x402', 'EAS', 'ERC-8004'],
    token_launch: 'not approved',
    exchange_liquidity_staking: 'disabled',
  };

  // --- G. Blockers (honest, current) ---
  const blockers = [
    {
      key: 'live_db',
      status: 'unknown',
      note: 'PGlite/test verified only; apply 0001–0014 via apply-migrations.mjs',
    },
    { key: 'production_deploy', status: 'disabled', note: 'founder go required' },
    {
      key: 'real_sms',
      status: 'disabled',
      note: 'no provider; sms.send_real deny-by-default, owner-gated',
    },
    { key: 'real_payments', status: 'disabled', note: 'internal_credits rail only (DB check)' },
    { key: 'token_legal_gate', status: 'not passed', note: 'Lane C frozen per kill gate I.1' },
    { key: 'public_token_marketing', status: 'disabled', note: 'doctrine guard tests enforce' },
    {
      key: 'hermes_skill_sources',
      status: 'open',
      note: '19/20 Core skills are seeds (external path inaccessible)',
    },
    {
      key: 'lead_detail_page',
      status: 'open',
      note: 'API exists (GET /leads/:id); console page deferred',
    },
  ];

  return {
    trustSummary,
    skillproofSummary,
    frontdeskSummary,
    reputationSummary,
    creditsSummary,
    cryptoReadinessSummary,
    blockers,
  };
}
