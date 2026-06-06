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

/**
 * Run `fn` inside a transaction scoped to a tenant. Sets the per-transaction
 * GUC that every RLS policy reads, so no query in `fn` can escape the tenant.
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
    await sql`select set_config('app.current_tenant_id', ${tenantId}, true)`.execute(trx);
    if (opts.bypassRls) {
      await sql`select set_config('app.bypass_rls', 'on', true)`.execute(trx);
    }
    return fn(trx);
  });
}
