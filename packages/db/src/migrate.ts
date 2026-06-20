import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDb } from './client';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Apply all generated SQL migrations to the configured database. */
export async function runMigrations(): Promise<void> {
  const { db, sql } = createDb();
  await migrate(db, { migrationsFolder: join(__dirname, '..', 'migrations') });
  await sql.end();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('Migrations applied.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
