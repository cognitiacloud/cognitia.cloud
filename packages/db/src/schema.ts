/**
 * Kysely table typings mirroring packages/db/migrations. This is the typed
 * surface the production client uses. snake_case columns to match Postgres.
 *
 * Only the tables the MVP touches are typed in detail; the rest are added as
 * features land. Keep in sync with the SQL migrations (source of truth).
 */

export interface TenantsTable {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IntegrationConnectionsTable {
  id: string;
  tenant_id: string;
  external_system: string;
  status: string;
  /** Reference to the encrypted credential in the secret store; never a raw token. */
  credential_ref: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AccountsTable {
  id: string;
  tenant_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employee_count: number | null;
  region: string | null;
  fit_score: number | null;
  timing_score: number | null;
  attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ContactsTable {
  id: string;
  tenant_id: string;
  account_id: string | null;
  full_name: string | null;
  title: string | null;
  persona: string | null;
  email_hash: string | null;
  phone_hash: string | null;
  is_suppressed: boolean;
  attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EventsTable {
  id: string;
  tenant_id: string;
  event_name: string;
  entity_type: string;
  entity_id: string;
  source: string;
  occurred_at: string;
  ingested_at: string;
  payload: Record<string, unknown>;
  trace_id: string;
  created_at: string;
}

export interface AgentRunsTable {
  id: string;
  tenant_id: string;
  agent: string;
  objective: string;
  input_refs: string[];
  status: string;
  trace_id: string;
  created_at: string;
  updated_at: string;
}

export interface AgentActionsTable {
  id: string;
  tenant_id: string;
  agent_run_id: string;
  action_type: string;
  risk_level: string;
  idempotency_key: string;
  approval_status: string;
  execution_status: string;
  target_ref: string;
  evidence_refs: string[];
  payload_ref: string | null;
  guardrail_results: Array<{ name: string; passed: boolean; detail?: string }>;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEventsTable {
  id: string;
  tenant_id: string;
  actor_ref: string;
  action: string;
  subject_ref: string;
  detail: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
  /** Tamper-evident chain (0009): hash of the predecessor event ('genesis' for
   * the first). Filled by the repository on insert — never by callers. */
  prev_hash: string | null;
  /** sha256 over this event's content + prev_hash (see auditChain.ts). */
  hash: string | null;
}

export interface ExternalObjectMapsTable {
  id: string;
  tenant_id: string;
  connection_id: string | null;
  external_system: string;
  external_type: string;
  external_id: string;
  internal_type: string;
  internal_id: string;
  created_at: string;
  updated_at: string;
}

export interface OpportunitiesTable {
  id: string;
  tenant_id: string;
  account_id: string;
  name: string;
  stage: string;
  amount: number | null;
  owner_ref: string | null;
  attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SyncRunsTable {
  id: string;
  tenant_id: string;
  connection_id: string | null;
  status: string; // pending | running | completed | failed
  started_at: string | null;
  finished_at: string | null;
  stats: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FeedbackLabelsTable {
  id: string;
  tenant_id: string;
  subject_ref: string;
  label: string;
  detail: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CredentialCiphertextsTable {
  ref: string;
  ciphertext: string;
  created_at: string;
  updated_at: string;
}

/**
 * PASS-1 — agent passport: the explicit, revocable identity a non-human actor
 * executes under. One passport per agent per tenant; execution authorizes
 * against the passport's live scope grants, never against the bare agent name.
 */
export interface AgentPassportsTable {
  id: string;
  tenant_id: string;
  /** The agent this passport identifies (e.g. 'mira'). Unique per tenant. */
  agent_id: string;
  /** Tenant owner who issued the passport (verified user ref). */
  owner_ref: string;
  status: 'active' | 'revoked' | 'suspended';
  /** Placeholder for future cryptographic key binding; never a raw secret. */
  key_ref: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * PASS-1 — scope grant: a narrow, expiring, owner-approved permission for one
 * (action_type, integration) pair up to a maximum risk tier. Execution
 * requires a live matching grant; revocation/expiry fail closed.
 */
export interface ScopeGrantsTable {
  id: string;
  tenant_id: string;
  passport_id: string;
  action_type: string;
  integration: string;
  /** Highest risk tier this grant authorizes ('none'|'low'|'medium'|'high'). */
  risk_max: string;
  status: 'active' | 'revoked';
  /** Owner who approved the grant (verified user ref) — never the agent. */
  approved_by: string;
  approved_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
  updated_at: string;
}

/** The full Kysely database interface. Extend as more tables are used in code. */
export interface Database {
  tenants: TenantsTable;
  integration_connections: IntegrationConnectionsTable;
  accounts: AccountsTable;
  contacts: ContactsTable;
  opportunities: OpportunitiesTable;
  events: EventsTable;
  agent_runs: AgentRunsTable;
  agent_actions: AgentActionsTable;
  audit_events: AuditEventsTable;
  external_object_maps: ExternalObjectMapsTable;
  sync_runs: SyncRunsTable;
  credential_ciphertexts: CredentialCiphertextsTable;
  feedback_labels: FeedbackLabelsTable;
  agent_passports: AgentPassportsTable;
  scope_grants: ScopeGrantsTable;
}
