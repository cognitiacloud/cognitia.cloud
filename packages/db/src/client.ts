import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@cognitia/config';
import * as schema from './schema/index';

export type Database = ReturnType<typeof createDb>['db'];

/** Create a Drizzle client + the underlying postgres connection. */
export function createDb(connectionString: string = env.DATABASE_URL) {
  const sql = postgres(connectionString, { max: 10 });
  const db = drizzle(sql, { schema, casing: 'snake_case' });
  return { db, sql };
}

let singleton: Database | undefined;

/** Shared process-wide client for the app runtime. */
export function getDb(): Database {
  if (!singleton) singleton = createDb().db;
  return singleton;
}
