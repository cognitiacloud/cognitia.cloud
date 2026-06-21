import type { GtmProofEvent, GtmProspect } from '@cognitia/core';

/**
 * Integration boundaries for the Sales Closer workflow core.
 *
 * Each port is a contract that a later lane implements for real (a compliance
 * service, an approval queue, a scheduler, a CRM, a proof ledger). The workflow
 * core depends ONLY on these interfaces — never on a concrete vendor — so it
 * stays offline and mock-safe. A port returning a non-success status is a real
 * outcome the state machine must handle explicitly; it is NOT a shortcut to fake
 * success. Ports are async because real implementations cross a process/network
 * boundary; the mock implementations (see `mockPorts.ts`) resolve in-memory with
 * no IO.
 */

/** Result of the compliance integration boundary. */
export interface ComplianceCheckResult {
  status: 'pass' | 'blocked';
  /** Human-readable reason; expected when blocked. */
  reason?: string;
}

/** Request to the human-approval boundary. Carries no raw PII. */
export interface ApprovalRequest {
  prospectId: string;
  summary: string;
  /** Why review is needed (e.g. elevated-review vs standard gate). */
  reason?: string;
}

export interface ApprovalResult {
  status: 'approved' | 'rejected' | 'pending';
  reason?: string;
  /** Reference to the approval record (e.g. an agent_action id) when known. */
  approvalRef?: string;
}

export interface AppointmentRequest {
  prospectId: string;
}

export interface AppointmentResult {
  status: 'requested' | 'failed';
  /** Reference to the booking/appointment request when known. */
  appointmentRef?: string;
  reason?: string;
}

export interface CrmWritebackRequest {
  prospectId: string;
  appointmentRef?: string;
}

export interface CrmWritebackResult {
  status: 'ok' | 'failed';
  /** Reference to the (mock) CRM record written. */
  recordRef?: string;
  reason?: string;
}

export interface ProofRecordResult {
  status: 'ok' | 'failed';
  reason?: string;
}

/** Compliance check boundary (consent / suppression / legal review). */
export interface CompliancePort {
  check(prospect: GtmProspect): Promise<ComplianceCheckResult>;
}

/** Human-approval boundary. There is no autonomous send path. */
export interface ApprovalPort {
  requestApproval(request: ApprovalRequest): Promise<ApprovalResult>;
}

/** Appointment-request boundary (scheduler / calendar). */
export interface AppointmentPort {
  requestAppointment(request: AppointmentRequest): Promise<AppointmentResult>;
}

/** CRM writeback boundary. In this slice the writeback is always a mock. */
export interface CrmPort {
  writeback(request: CrmWritebackRequest): Promise<CrmWritebackResult>;
}

/** Append-only proof-recording boundary. */
export interface ProofPort {
  record(event: GtmProofEvent): Promise<ProofRecordResult>;
}

/** The full set of boundaries the workflow depends on. */
export interface CloserPorts {
  compliance: CompliancePort;
  approval: ApprovalPort;
  appointment: AppointmentPort;
  crm: CrmPort;
  proof: ProofPort;
}
