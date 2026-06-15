import { sql, type Kysely } from 'kysely';
import type { Database } from './schema.js';

/**
 * Production startup guard: refuse to serve under a database role that bypasses
 * Row-Level Security. RLS is the spine of tenant isolation, and Postgres
 * silently BYPASSES it for superusers and for roles with the BYPASSRLS
 * attribute — so a deploy that connects as `postgres`/`service_role` would pass
 * every RLS test in CI (run under `app_user`) yet leak across tenants in prod.
 *
 * This check closes that gap: the app must run under a NON-superuser,
 * NON-BYPASSRLS role. It is a deployment invariant the code can assert at boot.
 */

export class EnforcedRlsRoleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnforcedRlsRoleError';
  }
}

export interface RlsRoleStatus {
  role: string;
  is_superuser: boolean;
  bypass_rls: boolean;
  /** True only when the role neither is a superuser nor has BYPASSRLS. */
  enforced: boolean;
}

/** Read the current DB role's RLS-relevant attributes (no side effects). */
export async function checkRlsRole(db: Kysely<Database>): Promise<RlsRoleStatus> {
  const result = await sql<{
    role: string;
    is_superuser: boolean;
    bypass_rls: boolean;
  }>`
    select
      current_user as role,
      current_setting('is_superuser') = 'on' as is_superuser,
      coalesce(
        (select rolbypassrls from pg_roles where rolname = current_user),
        false
      ) as bypass_rls
  `.execute(db);
  const row = result.rows[0]!;
  return { ...row, enforced: !row.is_superuser && !row.bypass_rls };
}

/**
 * Assert the connection runs under an RLS-enforced role, or throw. Call at boot
 * before serving any tenant traffic in production.
 */
export async function assertEnforcedRlsRole(db: Kysely<Database>): Promise<RlsRoleStatus> {
  const status = await checkRlsRole(db);
  if (!status.enforced) {
    throw new EnforcedRlsRoleError(
      `refusing to serve: database role '${status.role}' bypasses RLS ` +
        `(is_superuser=${status.is_superuser}, bypassrls=${status.bypass_rls}). ` +
        `Run the application under a non-superuser, non-BYPASSRLS role (e.g. app_user); ` +
        `reserve the superuser only for migrations.`,
    );
  }
  return status;
}
