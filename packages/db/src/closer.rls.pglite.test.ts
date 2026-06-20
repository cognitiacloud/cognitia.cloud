import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Kysely } from 'kysely';
import { PGlite } from '@electric-sql/pglite';
import { KyselyPGlite } from 'kysely-pglite';
import type { Database } from './schema.js';
import { KyselyRepository } from './kysely.js';

/**
 * RLS verification for the Sales Closer tables (0020/0021) under a real
 * non-superuser role — the same harness shape as kysely.rls.pglite.test.ts.
 * Proves tenant A can never read/insert another tenant's closer_sources.
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');
const MIGRATIONS = [
  '0001_tenants_users.sql',
  '0002_integrations_external_maps.sql',
  '0003_gtm_entities.sql',
  '0004_events_agent_runs_actions.sql',
  '0020_closer_sources_runs.sql',
  '0021_closer_profiles_briefs.sql',
];

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const SRC_A = 'c1000000-0000-4000-8000-000000000001';
const SRC_B = 'c1000000-0000-4000-8000-000000000002';

function preprocess(sql: string): string {
  return sql.replace(/create extension[^;]*;/gi, '');
}

let pglite: PGlite;
let db: Kysely<Database>;
let repo: KyselyRepository;

async function useAppUser(tenantId?: string): Promise<void> {
  await pglite.query('reset role');
  await pglite.query('set role app_user');
  if (tenantId) await pglite.query(`set app.current_tenant_id = '${tenantId}'`);
}
async function useSuperuser(): Promise<void> {
  await pglite.query('reset role');
}

beforeAll(async () => {
  pglite = new PGlite({ parsers: { 1700: (v: string) => (v == null ? null : Number(v)) } });
  for (const file of MIGRATIONS) {
    await pglite.exec(preprocess(readFileSync(join(migrationsDir, file), 'utf8')));
  }

  // Seed as superuser (RLS bypassed) before dropping privileges.
  for (const [id, slug] of [
    [TENANT_A, 'tenant-a'],
    [TENANT_B, 'tenant-b'],
  ]) {
    await pglite.query('insert into tenants (id, name, slug) values ($1::uuid, $2, $3)', [
      id,
      slug,
      slug,
    ]);
  }
  for (const [id, tenant] of [
    [SRC_A, TENANT_A],
    [SRC_B, TENANT_B],
  ]) {
    await pglite.query(
      'insert into closer_sources (id, tenant_id, label, apify_actor_id, source_risk) values ($1,$2,$3,$4,$5)',
      [id, tenant, 'crawl', 'apify/website-content-crawler', 'safe_public_website_crawl'],
    );
  }

  await pglite.exec(`
    create role app_user nosuperuser nologin;
    grant usage on schema public to app_user;
    grant select, insert, update, delete on all tables in schema public to app_user;
    grant execute on all functions in schema public to app_user;
  `);

  const { dialect } = new KyselyPGlite(pglite);
  db = new Kysely<Database>({ dialect });
  repo = new KyselyRepository(db);
});

afterAll(async () => {
  await db.destroy();
});

describe('closer RLS under a non-superuser role', () => {
  it('tenant A sees only its own closer_sources (pure RLS)', async () => {
    await useAppUser(TENANT_A);
    const rows = await pglite.query<{ tenant_id: string }>('select tenant_id from closer_sources');
    expect(rows.rows.map((r) => r.tenant_id)).toEqual([TENANT_A]);
  });

  it('tenant A cannot SELECT a tenant B source by id', async () => {
    await useAppUser(TENANT_A);
    const rows = await pglite.query('select id from closer_sources where id = $1', [SRC_B]);
    expect(rows.rows).toHaveLength(0);
  });

  it('tenant A cannot INSERT a closer_source for tenant B (WITH CHECK)', async () => {
    await useAppUser(TENANT_A);
    await expect(
      pglite.query(
        'insert into closer_sources (tenant_id, label, apify_actor_id, source_risk) values ($1,$2,$3,$4)',
        [TENANT_B, 'evil', 'apify/x', 'safe_public_website_crawl'],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('the disallowed-active check constraint is enforced', async () => {
    await useSuperuser();
    await expect(
      pglite.query(
        'insert into closer_sources (tenant_id, label, apify_actor_id, source_risk, active) values ($1,$2,$3,$4,true)',
        [TENANT_A, 'bad', 'apify/x', 'disallowed'],
      ),
    ).rejects.toThrow(/closer_sources_disallowed_not_active|check/i);
  });

  it('KyselyRepository scopes closer_sources to the tenant', async () => {
    await useAppUser();
    const rows = await repo.listCloserSources(TENANT_A);
    expect(rows.map((r) => r.id)).toEqual([SRC_A]);
  });
});
