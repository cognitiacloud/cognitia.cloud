import type { Kysely } from 'kysely';
import type { Database } from './schema.js';
import { createDbClient } from './client.js';
import { KyselyRepository } from './kysely.js';

/**
 * Build a production Repository backed by Postgres (Supabase). Lazy-imports `pg`
 * (an optional peer dep) so packages that only need the in-memory repo don't pull
 * it in. Sets the `numeric` (OID 1700) parser to Number so columns like
 * `amount`/`fit_score` come back as numbers, matching our row types.
 *
 *   const { repo } = await createPostgresRepository(process.env.DATABASE_URL!);
 *   const sync = new HubspotSyncService(repo, hubspotClient);
 */
export interface PostgresRepository {
  repo: KyselyRepository;
  db: Kysely<Database>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pool: any;
  close(): Promise<void>;
}

export async function createPostgresRepository(
  connectionString: string,
): Promise<PostgresRepository> {
  // `pg` types aren't installed (optional peer dep); keep this loosely typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pg: any;
  try {
    pg = await import('pg' as string);
  } catch {
    throw new Error('createPostgresRepository requires the `pg` package: pnpm add -w pg');
  }
  // Some bundlers wrap CJS default exports.
  pg = pg.default ?? pg;
  // Parse numeric/decimal as JS number (default is string) to match row types.
  pg.types.setTypeParser(1700, (v: string) => (v === null ? null : Number(v)));

  const pool = new pg.Pool({ connectionString });
  const db = createDbClient({ connectionString, pool });
  return {
    repo: new KyselyRepository(db),
    db,
    pool,
    async close() {
      await db.destroy();
    },
  };
}
