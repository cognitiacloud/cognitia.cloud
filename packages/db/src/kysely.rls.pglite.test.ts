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
 * Privileged-role RLS verification.
 *
 * PGlite's default role is `postgres` (superuser), which BYPASSES RLS — so it is
 * NOT an acceptable mode for proving policies. This harness creates a normal
 * NON-superuser role (`app_user`) and runs everything under it, so the row-level
 * security policies are genuinely enforced. We assert that:
 *   - a superuser sees both tenants (RLS bypass) but `app_user` does NOT — proving
 *     the harness is actually in an enforced (non-bypass) mode;
 *   - tenant A reads its own rows, never tenant B's (raw SQL with NO app predicate
 *     — pure RLS — and via the production KyselyRepository);
 *   - tenant A cannot UPDATE or INSERT tenant B rows (RLS USING / WITH CHECK).
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');
const MIGRATIONS = [
  '0001_tenants_users.sql',
  '0002_integrations_external_maps.sql',
  '0003_gtm_entities.sql',
  '0004_events_agent_runs_actions.sql',
  // Policy-bearing tables added later — proven under the enforced role too.
  '0009_audit_hash_chain.sql',
  '0010_agent_passports.sql',
];

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const ACC_A = 'a1000000-0000-4000-8000-000000000001';
const ACC_B = 'b1000000-0000-4000-8000-000000000001';

function preprocess(sql: string): string {
  return sql.replace(/create extension[^;]*;/gi, '');
}

let pglite: PGlite;
let db: Kysely<Database>;
let repo: KyselyRepository;

/** Switch the session to the non-superuser role (RLS enforced). */
async function useAppUser(tenantId?: string): Promise<void> {
  await pglite.query('reset role'); // back to superuser session auth
  await pglite.query('set role app_user'); // -> non-superuser, RLS applies
  if (tenantId) await pglite.query(`set app.current_tenant_id = '${tenantId}'`);
}
async function useSuperuser(): Promise<void> {
  await pglite.query('reset role');
}

beforeAll(async () => {
  pglite = new PGlite({
    parsers: { 1700: (v: string) => (v == null ? null : Number(v)) },
  });
  for (const file of MIGRATIONS) {
    await pglite.exec(preprocess(readFileSync(join(migrationsDir, file), 'utf8')));
  }

  // Seed as superuser (RLS bypassed) BEFORE dropping privileges.
  await pglite.query('insert into tenants (id, name, slug) values ($1::uuid, $2, $3)', [
    TENANT_A,
    'Tenant A',
    'tenant-a',
  ]);
  await pglite.query('insert into tenants (id, name, slug) values ($1::uuid, $2, $3)', [
    TENANT_B,
    'Tenant B',
    'tenant-b',
  ]);
  await pglite.query('insert into accounts (id, tenant_id, name) values ($1,$2,$3)', [
    ACC_A,
    TENANT_A,
    'Acme (A)',
  ]);
  await pglite.query('insert into accounts (id, tenant_id, name) values ($1,$2,$3)', [
    ACC_B,
    TENANT_B,
    'Globex (B)',
  ]);

  // Seed the later policy-bearing tables (0009 audit columns, 0010 passports).
  for (const t of [TENANT_A, TENANT_B]) {
    await pglite.query(
      `insert into audit_events (tenant_id, actor_ref, action, subject_ref, prev_hash, hash)
       values ($1::uuid, 'user:seed', 'proposed', 'agent_action:x', 'genesis', $2)`,
      [t, `hash-${t}`],
    );
    const passport = await pglite.query<{ id: string }>(
      `insert into agent_passports (tenant_id, agent_id, owner_ref) values ($1::uuid, 'mira', 'user:owner') returning id`,
      [t],
    );
    await pglite.query(
      `insert into scope_grants (tenant_id, passport_id, action_type, integration, risk_max, approved_by, approved_at, expires_at)
       values ($1::uuid, $2::uuid, 'crm.task.create', 'hubspot', 'low', 'user:owner', now(), now() + interval '1 day')`,
      [t, passport.rows[0]!.id],
    );
  }

  // Create a real non-superuser role with table/function grants (but NOT bypass).
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

describe('RLS is actually enforced under a non-superuser role', () => {
  it('superuser bypasses RLS (sees both tenants); app_user does NOT', async () => {
    await useSuperuser();
    const asSuper = await pglite.query<{ n: number }>('select count(*)::int as n from accounts');
    expect(asSuper.rows[0]!.n).toBe(2); // superuser bypass — control

    await useAppUser(TENANT_A);
    const asApp = await pglite.query<{ n: number }>('select count(*)::int as n from accounts');
    expect(asApp.rows[0]!.n).toBe(1); // RLS enforced — only tenant A visible
  });
});

describe('Pure RLS (raw SQL, no application predicate)', () => {
  it('tenant A reads only tenant A rows', async () => {
    await useAppUser(TENANT_A);
    const rows = await pglite.query<{ id: string; tenant_id: string }>(
      'select id, tenant_id from accounts',
    );
    expect(rows.rows.map((r) => r.tenant_id)).toEqual([TENANT_A]);
  });

  it('tenant A cannot SELECT a tenant B row even by id', async () => {
    await useAppUser(TENANT_A);
    const rows = await pglite.query('select id from accounts where id = $1', [ACC_B]);
    expect(rows.rows).toHaveLength(0); // RLS USING clause hides it
  });

  it('tenant A cannot UPDATE a tenant B row (0 rows affected, B unchanged)', async () => {
    await useAppUser(TENANT_A);
    const upd = await pglite.query('update accounts set name = $1 where id = $2', [
      'HACKED',
      ACC_B,
    ]);
    expect(upd.affectedRows).toBe(0);

    await useSuperuser();
    const check = await pglite.query<{ name: string }>('select name from accounts where id = $1', [
      ACC_B,
    ]);
    expect(check.rows[0]!.name).toBe('Globex (B)'); // untouched
  });

  it('tenant A cannot INSERT a row for tenant B (WITH CHECK violation)', async () => {
    await useAppUser(TENANT_A);
    await expect(
      pglite.query('insert into accounts (tenant_id, name) values ($1, $2)', [TENANT_B, 'evil']),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe('Repository layer under the non-superuser role (predicates + RLS)', () => {
  it('tenant A reads its own account via KyselyRepository', async () => {
    await useAppUser();
    const accounts = await repo.listAccounts(TENANT_A);
    expect(accounts.map((a) => a.id)).toEqual([ACC_A]);
  });

  it('a tenant-A-scoped read cannot reach a tenant B row by id (predicate + RLS)', async () => {
    // Isolation comes from the *scope*: `getAccount(A, …)` sets app.current_tenant_id=A,
    // so RLS + the predicate both exclude B's row. (Asking the repo for tenant B would
    // legitimately scope to B — protection relies on the app passing the authenticated
    // tenant, which RLS then enforces; see the pure-RLS probes above.)
    await useAppUser();
    expect(await repo.getAccount(TENANT_A, ACC_B)).toBeNull();
    expect(await repo.getAccount(TENANT_A, ACC_A)).not.toBeNull();
  });
});

describe('RLS on the later policy-bearing tables (audit_events, passports, grants)', () => {
  it('audit_events: tenant A sees only its own row; cannot forge a tenant B row', async () => {
    await useAppUser(TENANT_A);
    const rows = await pglite.query<{ tenant_id: string }>('select tenant_id from audit_events');
    expect(rows.rows.map((r) => r.tenant_id)).toEqual([TENANT_A]);
    await expect(
      pglite.query(
        `insert into audit_events (tenant_id, actor_ref, action, subject_ref, prev_hash, hash)
         values ($1::uuid, 'user:evil', 'proposed', 'x', 'genesis', 'h')`,
        [TENANT_B],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('agent_passports + scope_grants: tenant A sees only its own; cross-tenant insert blocked', async () => {
    await useAppUser(TENANT_A);
    const passports = await pglite.query<{ tenant_id: string }>(
      'select tenant_id from agent_passports',
    );
    expect(passports.rows.map((r) => r.tenant_id)).toEqual([TENANT_A]);
    const grants = await pglite.query<{ tenant_id: string }>('select tenant_id from scope_grants');
    expect(grants.rows.map((r) => r.tenant_id)).toEqual([TENANT_A]);
    await expect(
      pglite.query(
        `insert into agent_passports (tenant_id, agent_id, owner_ref) values ($1::uuid, 'evil', 'user:x')`,
        [TENANT_B],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('audit_events is append-only at the policy layer (no UPDATE/DELETE policy)', async () => {
    await useSuperuser();
    const policies = await pglite.query<{ cmd: string }>(
      `select cmd from pg_policies where tablename = 'audit_events'`,
    );
    const cmds = new Set(policies.rows.map((r) => r.cmd.toUpperCase()));
    expect(cmds.has('UPDATE')).toBe(false);
    expect(cmds.has('DELETE')).toBe(false);
    expect(cmds.has('ALL')).toBe(false);
    // And a tenant cannot UPDATE/DELETE its own audit history through the app role.
    await useAppUser(TENANT_A);
    const upd = await pglite.query(`update audit_events set action = 'tampered'`);
    expect(upd.affectedRows).toBe(0);
    const del = await pglite.query(`delete from audit_events`);
    expect(del.affectedRows).toBe(0);
  });
});
