import { Kysely, PostgresDialect, sql } from 'kysely';
import type { Database } from './schema.js';

/**
 * Production DB client (Kysely over node-postgres).
 *
 * Why Kysely: SQL-first and fully typed, no codegen runtime, and—crucially for
 * our RLS model—it lets us run `SET LOCAL app.current_tenant_id = ...` inside a
 * transaction so Postgres enforces tenant isolation. Prisma hides raw SQL and
 * makes per-transaction GUCs awkward; Drizzle is comparable but Kysely's query
 * builder types are the best fit for our hand-written migrations.
 *
 * `pg` is an optional peer dependency: this factory is only imported when a real
 * database is wired up. The MVP and tests use the in-memory repository instead.
 */
export interface CreateDbOptions {
  connectionString: string;
  /** Pass a `pg.Pool` instance. Kept loose so `pg` stays an optional peer dep. */
  pool: unknown;
}

export function createDbClient(opts: CreateDbOptions): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pool: opts.pool as any,
    }),
  });
}

/** The Postgres GUCs that drive RLS. Read by app_current_tenant_id()/app_bypass_rls(). */
export const TENANT_GUC = 'app.current_tenant_id';
export const BYPASS_GUC = 'app.bypass_rls';

export interface TenantContextStatement {
  key: string;
  value: string;
  /** `true` => `set_config(..., is_local := true)`, i.e. SET LOCAL (transaction-scoped). */
  local: boolean;
}

/**
 * Pure description of the connection context a tenant-scoped transaction applies.
 *
 * INVARIANT (no cross-request leakage): every statement is `local: true`. Because
 * `SET LOCAL` is transaction-scoped, the GUC is automatically reset when the
 * transaction COMMITs/ROLLBACKs — *before* the pooled connection is returned to
 * the pool. We never issue a session-level `set_config(..., false)` or `SET`, so
 * one request's tenant context can never bleed into the next checkout of the same
 * pooled connection. This function exists so that invariant is unit-testable
 * without a live database (see client.test.ts).
 */
export function tenantContextPlan(
  tenantId: string,
  opts: { bypassRls?: boolean } = {},
): TenantContextStatement[] {
  const plan: TenantContextStatement[] = [{ key: TENANT_GUC, value: tenantId, local: true }];
  if (opts.bypassRls) {
    plan.push({ key: BYPASS_GUC, value: 'on', local: true });
  }
  return plan;
}

/**
 * Run `fn` inside a transaction scoped to a tenant. Applies the (transaction-local)
 * context GUCs that every RLS policy reads, so no query in `fn` can escape the
 * tenant and nothing leaks to the next pooled connection.
 *
 * Trusted system jobs may pass `bypassRls: true` (logged elsewhere); request
 * handlers must never do this.
 */
export async function withTenant<T>(
  db: Kysely<Database>,
  tenantId: string,
  fn: (trx: Kysely<Database>) => Promise<T>,
  opts: { bypassRls?: boolean } = {},
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    for (const stmt of tenantContextPlan(tenantId, opts)) {
      // is_local = true => SET LOCAL: reset automatically at COMMIT/ROLLBACK.
      await sql`select set_config(${stmt.key}, ${stmt.value}, ${stmt.local})`.execute(trx);
    }
    return fn(trx);
  });
}
