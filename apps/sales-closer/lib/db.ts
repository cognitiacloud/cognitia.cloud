import { getDb, type Database } from '@cognitia/db';

/** Process-wide Drizzle client for the app runtime. */
export function db(): Database {
  return getDb();
}
