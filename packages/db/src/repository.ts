import type {
  AccountsTable,
  ContactsTable,
  EventsTable,
  AgentRunsTable,
  AgentActionsTable,
  AuditEventsTable,
  OpportunitiesTable,
  SyncRunsTable,
  IntegrationConnectionsTable,
  FeedbackLabelsTable,
  AgentPassportsTable,
  ScopeGrantsTable,
} from './schema.js';

export type AccountRow = AccountsTable;
export type ContactRow = ContactsTable;
export type EventRow = EventsTable;
export type AgentRunRow = AgentRunsTable;
export type AgentActionRow = AgentActionsTable;
export type AuditEventRow = AuditEventsTable;
/** What callers pass to insertAuditEvent — the chain fields are repo-computed. */
export type AuditEventInsert = Omit<AuditEventRow, 'prev_hash' | 'hash'>;
export type OpportunityRow = OpportunitiesTable;
export type SyncRunRow = SyncRunsTable;
export type FeedbackLabelRow = FeedbackLabelsTable;
export type IntegrationConnectionRow = IntegrationConnectionsTable;
export type AgentPassportRow = AgentPassportsTable;
export type ScopeGrantRow = ScopeGrantsTable;

export interface ListActionsFilter {
  approvalStatus?: string;
  executionStatus?: string;
}

/** Result of an idempotent ingest: the internal id and whether it was new. */
export interface IngestResult {
  id: string;
  created: boolean;
}

/**
 * Data-access contract used by agents and the API. Every method is explicitly
 * tenant-scoped; implementations MUST NOT return rows from another tenant
 * (the production Kysely impl relies on RLS; the in-memory impl filters).
 */
export interface Repository {
  // --- accounts / contacts ---
  listAccounts(tenantId: string): Promise<AccountRow[]>;
  getAccount(tenantId: string, id: string): Promise<AccountRow | null>;
  listContactsByAccount(tenantId: string, accountId: string): Promise<ContactRow[]>;
  getContact(tenantId: string, id: string): Promise<ContactRow | null>;
  /**
   * DSAR erasure: anonymize a contact's personal data in place (name/title/
   * persona/email_hash/phone_hash → null), mark it suppressed + erased. Keeps
   * the row (account link, ids, timestamps) so action/audit history stays
   * referentially meaningful and the append-only audit chain — which only ever
   * stored refs/hashes, never raw PII — remains intact and verifiable. Returns
   * the updated row, or null when missing for the tenant.
   */
  anonymizeContact(tenantId: string, id: string, erasedAt: string): Promise<ContactRow | null>;

  // --- events (immutable, insert-only) ---
  insertEvent(event: EventRow): Promise<void>;
  listEvents(tenantId: string): Promise<EventRow[]>;

  // --- agent runs ---
  createAgentRun(run: AgentRunRow): Promise<AgentRunRow>;
  getAgentRun(tenantId: string, id: string): Promise<AgentRunRow | null>;
  /** RUN-1: all runs for a tenant (newest first), for the run/plan surface. */
  listAgentRuns(tenantId: string): Promise<AgentRunRow[]>;
  updateAgentRunStatus(tenantId: string, id: string, status: string): Promise<void>;

  // --- agent actions (the audit unit) ---
  createAgentAction(action: AgentActionRow): Promise<AgentActionRow>;
  getAgentAction(tenantId: string, id: string): Promise<AgentActionRow | null>;
  /** Idempotent lookup by the unique (tenant_id, idempotency_key). */
  findActionByIdempotencyKey(tenantId: string, key: string): Promise<AgentActionRow | null>;
  listAgentActions(tenantId: string, filter?: ListActionsFilter): Promise<AgentActionRow[]>;
  updateAgentAction(
    tenantId: string,
    id: string,
    patch: Partial<AgentActionRow>,
  ): Promise<AgentActionRow>;

  // --- integrations ---
  /** Resolve a tenant's connection (incl. credential_ref) for an external system. */
  getIntegrationConnection(
    tenantId: string,
    externalSystem: string,
  ): Promise<IntegrationConnectionRow | null>;
  /**
   * ENF-1 — flip the tenant kill switch ('active' | 'paused' | 'error').
   * Returns the updated row, or null when no connection exists.
   */
  updateIntegrationConnectionStatus(
    tenantId: string,
    externalSystem: string,
    status: string,
  ): Promise<IntegrationConnectionRow | null>;

  // --- opportunities (deals) ---
  listOpportunities(tenantId: string): Promise<OpportunityRow[]>;
  listOpportunitiesByAccount(tenantId: string, accountId: string): Promise<OpportunityRow[]>;

  // --- audit trail (append-only, hash-chained) ---
  /**
   * Append an audit event. The repository computes the tamper-evident chain
   * (prev_hash + hash) — callers provide content only and can never forge or
   * skip a link. See auditChain.ts.
   */
  insertAuditEvent(event: AuditEventInsert): Promise<void>;
  listAuditEvents(tenantId: string): Promise<AuditEventRow[]>;

  // --- agent passports + scope grants (PASS-1: identity-first execution) ---
  /** Create a passport. One per (tenant, agent_id) — duplicates are rejected. */
  createAgentPassport(row: AgentPassportRow): Promise<AgentPassportRow>;
  getAgentPassport(tenantId: string, id: string): Promise<AgentPassportRow | null>;
  /** Resolve the passport an agent executes under (unique per tenant). */
  findAgentPassportByAgent(tenantId: string, agentId: string): Promise<AgentPassportRow | null>;
  listAgentPassports(tenantId: string): Promise<AgentPassportRow[]>;
  updateAgentPassportStatus(
    tenantId: string,
    id: string,
    status: AgentPassportRow['status'],
  ): Promise<AgentPassportRow | null>;
  createScopeGrant(row: ScopeGrantRow): Promise<ScopeGrantRow>;
  /** All grants for a tenant, optionally narrowed to one passport. */
  listScopeGrants(tenantId: string, passportId?: string): Promise<ScopeGrantRow[]>;
  /** Revoke a grant (sets status/revoked_at/revoked_by). Null if not found. */
  revokeScopeGrant(
    tenantId: string,
    id: string,
    revokedBy: string,
    revokedAt: string,
  ): Promise<ScopeGrantRow | null>;

  // --- feedback labels (decision flywheel; feeds evals/scorecards/autonomy) ---
  insertFeedbackLabel(row: FeedbackLabelRow): Promise<void>;
  listFeedbackLabels(tenantId: string, subjectRef?: string): Promise<FeedbackLabelRow[]>;

  // --- external object maps (idempotent ingest backbone) ---
  /**
   * Resolve the internal id for an external object via external_object_maps.
   * Backed by the unique (tenant_id, external_system, external_type, external_id)
   * constraint (migration 0002).
   */
  findInternalIdByExternal(
    tenantId: string,
    externalSystem: string,
    externalType: string,
    externalId: string,
  ): Promise<string | null>;

  /** Idempotent ingest of an external account (company). */
  ingestExternalAccount(input: IngestAccountInput): Promise<IngestResult>;

  /**
   * Idempotent ingest of an external contact. Resolves via external_object_maps;
   * a repeated (system, external_id) updates the same contact instead of
   * creating a new one — so duplicate webhooks/syncs never duplicate contacts.
   */
  ingestExternalContact(
    input: IngestContactInput,
  ): Promise<{ contactId: string; created: boolean }>;

  /** Idempotent ingest of an external opportunity (deal). */
  ingestExternalOpportunity(input: IngestOpportunityInput): Promise<IngestResult>;

  // --- sync runs (bookkeeping) ---
  createSyncRun(input: {
    tenantId: string;
    connectionId?: string | null;
    status?: string;
  }): Promise<SyncRunRow>;
  updateSyncRun(
    tenantId: string,
    id: string,
    patch: Partial<Pick<SyncRunRow, 'status' | 'finished_at' | 'stats'>>,
  ): Promise<SyncRunRow>;
  /** EVID-1: sync history for a tenant (newest first), for the audit surface. */
  listSyncRuns(tenantId: string): Promise<SyncRunRow[]>;
}

export interface IngestAccountInput {
  tenantId: string;
  externalSystem: string;
  externalId: string;
  account: {
    name: string;
    domain?: string | null;
    industry?: string | null;
    employeeCount?: number | null;
    region?: string | null;
  };
}

export interface IngestContactInput {
  tenantId: string;
  externalSystem: string;
  externalId: string;
  contact: {
    accountId?: string | null;
    fullName?: string | null;
    title?: string | null;
    persona?: string | null;
    emailHash?: string | null;
  };
}

export interface IngestOpportunityInput {
  tenantId: string;
  externalSystem: string;
  externalId: string;
  opportunity: {
    accountId: string;
    name: string;
    stage?: string;
    amount?: number | null;
    ownerRef?: string | null;
  };
}
