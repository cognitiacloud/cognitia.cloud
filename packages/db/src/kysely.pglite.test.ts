import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Kysely } from 'kysely';
import { PGlite } from '@electric-sql/pglite';
import { KyselyPGlite } from 'kysely-pglite';
import type { Database } from './schema.js';
import { KyselyRepository } from './kysely.js';
import { repositoryContract, type RepositoryHarness } from './repository.contract.js';

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
// agent runs+actions/audit/external maps/sync runs). 0005–0007 (campaigns,
// pgvector, evals) aren't needed for repository behavior.
const MIGRATIONS = [
  '0001_tenants_users.sql',
  '0002_integrations_external_maps.sql',
  '0003_gtm_entities.sql',
  '0004_events_agent_runs_actions.sql',
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
    async dispose() {
      // db.destroy() tears down the Kysely driver, which closes the PGlite client.
      await db.destroy();
    },
  };
}

repositoryContract('KyselyRepository (PGlite)', makePgliteHarness);
