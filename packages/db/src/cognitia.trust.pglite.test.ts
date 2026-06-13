import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Cognitia v1.1 trust-layer schema verification (migrations 0009–0012) against
 * real Postgres semantics via PGlite. Every doctrine invariant that the
 * Architecture Lock requires (docs/cognitia/ARCHITECTURE_LOCK_V1_1.md) and
 * that lives in the database — evidence-tag rules, append-only proofs/ledger,
 * reputation gating, simulation-first SMS, placeholder-only wallets — is
 * exercised here, so service layers cannot silently drift from doctrine.
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');
const fixturesDir = join(here, '..', 'fixtures');

const MIGRATIONS = [
  '0001_tenants_users.sql',
  '0002_integrations_external_maps.sql',
  '0003_gtm_entities.sql',
  '0004_events_agent_runs_actions.sql',
  '0009_cognitia_trust_core.sql',
  '0010_skillproof_reputation.sql',
  '0011_moveros_lead_rescue.sql',
  '0012_credits_wallet.sql',
  '0013_skillproof_frontdesk_ext.sql',
  '0014_wallet_binding_deactivate.sql',
  '0016_agent_economy.sql',
  '0017_dispute_resolution.sql',
];

/** Strip extension statements PGlite doesn't bundle; gen_random_uuid() is core in pg16. */
function preprocess(sql: string): string {
  return sql.replace(/create extension[^;]*;/gi, '');
}

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const AGENT_ID = 'c0a00000-0000-0000-0000-000000000001';
const ATC_ID = 'c0a10000-0000-0000-0000-000000000001';
const PROOF_VERIFIED = 'c0a30000-0000-0000-0000-000000000001';
const PROOF_INFERENCE = 'c0a30000-0000-0000-0000-000000000002';
const PROOF_UNKNOWN = 'c0a30000-0000-0000-0000-000000000003';

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  for (const file of MIGRATIONS) {
    await db.exec(preprocess(readFileSync(join(migrationsDir, file), 'utf8')));
  }
  await db.exec(readFileSync(join(fixturesDir, '0001_tenants_users.fixture.sql'), 'utf8'));
  await db.exec(readFileSync(join(fixturesDir, 'cognitia_trust.fixture.sql'), 'utf8'));
});

describe('Cognitia trust schema (PGlite)', () => {
  it('fixture seeds 1 agent, 1 active ATC, deny-by-default sms.send_real, 3 proofs (one per tag)', async () => {
    const agents = await db.query<{ count: number }>(
      `select count(*)::int as count from agents where tenant_id = $1`,
      [TENANT_A],
    );
    expect(agents.rows[0]!.count).toBe(1);

    const atc = await db.query<{ status: string }>(
      `select status from agent_trust_credentials where id = $1`,
      [ATC_ID],
    );
    expect(atc.rows[0]!.status).toBe('active');

    const perm = await db.query<{ effect: string }>(
      `select effect from agent_permissions where agent_id = $1 and action_key = 'sms.send_real'`,
      [AGENT_ID],
    );
    expect(perm.rows[0]!.effect).toBe('deny');

    const tags = await db.query<{ evidence_tag: string }>(
      `select evidence_tag from proofs where tenant_id = $1 order by evidence_tag`,
      [TENANT_A],
    );
    expect(tags.rows.map((r) => r.evidence_tag)).toEqual([
      'likely_inference',
      'unknown',
      'verified_fact',
    ]);
  });

  describe('proof integrity (Architecture Lock §7)', () => {
    it('rejects an invalid evidence_tag', async () => {
      await expect(
        db.query(
          `insert into proofs (tenant_id, kind, subject_type, subject_id, evidence_tag)
           values ($1, 'system', 'agent', $2, 'totally_true')`,
          [TENANT_A, AGENT_ID],
        ),
      ).rejects.toThrow(/check constraint/i);
    });

    it('rejects verified_fact without evidence_ref + verifier_ref', async () => {
      await expect(
        db.query(
          `insert into proofs (tenant_id, kind, subject_type, subject_id, evidence_tag)
           values ($1, 'system', 'agent', $2, 'verified_fact')`,
          [TENANT_A, AGENT_ID],
        ),
      ).rejects.toThrow(/proofs_verified_fact_requires_refs/i);
    });

    it('public_safe defaults to false', async () => {
      const row = await db.query<{ public_safe: boolean }>(
        `select public_safe from proofs where id = $1`,
        [PROOF_VERIFIED],
      );
      expect(row.rows[0]!.public_safe).toBe(false);
    });

    it('cannot set public_safe without a passed redaction check', async () => {
      await expect(
        db.query(`update proofs set public_safe = true where id = $1`, [PROOF_VERIFIED]),
      ).rejects.toThrow(/proofs_public_requires_redaction/i);
    });

    it('allows publishing once the redaction check passed', async () => {
      await db.query(
        `update proofs set public_safe = true, redaction_check_passed_at = now() where id = $1`,
        [PROOF_VERIFIED],
      );
      const row = await db.query<{ public_safe: boolean }>(
        `select public_safe from proofs where id = $1`,
        [PROOF_VERIFIED],
      );
      expect(row.rows[0]!.public_safe).toBe(true);
    });

    it('proofs are append-only: substantive columns cannot be edited', async () => {
      await expect(
        db.query(`update proofs set summary_public = 'rewritten history' where id = $1`, [
          PROOF_VERIFIED,
        ]),
      ).rejects.toThrow(/append-only/i);
      await expect(
        db.query(`update proofs set evidence_tag = 'verified_fact' where id = $1`, [PROOF_UNKNOWN]),
      ).rejects.toThrow(/append-only/i);
    });

    it('proofs cannot be deleted; corrections supersede instead', async () => {
      await expect(db.query(`delete from proofs where id = $1`, [PROOF_UNKNOWN])).rejects.toThrow(
        /delete is forbidden/i,
      );
      await db.query(
        `insert into proofs (tenant_id, kind, subject_type, subject_id, evidence_tag,
                             evidence_ref, verifier_ref, supersedes_proof_id)
         values ($1, 'lead_response', 'agent', $2, 'verified_fact',
                 'log:measured-now', 'user:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', $3)`,
        [TENANT_A, AGENT_ID, PROOF_UNKNOWN],
      );
      const row = await db.query<{ count: number }>(
        `select count(*)::int as count from proofs where supersedes_proof_id = $1`,
        [PROOF_UNKNOWN],
      );
      expect(row.rows[0]!.count).toBe(1);
    });
  });

  describe('reputation gating (Architecture Lock §7: only verified_fact may add reputation)', () => {
    it('accepts a positive delta backed by a verified_fact proof', async () => {
      await db.query(
        `insert into reputation_events (tenant_id, agent_id, proof_id, delta, reason_code)
         values ($1, $2, $3, 5, 'demo_registered')`,
        [TENANT_A, AGENT_ID, PROOF_VERIFIED],
      );
    });

    it('rejects a positive delta backed by likely_inference', async () => {
      await expect(
        db.query(
          `insert into reputation_events (tenant_id, agent_id, proof_id, delta, reason_code)
           values ($1, $2, $3, 1, 'wishful_thinking')`,
          [TENANT_A, AGENT_ID, PROOF_INFERENCE],
        ),
      ).rejects.toThrow(/positive reputation requires a verified_fact proof/i);
    });

    it('rejects a positive delta backed by unknown', async () => {
      await expect(
        db.query(
          `insert into reputation_events (tenant_id, agent_id, proof_id, delta, reason_code)
           values ($1, $2, $3, 0.1, 'hope')`,
          [TENANT_A, AGENT_ID, PROOF_UNKNOWN],
        ),
      ).rejects.toThrow(/positive reputation requires a verified_fact proof/i);
    });

    it('allows negative deltas regardless of tag (bad news is always admissible)', async () => {
      await db.query(
        `insert into reputation_events (tenant_id, agent_id, proof_id, delta, reason_code)
         values ($1, $2, $3, -2, 'observed_failure')`,
        [TENANT_A, AGENT_ID, PROOF_INFERENCE],
      );
    });

    it('reputation_events are append-only', async () => {
      await expect(db.query(`update reputation_events set delta = 1000`)).rejects.toThrow(
        /update is forbidden/i,
      );
      await expect(db.query(`delete from reputation_events`)).rejects.toThrow(
        /delete is forbidden/i,
      );
    });
  });

  describe('ATC lifecycle', () => {
    it('revoked is terminal', async () => {
      await db.query(
        `insert into agent_trust_credentials (id, tenant_id, agent_id, subject_ref, status)
         values ('c0a10000-0000-0000-0000-00000000dead', $1, $2, $3, 'revoked')`,
        [TENANT_A, AGENT_ID, `agent:${AGENT_ID}`],
      );
      await expect(
        db.query(
          `update agent_trust_credentials set status = 'active'
           where id = 'c0a10000-0000-0000-0000-00000000dead'`,
        ),
      ).rejects.toThrow(/revoked credentials cannot change status/i);
    });
  });

  describe('SkillProof tiers', () => {
    let skillId: string;
    beforeAll(async () => {
      const inserted = await db.query<{ id: string }>(
        `insert into skills (tenant_id, name, slug) values ($1, 'SMS Drafting', 'sms-drafting')
         returning id`,
        [TENANT_A],
      );
      skillId = inserted.rows[0]!.id;
    });

    it('skills are internal-only in v1.1', async () => {
      await expect(
        db.query(
          `insert into skills (tenant_id, name, slug, visibility)
           values ($1, 'Public Skill', 'public-skill', 'public')`,
          [TENANT_A],
        ),
      ).rejects.toThrow(/check constraint/i);
    });

    it('T2_verified requires a verified_fact proof', async () => {
      await expect(
        db.query(
          `insert into skill_proofs (tenant_id, skill_id, agent_id, proof_id, tier, evidence_tag)
           values ($1, $2, $3, $4, 'T2_verified', 'likely_inference')`,
          [TENANT_A, skillId, AGENT_ID, PROOF_INFERENCE],
        ),
      ).rejects.toThrow(/requires a verified_fact proof/i);
      await db.query(
        `insert into skill_proofs (tenant_id, skill_id, agent_id, proof_id, tier, evidence_tag)
         values ($1, $2, $3, $4, 'T2_verified', 'verified_fact')`,
        [TENANT_A, skillId, AGENT_ID, PROOF_VERIFIED],
      );
    });
  });

  describe('MoverOS lead rescue (Architecture Lock §6, §8)', () => {
    let intakeId: string;

    it('lead intake captures consent and stores only encrypted PII columns', async () => {
      const inserted = await db.query<{ id: string; pii_status: string }>(
        `insert into lead_intakes (tenant_id, source, contact_name_enc, contact_phone_enc,
                                   contact_phone_hash, message_body_enc, consent_captured)
         values ($1, 'sms_sim', 'enc:v1:name', 'enc:v1:phone', 'sha256:demo-phone', 'enc:v1:body', true)
         returning id, pii_status`,
        [TENANT_A],
      );
      intakeId = inserted.rows[0]!.id;
      expect(inserted.rows[0]!.pii_status).toBe('raw');
    });

    it('purged means purged: PII columns must be null', async () => {
      await expect(
        db.query(`update lead_intakes set pii_status = 'purged' where id = $1`, [intakeId]),
      ).rejects.toThrow(/lead_intakes_purged_is_empty/i);
      await db.query(
        `update lead_intakes
         set pii_status = 'purged', contact_name_enc = null, contact_phone_enc = null,
             message_body_enc = null
         where id = $1`,
        [intakeId],
      );
    });

    it('sms.% agent_actions default to simulation = true (no real send by omission)', async () => {
      const run = await db.query<{ id: string }>(
        `insert into agent_runs (tenant_id, agent, objective, trace_id)
         values ($1, 'frontdesk', 'rescue lead', 'trace-cog-002') returning id`,
        [TENANT_A],
      );
      const action = await db.query<{ simulation: boolean }>(
        `insert into agent_actions (tenant_id, agent_run_id, action_type, risk_level,
                                    idempotency_key, target_ref)
         values ($1, $2, 'sms.reply.send', 'medium', 'cog-002-sms-1', 'lead_intake:' || $3)
         returning simulation`,
        [TENANT_A, run.rows[0]!.id, intakeId],
      );
      expect(action.rows[0]!.simulation).toBe(true);
    });

    it('lead outcomes carry evidence tags', async () => {
      await expect(
        db.query(
          `insert into lead_outcomes (tenant_id, lead_intake_id, outcome, evidence_tag)
           values ($1, $2, 'booked', 'definitely')`,
          [TENANT_A, intakeId],
        ),
      ).rejects.toThrow(/check constraint/i);
      await db.query(
        `insert into lead_outcomes (tenant_id, lead_intake_id, outcome, response_time_ms, evidence_tag)
         values ($1, $2, 'rescued', 42000, 'likely_inference')`,
        [TENANT_A, intakeId],
      );
    });
  });

  describe('credits + wallet placeholders (Architecture Lock §5)', () => {
    let accountA: string;
    let accountB: string;

    beforeAll(async () => {
      const a = await db.query<{ id: string }>(
        `insert into credits_accounts (tenant_id, owner_type, owner_id)
         values ($1, 'tenant', $1) returning id`,
        [TENANT_A],
      );
      accountA = a.rows[0]!.id;
      const b = await db.query<{ id: string }>(
        `insert into credits_accounts (tenant_id, owner_type, owner_id)
         values ($1, 'agent', $2) returning id`,
        [TENANT_A, AGENT_ID],
      );
      accountB = b.rows[0]!.id;
    });

    it('a transfer is a balanced debit+credit pair sharing an idempotency key', async () => {
      await db.query(
        `insert into credits_ledger_entries
           (tenant_id, account_id, counter_account_id, amount, direction, reason_code, idempotency_key)
         values
           ($1, $2, $3, 100, 'debit', 'grant', 'xfer-1'),
           ($1, $3, $2, 100, 'credit', 'grant', 'xfer-1')`,
        [TENANT_A, accountA, accountB],
      );
      const sums = await db.query<{ direction: string; total: string }>(
        `select direction, sum(amount)::text as total from credits_ledger_entries
         where idempotency_key = 'xfer-1' group by direction order by direction`,
      );
      expect(sums.rows).toEqual([
        { direction: 'credit', total: '100' },
        { direction: 'debit', total: '100' },
      ]);
    });

    it('a duplicate idempotency key is rejected (retries become no-ops upstream)', async () => {
      await expect(
        db.query(
          `insert into credits_ledger_entries
             (tenant_id, account_id, counter_account_id, amount, direction, reason_code, idempotency_key)
           values ($1, $2, $3, 100, 'debit', 'grant', 'xfer-1')`,
          [TENANT_A, accountA, accountB],
        ),
      ).rejects.toThrow(/duplicate key/i);
    });

    it('the ledger is append-only', async () => {
      await expect(db.query(`update credits_ledger_entries set amount = 1`)).rejects.toThrow(
        /update is forbidden/i,
      );
      await expect(db.query(`delete from credits_ledger_entries`)).rejects.toThrow(
        /delete is forbidden/i,
      );
    });

    it('only the internal_credits rail is live in v1.1', async () => {
      await expect(
        db.query(
          `insert into credits_ledger_entries
             (tenant_id, account_id, counter_account_id, amount, direction, rail, reason_code, idempotency_key)
           values ($1, $2, $3, 5, 'debit', 'stripe_card', 'oops', 'xfer-2')`,
          [TENANT_A, accountA, accountB],
        ),
      ).rejects.toThrow(/ledger_internal_rail_only/i);
    });

    it('wallet bindings only accept placeholder status', async () => {
      await db.query(
        `insert into wallet_bindings (tenant_id, owner_type, owner_id)
         values ($1, 'agent', $2)`,
        [TENANT_A, AGENT_ID],
      );
      await expect(
        db.query(`update wallet_bindings set status = 'active' where owner_id = $1`, [AGENT_ID]),
      ).rejects.toThrow(/check constraint/i);
    });
  });
});
