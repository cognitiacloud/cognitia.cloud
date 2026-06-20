import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Append-only audit trail. No updates/deletes (enforced at the app layer and,
 * in production, via an RLS policy + revoked UPDATE/DELETE grants).
 * Intentionally omits `updated_at` since rows are immutable.
 */
export const complianceLogs = pgTable(
  'compliance_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    action: text('action').notNull(),
    actor: text('actor').notNull(),
    lawfulBasis: text('lawful_basis'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    ip: text('ip'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('compliance_logs_entity_idx').on(t.entityType, t.entityId),
    index('compliance_logs_action_idx').on(t.action),
  ],
);

export type ComplianceLog = typeof complianceLogs.$inferSelect;
export type NewComplianceLog = typeof complianceLogs.$inferInsert;
