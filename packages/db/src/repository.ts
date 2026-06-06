import type {
  AccountsTable,
  ContactsTable,
  EventsTable,
  AgentRunsTable,
  AgentActionsTable,
  AuditEventsTable,
} from './schema.js';

export type AccountRow = AccountsTable;
export type ContactRow = ContactsTable;
export type EventRow = EventsTable;
export type AgentRunRow = AgentRunsTable;
export type AgentActionRow = AgentActionsTable;
export type AuditEventRow = AuditEventsTable;

export interface ListActionsFilter {
  approvalStatus?: string;
  executionStatus?: string;
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

  // --- events (immutable, insert-only) ---
  insertEvent(event: EventRow): Promise<void>;
  listEvents(tenantId: string): Promise<EventRow[]>;

  // --- agent runs ---
  createAgentRun(run: AgentRunRow): Promise<AgentRunRow>;
  getAgentRun(tenantId: string, id: string): Promise<AgentRunRow | null>;
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

  // --- audit trail (append-only) ---
  insertAuditEvent(event: AuditEventRow): Promise<void>;
  listAuditEvents(tenantId: string): Promise<AuditEventRow[]>;

  /**
   * Idempotent ingest of an external contact. Resolves via external_object_maps;
   * a repeated (system, external_id) updates the same contact instead of
   * creating a new one — so duplicate webhooks never duplicate contacts.
   */
  ingestExternalContact(
    input: IngestContactInput,
  ): Promise<{ contactId: string; created: boolean }>;
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
