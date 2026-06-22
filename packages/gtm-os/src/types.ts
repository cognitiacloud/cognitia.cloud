/**
 * Proof-Governed GTM OS v0 — core domain types (mock-only).
 *
 * These types intentionally encode the guardrails. For example, {@link Channel}
 * only ever names mock channels: there is deliberately no `email` / `sms` /
 * `call` / `whatsapp` / `linkedin` channel anywhere in the type system, so a
 * live outreach action is unrepresentable, not merely discouraged.
 */

/** The only tenants that exist in v0. All are internal / demo, all mock-mode. */
export type TenantId = 'demandara_internal' | 'cognitia_internal' | 'budget_wheels_demo';

/**
 * The only channels that exist. Both are inert, in-process mocks. No live
 * outreach channel is representable.
 */
export type Channel = 'mock_appointment' | 'mock_crm';

export interface Tenant {
  id: TenantId;
  displayName: string;
  /** Always true in v0 — no external orgs. */
  internal: boolean;
  /** Always 'mock' in v0 — no live mode exists. */
  mode: 'mock';
  active: boolean;
  permittedChannels: Channel[];
}

/** Mock consent record attached to a fixture lead. */
export interface Consent {
  /** Whether the (fictional) person consented to be contacted. */
  contact: boolean;
  /** ISO timestamp the consent was (notionally) granted. */
  grantedAt: string;
  basis: 'explicit_optin' | 'existing_relationship';
  /** A previously-granted consent that has since been withdrawn. */
  revoked: boolean;
}

/**
 * A PII-safe fixture lead. Real prospect data never enters the system: emails
 * must be on the reserved `.example` TLD and phones must be reserved fictional
 * NANP `555-01xx` numbers (enforced by {@link assertLeadPiiSafe}).
 */
export interface FixtureLead {
  id: string;
  tenantId: TenantId;
  /** Fictional display name. */
  displayName: string;
  /** Must match the safe `.example` form. */
  email: string;
  /** Must match the reserved `555-01xx` fictional form. */
  phone: string;
  consent: Consent;
  /** On the mock do-not-contact / suppression list. */
  suppressed: boolean;
  /** Provenance label, e.g. `fixture:webform`. Never a real source. */
  source: string;
}

/** Lifecycle states of a single GTM run. */
export type RunState =
  | 'lead_received'
  | 'compliance_evaluated'
  | 'awaiting_approval'
  | 'approved'
  | 'appointment_booked'
  | 'crm_written'
  | 'completed'
  | 'blocked'
  | 'rejected';

/** States from which no further transition is permitted. */
export const TERMINAL_STATES = ['completed', 'blocked', 'rejected'] as const;

/** Consequential states — reaching these requires a human approval on record. */
export const CONSEQUENTIAL_STATES = ['appointment_booked', 'crm_written'] as const;

export type ComplianceCheckName =
  | 'tenant_active'
  | 'pii_safe'
  | 'consent_present'
  | 'consent_not_revoked'
  | 'not_suppressed'
  | 'channel_permitted';

export interface ComplianceCheck {
  name: ComplianceCheckName;
  passed: boolean;
  detail: string;
}

export interface ComplianceDecision {
  allowed: boolean;
  /** Machine-readable blocked reasons; empty when `allowed` is true. */
  reasons: string[];
  checks: ComplianceCheck[];
}

export type ApprovalOutcome = 'approved' | 'rejected';

export interface ApprovalRequest {
  id: string;
  runId: string;
  tenantId: TenantId;
  /** The consequential action gated by this approval. */
  action: string;
  summary: string;
  status: 'pending' | ApprovalOutcome;
  requestedAt: string;
  decidedAt: string | null;
  /** Identifier of the human operator who decided. Null while pending. */
  approver: string | null;
  note: string | null;
}

/** Kinds of entries that may appear in the append-only action ledger. */
export type LedgerKind =
  | 'run.created'
  | 'run.transition'
  | 'compliance.decision'
  | 'approval.requested'
  | 'approval.granted'
  | 'approval.rejected'
  | 'appointment.booked'
  | 'appointment.idempotent_replay'
  | 'crm.upserted'
  | 'crm.idempotent_replay'
  | 'action.blocked'
  | 'proof.receipt'
  | 'proof.report';

/**
 * An immutable, hash-chained ledger entry. `hash` covers all other fields plus
 * `prevHash`, so any tampering breaks the chain (see {@link verifyLedger}).
 */
export interface LedgerEvent {
  seq: number;
  at: string;
  runId: string;
  tenantId: TenantId;
  kind: LedgerKind;
  summary: string;
  detail: Record<string, unknown>;
  prevHash: string | null;
  hash: string;
}

export type ProofDecision = 'allowed' | 'blocked' | 'approved' | 'rejected' | 'executed' | 'noop';

/**
 * A proof receipt is emitted on every run transition. Receipts form their own
 * hash chain (`prevReceiptHash` -> `receiptHash`) and each one attests the
 * ledger event (`eventHash`) that recorded the transition.
 */
export interface ProofReceipt {
  receiptId: string;
  runId: string;
  tenantId: TenantId;
  /** Monotonic per-run receipt index, starting at 0. */
  seq: number;
  fromState: RunState | null;
  toState: RunState;
  decision: ProofDecision;
  reasons: string[];
  eventHash: string;
  prevReceiptHash: string | null;
  receiptHash: string;
  at: string;
}

/** Injectable clock + id source, so runs are deterministic in tests/demos. */
export interface RuntimeEnv {
  now: () => string;
  id: (prefix: string) => string;
}
