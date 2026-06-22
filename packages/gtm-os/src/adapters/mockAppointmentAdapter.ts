import type { ApprovalQueue } from '../approval/approvalQueue.js';
import type { AppendOnlyLedger } from '../ledger/actionLedger.js';
import { PiiViolationError, scanForRawPii } from '../pii/piiSafety.js';
import type { RuntimeEnv, TenantId } from '../types.js';
import { ApprovalRequiredError } from './mockCrmAdapter.js';

/**
 * Mock appointment adapter — in-process only, never a real calendar/SDK call.
 * Same guarantees as the CRM adapter: approval-guarded, idempotent (one booking
 * per run), and PII-free. Re-booking a run returns the same `appointmentId`.
 */

export interface AppointmentInput {
  runId: string;
  tenantId: TenantId;
  /** ISO start time of the (mock) slot. */
  slotIso: string;
  /** PII-free prospect reference, e.g. `lead:lead_bw_001`. Never raw contact data. */
  prospectRef: string;
}

export interface AppointmentRecord {
  appointmentId: string;
  runId: string;
  tenantId: TenantId;
  slotIso: string;
  prospectRef: string;
  createdAt: string;
}

export interface AppointmentResult {
  appointmentId: string;
  created: boolean;
  idempotentReplay: boolean;
}

export class MockAppointmentAdapter {
  /** Keyed by runId — at most one mock appointment per run. */
  private readonly store = new Map<string, AppointmentRecord>();

  constructor(
    private readonly env: RuntimeEnv,
    private readonly ledger: AppendOnlyLedger,
    private readonly approvals: ApprovalQueue,
  ) {}

  book(input: AppointmentInput): AppointmentResult {
    if (!this.approvals.isApproved(input.runId)) {
      this.ledger.append({
        runId: input.runId,
        tenantId: input.tenantId,
        kind: 'action.blocked',
        summary: 'mock appointment booking blocked: approval required',
        detail: {
          action: 'appointment.book',
          reason: 'approval_required',
          prospectRef: input.prospectRef,
        },
      });
      throw new ApprovalRequiredError('mock appointment booking');
    }

    const violations = scanForRawPii({ prospectRef: input.prospectRef, slotIso: input.slotIso });
    if (violations.length > 0) throw new PiiViolationError(violations);

    const existing = this.store.get(input.runId);
    if (existing) {
      this.ledger.append({
        runId: input.runId,
        tenantId: input.tenantId,
        kind: 'appointment.idempotent_replay',
        summary: 'mock appointment booking collapsed by idempotency',
        detail: { appointmentId: existing.appointmentId },
      });
      return { appointmentId: existing.appointmentId, created: false, idempotentReplay: true };
    }

    const appointmentId = this.env.id('appt');
    const record: AppointmentRecord = {
      appointmentId,
      runId: input.runId,
      tenantId: input.tenantId,
      slotIso: input.slotIso,
      prospectRef: input.prospectRef,
      createdAt: this.env.now(),
    };
    this.store.set(input.runId, record);
    this.ledger.append({
      runId: input.runId,
      tenantId: input.tenantId,
      kind: 'appointment.booked',
      summary: 'mock appointment booked',
      detail: { appointmentId, slotIso: input.slotIso, prospectRef: input.prospectRef },
    });
    return { appointmentId, created: true, idempotentReplay: false };
  }

  forRun(runId: string): AppointmentRecord | null {
    const record = this.store.get(runId);
    return record ? { ...record } : null;
  }

  count(): number {
    return this.store.size;
  }
}
