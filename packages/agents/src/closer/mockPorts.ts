import type {
  AppointmentResult,
  ApprovalResult,
  CloserPorts,
  ComplianceCheckResult,
  CrmWritebackResult,
  ProofRecordResult,
} from './ports.js';

/**
 * In-memory mock implementations of every Sales Closer boundary.
 *
 * These make the workflow runnable fully offline with zero IO — no network, no
 * DB, no vendor calls. Defaults follow the happy path; pass `overrides` to drive
 * blocked/rejected/pending/failed branches in tests or demos. This is a fake
 * behind the real port interface (the same pattern as the platform's stub CRM
 * client), not a success shortcut baked into the workflow.
 */
export interface MockPortOverrides {
  compliance?: ComplianceCheckResult;
  approval?: ApprovalResult;
  appointment?: AppointmentResult;
  crm?: CrmWritebackResult;
  proof?: ProofRecordResult;
}

export function createMockCloserPorts(overrides: MockPortOverrides = {}): CloserPorts {
  return {
    compliance: {
      check: async () => overrides.compliance ?? { status: 'pass' },
    },
    approval: {
      requestApproval: async () =>
        overrides.approval ?? { status: 'approved', approvalRef: 'mock-approval' },
    },
    appointment: {
      requestAppointment: async () =>
        overrides.appointment ?? { status: 'requested', appointmentRef: 'mock-appointment' },
    },
    crm: {
      writeback: async () => overrides.crm ?? { status: 'ok', recordRef: 'mock-crm-record' },
    },
    proof: {
      record: async () => overrides.proof ?? { status: 'ok' },
    },
  };
}
