import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';

/**
 * COG-007/010 — Command Dashboard summary (brief tests #1–#10) and the
 * final-pack documentation guards (#11–#12). The populated case drives the
 * REAL mission loop (agent → ATC → skill cert → lead → approved simulated
 * send → verified outcome) and then checks the dashboard reflects it.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const PHONE = '604-555-0177';
const NAME = 'Dash Customer';
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({ tenantId: TENANT, role, traceId: 'trace-command', ...over });

function freshHandlers() {
  const repo = new InMemoryRepository();
  return { repo, handlers: new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true })) };
}

/** The summary shape under test (mirrors buildCommandSummary's return). */
interface Summary {
  trustSummary: Record<string, number>;
  skillproofSummary: Record<string, number | string>;
  frontdeskSummary: Record<string, number>;
  reputationSummary: {
    agents_with_snapshots: number;
    top_agents_by_score: Array<{ agent_id: string; score: number }>;
    verified_completed_actions: number;
    failed_actions: number;
    blocked_actions: number;
    unknown_claims: number;
    last_recalculated_at: string | null;
  };
  creditsSummary: Record<string, number | string | boolean>;
  cryptoReadinessSummary: Record<string, string | string[]>;
  blockers: Array<{ key: string; status: string; note: string }>;
}

describe('Command Dashboard summary (COG-007)', () => {
  it('renders honest zero/empty state (#9)', async () => {
    const { handlers } = freshHandlers();
    const res = await handlers.commandSummary(asRole('viewer'));
    const s = res.body as Summary;
    expect(s.trustSummary.total_agents).toBe(0);
    expect(s.trustSummary.total_proofs).toBe(0);
    expect(s.skillproofSummary.total_internal_skills).toBe(0);
    expect(s.frontdeskSummary.total_leads).toBe(0);
    expect(s.reputationSummary.agents_with_snapshots).toBe(0);
    expect(s.reputationSummary.last_recalculated_at).toBeNull();
    expect(s.creditsSummary.credits_accounts).toBe(0);
    // Gates and blockers are present even when the system is empty (#6, #7).
    expect(s.cryptoReadinessSummary.public_token_status).toBe('disabled');
    expect(s.cryptoReadinessSummary.legal_gate).toBe('not cleared');
    const keys = s.blockers.map((b) => b.key);
    for (const k of ['live_db', 'real_sms', 'real_payments', 'token_legal_gate']) {
      expect(keys).toContain(k);
    }
  });

  it('reflects the populated mission loop with verified-only value separation (#1–#5, #8, #10)', async () => {
    const { repo, handlers } = freshHandlers();

    // Run the real loop: agent + ATC.
    const agentRes = await handlers.registerAgent(
      asRole('operator', { body: { name: 'Front Desk', slug: 'front-desk', kind: 'front_desk' } }),
    );
    const agentId = (agentRes.body as { agent: { id: string } }).agent.id;
    await handlers.issueAtc(asRole('operator', { params: { id: agentId }, body: {} }));

    // Skills + one tier-2 certification.
    await handlers.importCoreSkills(asRole('operator'));
    const skill = (await repo.listSkills(TENANT)).find((s) => s.slug === 'hermes-vision-qc')!;
    const [version] = await repo.listSkillVersions(TENANT, skill.id);
    const proofRes = await handlers.createProof(
      asRole('operator', {
        body: {
          kind: 'skill_demo',
          subject_type: 'skill',
          subject_id: skill.id,
          evidence_tag: 'verified_fact',
          evidence_ref: 'vitest:run',
          verifier_ref: 'user:operator',
        },
      }),
    );
    await handlers.createSkillProof(
      asRole('operator', {
        params: { id: version!.id },
        body: {
          proof_id: (proofRes.body as { proof: { id: string } }).proof.id,
          agent_id: agentId,
          tier: 'T2_verified',
          target_proof_tier: 2,
        },
      }),
    );

    // Lead → SMS draft → approval → simulated send → verified + inferred outcomes.
    const leadRes = await handlers.ingestLead(
      asRole('operator', {
        body: {
          source: 'sms_sim',
          contact_name: NAME,
          contact_phone: PHONE,
          message_body: 'Need a quote for a 4-bedroom move.',
          consent_captured: true,
        },
      }),
    );
    const leadId = (leadRes.body as { lead: { id: string } }).lead.id;
    const draft = await handlers.proposeLeadAction(
      asRole('operator', { params: { id: leadId }, body: { action: 'propose_sms_reply' } }),
    );
    const actionId = (draft.body as { action: { id: string } }).action.id;
    await handlers.approveAction(
      asRole('operator', {
        params: { id: actionId },
        body: { reason: { reason_code: 'accurate_and_relevant' } },
      }),
    );
    await handlers.executeFrontDeskAction(asRole('operator', { params: { id: actionId } }));
    await handlers.createLeadOutcome(
      asRole('operator', {
        params: { id: leadId },
        body: {
          outcome: 'booked_job',
          evidence_tag: 'verified_fact',
          evidence_source: 'crm:deal:dash-1',
          booked_value_cents: 120_000,
          agent_id: agentId,
        },
      }),
    );
    await handlers.createLeadOutcome(
      asRole('operator', {
        params: { id: leadId },
        body: {
          outcome: 'booked_job',
          evidence_tag: 'likely_inference',
          booked_value_cents: 999_999,
        },
      }),
    );
    await handlers.recomputeReputation(asRole('operator', { params: { id: agentId } }));

    // Credits + wallet.
    await handlers.openCreditsAccount(
      asRole('operator', { body: { owner_type: 'agent', owner_id: agentId } }),
    );
    await handlers.createWalletBinding(
      asRole('operator', { body: { owner_type: 'agent', owner_id: agentId } }),
    );

    const res = await handlers.commandSummary(asRole('viewer'));
    const s = res.body as Summary;

    // #1 trust
    expect(s.trustSummary.total_agents).toBe(1);
    expect(s.trustSummary.atc_active).toBe(1);
    expect(Number(s.trustSummary.verified_fact_proofs)).toBeGreaterThanOrEqual(3);
    expect(Number(s.trustSummary.likely_inference_proofs)).toBeGreaterThanOrEqual(1);
    // #2 skillproof
    expect(s.skillproofSummary.total_internal_skills).toBe(20);
    expect(s.skillproofSummary.core20_count).toBe(20);
    expect(s.skillproofSummary.tier_2).toBe(1);
    // #3 front desk — verified value EXCLUDES the inferred 999,999.
    expect(s.frontdeskSummary.total_leads).toBe(1);
    expect(s.frontdeskSummary.booked_jobs).toBe(2);
    expect(s.frontdeskSummary.verified_booked_value_cents).toBe(120_000);
    expect(Number(s.frontdeskSummary.simulated_actions)).toBeGreaterThanOrEqual(1);
    // #4 reputation
    expect(s.reputationSummary.agents_with_snapshots).toBe(1);
    expect(s.reputationSummary.verified_completed_actions).toBe(1);
    expect(s.reputationSummary.top_agents_by_score[0]!.agent_id).toBe(agentId);
    // #5 credits/wallet
    expect(s.creditsSummary.credits_accounts).toBe(1);
    expect(s.creditsSummary.wallet_bindings).toBe(1);
    expect(s.creditsSummary.placeholder_bindings_only).toBe(true);

    // #8 no raw PII anywhere in the aggregate.
    const json = JSON.stringify(res.body);
    expect(json).not.toContain(NAME);
    expect(json).not.toContain('555-0177');
    expect(json).not.toContain('4-bedroom');
  });
});

describe('Final-pack documentation guards (COG-010)', () => {
  const FORBIDDEN = [
    'buy token',
    'get in early',
    'APY',
    'liquidity pool',
    'exchange listing',
    'launch soon',
    'to the moon',
    'guaranteed return',
    'presale',
    'airdrop',
  ];

  function mdFilesUnder(dir: string): string[] {
    if (!existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...mdFilesUnder(full));
      else if (entry.endsWith('.md')) out.push(full);
    }
    return out;
  }

  it('demo, proof-pack, and audit docs exist and contain no token marketing (#11, #12)', () => {
    const required = [
      ['docs', 'cognitia', 'demo', 'DEMO_SCRIPT_V1.md'],
      ['docs', 'cognitia', 'proof-pack', 'README.md'],
      ['docs', 'cognitia', 'proof-pack', 'PR_STACK.md'],
      ['docs', 'cognitia', 'proof-pack', 'VERIFICATION_MATRIX.md'],
      ['docs', 'cognitia', 'audits', 'V1_1_FINAL_AUDIT.md'],
      ['docs', 'cognitia', 'execution', 'MERGE_READINESS.md'],
      ['docs', 'cognitia', 'execution', 'V1_1_FINAL_HANDOFF.md'],
    ];
    for (const rel of required) {
      expect(existsSync(join(repoRoot, ...rel)), rel.join('/')).toBe(true);
    }
    const docs = [
      ...mdFilesUnder(join(repoRoot, 'docs', 'cognitia', 'demo')),
      ...mdFilesUnder(join(repoRoot, 'docs', 'cognitia', 'proof-pack')),
      ...mdFilesUnder(join(repoRoot, 'docs', 'cognitia', 'audits')),
    ];
    expect(docs.length).toBeGreaterThanOrEqual(5);
    for (const file of docs) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const phrase of FORBIDDEN) {
        expect(content, `${file}: ${phrase}`).not.toContain(phrase.toLowerCase());
      }
    }
  });
});
