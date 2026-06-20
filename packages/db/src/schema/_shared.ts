import { timestamp, uuid } from 'drizzle-orm/pg-core';

/** Columns every table shares: uuid pk + created/updated timestamps. */
export const baseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};
