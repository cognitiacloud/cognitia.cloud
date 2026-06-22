import type { ApprovalQueue } from '../approval/approvalQueue.js';
import type { AppendOnlyLedger } from '../ledger/actionLedger.js';
import { PiiViolationError, scanForRawPii } from '../pii/piiSafety.js';
import type { RuntimeEnv, TenantId } from '../types.js';

/**
 * Mock CRM writeback adapter — in-process only, never a network/SDK call.
 *
 * Guarantees:
 *   - approval-guarded: refuses (and ledgers a blocked action) unless the run
 *     has a human approval on record — closing the approval-to-send loophole
 *     even when called directly;
 *   - idempotent: keyed by `externalKey`, a repeat upsert returns the same
 *     `crmId` with `created: false` and writes no duplicate;
 *   - PII-free: refuses any field value resembling raw PII.
 *
 * (Salvages the idempotent-mock-CRM idea noted for the parked #124, reimplemented
 *  cleanly in this isolated lane.)
 */

export class ApprovalRequiredError extends Error {
  constructor(action: string) {
    super(`${action} requires a human approval on record for this run`);
    this.name = 'ApprovalRequiredError';
  }
}

export interface CrmUpsertInput {
  runId: string;
  tenantId: TenantId;
  /** Stable, PII-free external key, e.g. `budget_wheels_demo:lead_bw_001`. */
  externalKey: string;
  /** PII-free attributes only (refs/hashes/non-contact fields). */
  fields: Record<string, unknown>;
}

export interface CrmRecord {
  crmId: string;
  externalKey: string;
  tenantId: TenantId;
  fields: Record<string, unknown>;
  createdAt: string;
}

export interface CrmUpsertResult {
  crmId: string;
  created: boolean;
  idempotentReplay: boolean;
}

export class MockCrmAdapter {
  private readonly store = new Map<string, CrmRecord>();

  constructor(
    private readonly env: RuntimeEnv,
    private readonly ledger: AppendOnlyLedger,
    private readonly approvals: ApprovalQueue,
  ) {}

  upsert(input: CrmUpsertInput): CrmUpsertResult {
    if (!this.approvals.isApproved(input.runId)) {
      this.ledger.append({
        runId: input.runId,
        tenantId: input.tenantId,
        kind: 'action.blocked',
        summary: 'mock CRM writeback blocked: approval required',
        detail: {
          action: 'crm.upsert',
          reason: 'approval_required',
          externalKey: input.externalKey,
        },
      });
      throw new ApprovalRequiredError('mock CRM writeback');
    }

    const violations = scanForRawPii(input.fields);
    if (violations.length > 0) throw new PiiViolationError(violations);

    const existing = this.store.get(input.externalKey);
    if (existing) {
      this.ledger.append({
        runId: input.runId,
        tenantId: input.tenantId,
        kind: 'crm.idempotent_replay',
        summary: 'mock CRM writeback collapsed by idempotency',
        detail: { crmId: existing.crmId, externalKey: input.externalKey },
      });
      return { crmId: existing.crmId, created: false, idempotentReplay: true };
    }

    const crmId = this.env.id('crm');
    const record: CrmRecord = {
      crmId,
      externalKey: input.externalKey,
      tenantId: input.tenantId,
      fields: input.fields,
      createdAt: this.env.now(),
    };
    this.store.set(input.externalKey, record);
    this.ledger.append({
      runId: input.runId,
      tenantId: input.tenantId,
      kind: 'crm.upserted',
      summary: 'mock CRM record upserted',
      detail: { crmId, externalKey: input.externalKey, fieldKeys: Object.keys(input.fields) },
    });
    return { crmId, created: true, idempotentReplay: false };
  }

  get(externalKey: string): CrmRecord | null {
    const record = this.store.get(externalKey);
    return record ? { ...record } : null;
  }

  count(): number {
    return this.store.size;
  }
}
