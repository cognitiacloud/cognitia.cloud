import type { Database } from '@cognitia/db';
import { complianceLogs } from '@cognitia/db';

export interface ComplianceEntry {
  entityType: string;
  entityId?: string | null;
  action: string;
  actor: string;
  lawfulBasis?: string;
  details?: unknown;
  ip?: string;
}

/** Append an immutable audit record. Used by every state-changing route. */
export async function logCompliance(db: Database, entry: ComplianceEntry): Promise<void> {
  await db.insert(complianceLogs).values({
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    action: entry.action,
    actor: entry.actor,
    lawfulBasis: entry.lawfulBasis,
    details: (entry.details ?? {}) as Record<string, unknown>,
    ip: entry.ip,
  });
}
