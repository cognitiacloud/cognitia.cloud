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
  /**
   * Front-desk doctrine (0011): sms.% actions default to true via trigger.
   * Optional because these are nullable extension columns; pre-0011 action
   * types carry null (not applicable).
   */
  simulation?: boolean | null;
  proof_id?: string | null;
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

// ---------------------------------------------------------------------------
// Cognitia v1.1 trust layer (migrations 0009–0012). Doctrine lives in
// docs/cognitia/ARCHITECTURE_LOCK_V1_1.md; constraints are DB-enforced.
// ---------------------------------------------------------------------------

export type EvidenceTag = 'verified_fact' | 'likely_inference' | 'unknown';

export interface AgentsTable {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  /** Links to agent_runs.agent string identity (e.g. 'mira'). */
  runtime_key: string | null;
  kind: string; // front_desk | internal_ops | other
  status: string; // draft | active | suspended | retired
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentTrustCredentialsTable {
  id: string;
  tenant_id: string;
  agent_id: string;
  issuer: string;
  subject_ref: string;
  /** Scope/vertical/policy refs; never customer PII. */
  claims: Record<string, unknown>;
  status: string; // active | suspended | revoked (terminal) | expired
  issued_at: string;
  expires_at: string | null;
  /** Future ERC-8004 / EAS / existing-method DID ref. Never a custom DID. */
  external_ref: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AgentPermissionsTable {
  id: string;
  tenant_id: string;
  agent_id: string;
  action_key: string; // e.g. sms.draft | sms.send_real | lead.read
  effect: string; // allow | deny
  constraints: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProofsTable {
  id: string;
  tenant_id: string;
  kind: string; // lead_response | booking | skill_demo | revenue_outcome | system
  subject_type: string;
  subject_id: string;
  evidence_tag: EvidenceTag;
  evidence_ref: string | null;
  verifier_ref: string | null;
  summary_public: string | null;
  /** Never exposed through any public surface. */
  details_private: Record<string, unknown>;
  public_safe: boolean;
  redaction_check_passed_at: string | null;
  supersedes_proof_id: string | null;
  external_attestation_ref: string | null;
  created_at: string;
}

export interface SkillsTable {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  visibility: string; // locked to 'internal' in v1.1
  /** 0013: provenance */
  namespace: string;
  source_path: string | null;
  owner_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillVersionsTable {
  id: string;
  tenant_id: string;
  skill_id: string;
  version: string;
  spec: Record<string, unknown>;
  status: string; // draft | active | deprecated
  /** 0013: certification state */
  manifest_hash: string | null;
  content_hash: string | null;
  metadata: Record<string, unknown>; // x_cognitia_metadata
  /** 0–4; tier >= 2 requires a verified_fact proof (trigger + service). 3–4 unassignable in v1.1. */
  proof_tier: number;
  yanked: boolean;
  yank_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillProofsTable {
  id: string;
  tenant_id: string;
  skill_id: string;
  agent_id: string;
  proof_id: string;
  tier: string; // T0_claimed | T1_demonstrated | T2_verified | T3_economically_proven
  evidence_tag: EvidenceTag;
  created_at: string;
  updated_at: string;
}

export interface ReputationEventsTable {
  id: string;
  tenant_id: string;
  agent_id: string;
  proof_id: string;
  /** Positive delta requires a verified_fact proof (trigger-enforced). */
  delta: number;
  reason_code: string;
  created_at: string;
}

export interface ReputationSnapshotsTable {
  id: string;
  tenant_id: string;
  agent_id: string;
  score: number;
  computed_at: string;
  inputs_hash: string;
  created_at: string;
}

export interface LeadIntakesTable {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  source: string; // sms_sim | sms_real | web | manual
  channel_ref: string | null;
  /** App-layer encrypted; never plaintext PII. */
  contact_name_enc: string | null;
  contact_phone_enc: string | null;
  contact_phone_hash: string | null;
  message_body_enc: string | null;
  received_at: string;
  consent_captured: boolean;
  pii_status: string; // raw | redacted | purged
  /** 0013 lead lifecycle: new | needs_response | agent_action_proposed | human_review_required | contacted_simulated | callback_scheduled | booking_intent_created | booked | lost | purged */
  status: string;
  created_at: string;
  updated_at: string;
}

export interface LeadOutcomesTable {
  id: string;
  tenant_id: string;
  lead_intake_id: string;
  /** 0011 set + 0013 vocabulary: rescued_lead | booking_intent | booked_job | lost_lead | invalid_lead | human_handoff | unknown */
  outcome: string;
  response_time_ms: number | null;
  booking_value_cents: number | null;
  currency: string;
  evidence_tag: EvidenceTag;
  proof_id: string | null;
  /** 0013 */
  estimated_value_cents: number | null;
  evidence_source: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditsAccountsTable {
  id: string;
  tenant_id: string;
  owner_type: string; // tenant | agent | system
  owner_id: string;
  status: string; // active | frozen | closed
  created_at: string;
  updated_at: string;
}

export interface CreditsLedgerEntriesTable {
  id: string;
  tenant_id: string;
  account_id: string;
  counter_account_id: string;
  amount: number;
  direction: string; // debit | credit
  rail: string; // internal_credits only in v1.1 (check-enforced)
  reason_code: string;
  idempotency_key: string;
  created_at: string;
}

export interface WalletBindingsTable {
  id: string;
  tenant_id: string;
  owner_type: string; // tenant | agent
  owner_id: string;
  chain: string; // none | base | evm_other
  address: string | null;
  status: string; // placeholder | deactivated (0014); activation does not exist in v1.1
  created_at: string;
  updated_at: string;
}

/**
 * 0015 (COG-016): append-only field-level provenance for the canonical GTM
 * entities. Fully immutable post-insert; corrections supersede. entity_type
 * excludes lead_intake by design (intakes are workflow events, not canonical
 * leads).
 */
export interface FieldProvenanceTable {
  id: string;
  tenant_id: string;
  entity_type: string; // account | contact | opportunity
  entity_id: string;
  field_name: string;
  /** Value snapshot; for contact email/phone fields this is the HASH (PII rule). */
  value_text: string | null;
  source: string; // crm:hubspot | web:form | human:operator | agent:<slug> | enrichment:<vendor>
  method: string; // ingest | human_entry | agent_inference | enrichment | verification
  evidence_tag: EvidenceTag;
  confidence: number; // 0..1
  evidence_ref: string | null;
  verifier_ref: string | null;
  proof_id: string | null;
  observed_at: string;
  supersedes_provenance_id: string | null;
  created_at: string;
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
  // Cognitia v1.1 trust layer (0009–0012)
  agents: AgentsTable;
  agent_trust_credentials: AgentTrustCredentialsTable;
  agent_permissions: AgentPermissionsTable;
  proofs: ProofsTable;
  skills: SkillsTable;
  skill_versions: SkillVersionsTable;
  skill_proofs: SkillProofsTable;
  reputation_events: ReputationEventsTable;
  reputation_snapshots: ReputationSnapshotsTable;
  lead_intakes: LeadIntakesTable;
  lead_outcomes: LeadOutcomesTable;
  field_provenance: FieldProvenanceTable;
  credits_accounts: CreditsAccountsTable;
  credits_ledger_entries: CreditsLedgerEntriesTable;
  wallet_bindings: WalletBindingsTable;
}
