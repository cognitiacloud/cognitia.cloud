#!/usr/bin/env node
/**
 * Apply SQL migrations in order against DATABASE_URL, tracked in a
 * `schema_migrations` ledger so the runner is idempotent and safe to call
 * from a deploy pipeline.
 *
 * Local usage:
 *   1. Start Supabase/Postgres and export DATABASE_URL.
 *   2. `node packages/db/scripts/apply-migrations.mjs` (or `pnpm --filter @cognitia/db migrate`).
 *
 * Already-applied files (by name) are skipped. For a database that predates the
 * ledger — schema present but `schema_migrations` empty — run once with
 * `--baseline` to record every current file as applied without executing it.
 *
 * Requires `pg` (optional peer dep): `pnpm add -w pg`. Each migration runs in
 * its own transaction, in filename order.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');
const baseline = process.argv.includes('--baseline');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Aborting.');
    process.exit(1);
  }

  let pg;
  try {
    pg = await import('pg');
  } catch {
    console.error('The `pg` package is required. Install it with: pnpm add -w pg');
    process.exit(1);
  }

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  const client = new pg.default.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(
      'create table if not exists schema_migrations (filename text primary key, applied_at timestamptz not null default now())',
    );
    const { rows } = await client.query('select filename from schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip ${file} (already applied)`);
        continue;
      }
      if (baseline) {
        await client.query('insert into schema_migrations (filename) values ($1)', [file]);
        console.log(`baseline ${file} (recorded, not executed)`);
        continue;
      }
      const sql = await readFile(join(migrationsDir, file), 'utf8');
      process.stdout.write(`applying ${file} ... `);
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (filename) values ($1)', [file]);
        await client.query('commit');
        console.log('ok');
      } catch (err) {
        await client.query('rollback');
        console.log('failed');
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
