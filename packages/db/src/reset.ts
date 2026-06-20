import { createDb } from './client';
import { runMigrations } from './migrate';
import { seed } from './seed';

/** Drop the public schema, re-run migrations, and reseed. Local dev only. */
async function reset(): Promise<void> {
  const { sql } = createDb();
  console.log('Dropping public schema…');
  await sql.unsafe(
    'DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
  );
  await sql.end();

  console.log('Re-running migrations…');
  await runMigrations();

  console.log('Seeding…');
  await seed();
}

reset()
  .then(() => {
    console.log('Reset complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
