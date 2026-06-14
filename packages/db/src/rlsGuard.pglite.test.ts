import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Kysely, sql } from 'kysely';
import { PGlite } from '@electric-sql/pglite';
import { KyselyPGlite } from 'kysely-pglite';
import type { Database } from './schema.js';
import { assertEnforcedRlsRole, checkRlsRole, EnforcedRlsRoleError } from './rlsGuard.js';

/**
 * The RLS-role startup guard. PGlite's default role is a superuser (RLS
 * bypassed) — so the guard MUST refuse it; under a real non-superuser
 * `app_user` it MUST pass. This is the boot invariant that stops a prod deploy
 * from silently running as superuser and leaking across tenants.
 */

let pglite: PGlite;
let db: Kysely<Database>;

beforeAll(async () => {
  pglite = new PGlite();
  await pglite.exec(`create role app_user nosuperuser nologin;`);
  const { dialect } = new KyselyPGlite(pglite);
  db = new Kysely<Database>({ dialect });
});

afterAll(async () => {
  await db.destroy();
});

describe('assertEnforcedRlsRole', () => {
  it('refuses a superuser role (RLS would be bypassed)', async () => {
    await sql`reset role`.execute(db); // superuser session
    const status = await checkRlsRole(db);
    expect(status.is_superuser).toBe(true);
    expect(status.enforced).toBe(false);
    await expect(assertEnforcedRlsRole(db)).rejects.toBeInstanceOf(EnforcedRlsRoleError);
    await expect(assertEnforcedRlsRole(db)).rejects.toThrow(/bypasses RLS/i);
  });

  it('passes under a non-superuser, non-BYPASSRLS role', async () => {
    await sql`set role app_user`.execute(db);
    const status = await assertEnforcedRlsRole(db);
    expect(status.role).toBe('app_user');
    expect(status.is_superuser).toBe(false);
    expect(status.bypass_rls).toBe(false);
    expect(status.enforced).toBe(true);
    await sql`reset role`.execute(db);
  });
});
