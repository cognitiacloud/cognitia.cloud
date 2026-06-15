#!/usr/bin/env node
/**
 * Apply SQL migrations in order against DATABASE_URL.
 *
 * Local usage:
 *   1. Start Supabase/Postgres and export DATABASE_URL.
 *   2. `node packages/db/scripts/apply-migrations.mjs` (or `pnpm --filter @cognitia/db migrate`).
 *
 * Requires `pg` (optional peer dep): `pnpm add -w pg`. Migrations are applied in
 * a single transaction each, in filename order. This is intentionally minimal —
 * Supabase CLI (`supabase db push`) is the recommended path for hosted projects.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

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
    for (const file of files) {
      const sql = await readFile(join(migrationsDir, file), 'utf8');
      process.stdout.write(`applying ${file} ... `);
      await client.query('begin');
      try {
        await client.query(sql);
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
