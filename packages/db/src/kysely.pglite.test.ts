import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Kysely } from 'kysely';
import { PGlite } from '@electric-sql/pglite';
import { KyselyPGlite } from 'kysely-pglite';
import type { Database } from './schema.js';
import { KyselyRepository } from './kysely.js';
import { repositoryContract, type RepositoryHarness } from './repository.contract.js';
import { describe, it, expect } from 'vitest';
import { verifyAuditChain } from './auditChain.js';

/**
 * Live contract verification of the production KyselyRepository against a real
 * Postgres engine (PGlite, in-process WASM). Runs the actual migrations the repo
 * depends on, then executes the shared repository contract — the same suite the
 * in-memory repo runs — so the Kysely SQL, JSONB casts, idempotent ingest, and
 * tenant-scoped reads are validated against real Postgres semantics.
 *
 * Scope note: PGlite's default role is a superuser, which BYPASSES RLS. So this
 * harness validates the repository-layer isolation (explicit tenant predicates +
 * withTenant GUC), not RLS-engine enforcement under a non-superuser role — that
 * still needs live Postgres / a privileged-role harness (documented in the PR).
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

// Migrations the repository's tables live in (companies/contacts/deals/events/
// agent runs+actions/audit/external maps/sync runs/feedback labels). 0005–0006
// (campaigns, pgvector) aren't needed for repository behavior.
const MIGRATIONS = [
  '0001_tenants_users.sql',
  '0002_integrations_external_maps.sql',
  '0003_gtm_entities.sql',
  '0004_events_agent_runs_actions.sql',
  '0007_evals_experiments.sql',
  '0009_audit_hash_chain.sql',
  '0010_agent_passports.sql',
];

/** Strip extension statements PGlite doesn't bundle; gen_random_uuid() is core in pg16. */
function preprocess(sql: string): string {
  return sql.replace(/create extension[^;]*;/gi, '');
}

async function makePgliteHarness(): Promise<RepositoryHarness> {
  // Parse numeric (OID 1700) as JS number to match our row types.
  const pglite = new PGlite({
    parsers: { 1700: (value: string) => (value == null ? null : Number(value)) },
  });
  for (const file of MIGRATIONS) {
    await pglite.exec(preprocess(readFileSync(join(migrationsDir, file), 'utf8')));
  }

  const { dialect } = new KyselyPGlite(pglite);
  const db = new Kysely<Database>({ dialect });

  return {
    repo: new KyselyRepository(db),
    async ensureTenant(tenantId: string) {
      await pglite.query(
        'insert into tenants (id, name, slug) values ($1, $2, $3) on conflict (id) do nothing',
        [tenantId, tenantId, tenantId],
      );
    },
    async seedConnection(tenantId: string, externalSystem: string, status: string) {
      await pglite.query(
        `insert into integration_connections (tenant_id, external_system, status)
         values ($1, $2, $3)
         on conflict (tenant_id, external_system) do update set status = excluded.status`,
        [tenantId, externalSystem, status],
      );
    },
    async dispose() {
      // db.destroy() tears down the Kysely driver, which closes the PGlite client.
      await db.destroy();
    },
  };
}

repositoryContract('KyselyRepository (PGlite)', makePgliteHarness);

/**
 * SEC-1 — tamper EVIDENCE on real Postgres. An out-of-band mutation of audit
 * history (raw SQL UPDATE/DELETE, bypassing the app and RLS as a superuser
 * would) must be detectable by chain verification. This is the property the
 * /audit/verify endpoint exposes to security reviewers.
 */
describe('audit chain tamper evidence (PGlite, raw SQL mutation)', () => {
  const TENANT = '11111111-1111-1111-1111-111111111111';

  async function seeded() {
    const pglite = new PGlite({
      parsers: { 1700: (value: string) => (value == null ? null : Number(value)) },
    });
    for (const file of MIGRATIONS) {
      await pglite.exec(preprocess(readFileSync(join(migrationsDir, file), 'utf8')));
    }
    await pglite.query('insert into tenants (id, name, slug) values ($1, $2, $3)', [
      TENANT,
      TENANT,
      TENANT,
    ]);
    const { dialect } = new KyselyPGlite(pglite);
    const db = new Kysely<Database>({ dialect });
    const repo = new KyselyRepository(db);
    for (let n = 1; n <= 3; n++) {
      await repo.insertAuditEvent({
        id: `00000000-0000-0000-0000-00000000000${n}`,
        tenant_id: TENANT,
        actor_ref: 'user:sec',
        action: `step-${n}`,
        subject_ref: 'agent_action:00000000-0000-0000-0000-0000000000aa',
        detail: { n },
        occurred_at: '2026-06-10T00:00:00.000Z',
        created_at: '2026-06-10T00:00:00.000Z',
      });
    }
    return { pglite, db, repo };
  }

  it('detects a mutated audit row (action rewritten in SQL)', async () => {
    const { pglite, db, repo } = await seeded();
    expect(verifyAuditChain(await repo.listAuditEvents(TENANT))).toMatchObject({ ok: true });
    await pglite.query(`update audit_events set action = 'approved' where action = 'step-2'`);
    expect(verifyAuditChain(await repo.listAuditEvents(TENANT))).toMatchObject({
      ok: false,
      failure: 'hash_mismatch',
    });
    await db.destroy();
  });

  it('detects a deleted audit row (history dropped in SQL)', async () => {
    const { pglite, db, repo } = await seeded();
    await pglite.query(`delete from audit_events where action = 'step-2'`);
    const result = verifyAuditChain(await repo.listAuditEvents(TENANT));
    expect(result.ok).toBe(false);
    expect(result.failure).toBe('broken_link');
    await db.destroy();
  });
});
