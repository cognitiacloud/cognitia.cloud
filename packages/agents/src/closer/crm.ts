/**
 * Mock CRM writeback for the Sales Closer workflow.
 *
 * In-memory only — no network, no vendor SDK. The writeback is idempotent: the
 * same lead (tenant + leadRef + company) maps to a single deterministic record
 * via the platform `idempotencyKey`, so replaying a run never creates a
 * duplicate. Swap this for a real CRM adapter (e.g. HubSpot) behind the same
 * `MockCloserCrm` port when wiring live integrations.
 */

import { contentFingerprint, idempotencyKey } from '@cognitia/core';
import type {
  CloserCrmRecord,
  CloserCrmWriteInput,
  CloserCrmWriteResult,
  MockCloserCrm,
} from './types.js';

const CRM_ACTION_TYPE = 'crm.closer.writeback';

/** Deterministic key identifying one CRM record per lead. */
export function closerCrmIdempotencyKey(input: CloserCrmWriteInput): string {
  return idempotencyKey({
    tenant_id: input.tenantId,
    action_type: CRM_ACTION_TYPE,
    target_ref: input.leadRef,
    content_fingerprint: contentFingerprint(
      `${input.tenantId}|${input.leadRef}|${input.companyName}`,
    ),
  });
}

/** In-memory, idempotent, network-free mock CRM. */
export class InMemoryCloserCrm implements MockCloserCrm {
  private readonly byKey = new Map<string, CloserCrmRecord>();
  private readonly now: () => Date;

  constructor(opts: { now?: () => Date } = {}) {
    this.now = opts.now ?? (() => new Date());
  }

  writeBack(input: CloserCrmWriteInput): CloserCrmWriteResult {
    const key = closerCrmIdempotencyKey(input);
    const existing = this.byKey.get(key);
    if (existing) {
      return { record: existing, created: false };
    }
    const record: CloserCrmRecord = {
      externalId: `crm_${key.slice(0, 16)}`,
      idempotencyKey: key,
      tenantId: input.tenantId,
      leadRef: input.leadRef,
      companyName: input.companyName,
      contactDomain: input.contactDomain,
      appointmentRef: input.appointmentRef,
      slotStart: input.slotStart,
      createdAt: this.now().toISOString(),
    };
    this.byKey.set(key, record);
    return { record, created: true };
  }

  records(): CloserCrmRecord[] {
    return [...this.byKey.values()];
  }

  get(key: string): CloserCrmRecord | undefined {
    return this.byKey.get(key);
  }
}
