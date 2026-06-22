/**
 * Proof-Governed GTM OS v0 — mock-only substrate.
 *
 * Authorized flow:
 *   lead in -> consent/compliance gate -> human approval -> mock appointment
 *   + mock CRM writeback -> proof receipt / report
 *
 * Everything here is in-process and inert: no live outreach, no real CRM /
 * calendar / vendor SDK / network writeback, and no raw PII. See docs/gtm-os.
 */
export * from './types.js';
export * from './ids.js';
export * from './hashing.js';
export * from './pii/piiSafety.js';
export * from './ledger/actionLedger.js';
export * from './compliance/complianceGate.js';
export * from './approval/approvalQueue.js';
export * from './adapters/mockCrmAdapter.js';
export * from './adapters/mockAppointmentAdapter.js';
export * from './stateMachine/runStateMachine.js';
export * from './proof/proofReceipt.js';
export * from './proof/proofReport.js';
export * from './engine/gtmRunEngine.js';
export * from './tenants/registry.js';
export * from './fixtures/leads.js';
export * from './ownership/manifest.js';
