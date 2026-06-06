/**
 * Shared primitive types. PascalCase per naming conventions; IDs are UUIDs.
 * These are intentionally light — runtime validation lives in `../schemas`.
 */

export type Uuid = string;
export type IsoTimestamp = string;

/** A reference to an entity, e.g. "account:uuid" or "contact:uuid". */
export type EntityRef = `${string}:${string}`;

/** Risk levels drive the PolicyGate approval decision. */
export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

/** Lifecycle of an agent run. */
export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Human approval lifecycle of a proposed side-effect action. */
export type ApprovalStatus = 'proposed' | 'approved' | 'rejected';

/** Execution lifecycle of an approved side-effect action. */
export type ExecutionStatus = 'pending' | 'executing' | 'executed' | 'failed';

/** Event domains in the taxonomy `domain.entity.action.vN`. */
export type EventDomain =
  | 'crm'
  | 'outbound'
  | 'agent'
  | 'signal'
  | 'eval'
  | 'integration'
  | 'inbound'
  | 'calendar'
  | 'system';

/** Reply classification labels (Mira v1). */
export type ReplyClass =
  | 'interested'
  | 'not_interested'
  | 'unsubscribe'
  | 'wrong_person'
  | 'out_of_office'
  | 'referral'
  | 'other';
