import { z } from 'zod';

/** UUID identity used everywhere. */
export const uuid = z.string().uuid();

/** ISO-8601 timestamp string. */
export const isoTimestamp = z.string().datetime({ offset: true });

/** Entity reference like "account:uuid". */
export const entityRef = z
  .string()
  .regex(/^[a-z_]+:[0-9a-fA-F-]{36}$/, 'entity_ref must look like "type:uuid"');

/**
 * Tenant scoping. Every tenant-bound schema composes this so `tenant_id` is a
 * hard requirement — there is no implicit/global fallback.
 */
export const tenantScoped = z.object({
  tenant_id: uuid,
});

/** Timestamps present on every persisted row. */
export const timestamps = z.object({
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
});

export const riskLevel = z.enum(['none', 'low', 'medium', 'high']);
export const approvalStatus = z.enum(['proposed', 'approved', 'rejected']);
// 'rolled_back' (UNDO-1): an executed write that was explicitly undone.
export const executionStatus = z.enum([
  'pending',
  'executing',
  'executed',
  'failed',
  'rolled_back',
]);
export const agentRunStatus = z.enum(['pending', 'running', 'completed', 'failed']);

export type TenantScoped = z.infer<typeof tenantScoped>;
export type Timestamps = z.infer<typeof timestamps>;
