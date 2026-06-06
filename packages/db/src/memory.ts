import { randomUUID } from 'node:crypto';
import type {
  Repository,
  AccountRow,
  ContactRow,
  EventRow,
  AgentRunRow,
  AgentActionRow,
  AuditEventRow,
  ListActionsFilter,
  IngestContactInput,
} from './repository.js';
import type { ExternalObjectMapsTable } from './schema.js';

/**
 * In-memory Repository for the MVP and tests. It emulates RLS by filtering
 * every read on tenant_id, so a query for Tenant A can never observe Tenant B
 * rows — the same invariant the production Kysely+RLS path enforces in Postgres.
 *
 * Not for production use (no durability); Postgres is the source of truth.
 */
export class InMemoryRepository implements Repository {
  private accounts = new Map<string, AccountRow>();
  private contacts = new Map<string, ContactRow>();
  private events: EventRow[] = [];
  private runs = new Map<string, AgentRunRow>();
  private actions = new Map<string, AgentActionRow>();
  private audits: AuditEventRow[] = [];
  private externalMaps = new Map<string, ExternalObjectMapsTable>();

  // --- seed helpers (tests / fixtures) ---
  seedAccount(row: AccountRow): void {
    this.accounts.set(row.id, row);
  }
  seedContact(row: ContactRow): void {
    this.contacts.set(row.id, row);
  }

  async listAccounts(tenantId: string): Promise<AccountRow[]> {
    return [...this.accounts.values()].filter((a) => a.tenant_id === tenantId);
  }
  async getAccount(tenantId: string, id: string): Promise<AccountRow | null> {
    const a = this.accounts.get(id);
    return a && a.tenant_id === tenantId ? a : null;
  }
  async listContactsByAccount(tenantId: string, accountId: string): Promise<ContactRow[]> {
    return [...this.contacts.values()].filter(
      (c) => c.tenant_id === tenantId && c.account_id === accountId,
    );
  }
  async getContact(tenantId: string, id: string): Promise<ContactRow | null> {
    const c = this.contacts.get(id);
    return c && c.tenant_id === tenantId ? c : null;
  }

  async insertEvent(event: EventRow): Promise<void> {
    this.events.push(event);
  }
  async listEvents(tenantId: string): Promise<EventRow[]> {
    return this.events.filter((e) => e.tenant_id === tenantId);
  }

  async createAgentRun(run: AgentRunRow): Promise<AgentRunRow> {
    this.runs.set(run.id, run);
    return run;
  }
  async getAgentRun(tenantId: string, id: string): Promise<AgentRunRow | null> {
    const r = this.runs.get(id);
    return r && r.tenant_id === tenantId ? r : null;
  }
  async updateAgentRunStatus(tenantId: string, id: string, status: string): Promise<void> {
    const r = this.runs.get(id);
    if (r && r.tenant_id === tenantId) {
      r.status = status;
      r.updated_at = new Date().toISOString();
    }
  }

  async createAgentAction(action: AgentActionRow): Promise<AgentActionRow> {
    // Enforce unique (tenant_id, idempotency_key) like the DB constraint.
    const existing = await this.findActionByIdempotencyKey(
      action.tenant_id,
      action.idempotency_key,
    );
    if (existing) return existing;
    this.actions.set(action.id, action);
    return action;
  }
  async getAgentAction(tenantId: string, id: string): Promise<AgentActionRow | null> {
    const a = this.actions.get(id);
    return a && a.tenant_id === tenantId ? a : null;
  }
  async findActionByIdempotencyKey(tenantId: string, key: string): Promise<AgentActionRow | null> {
    return (
      [...this.actions.values()].find(
        (a) => a.tenant_id === tenantId && a.idempotency_key === key,
      ) ?? null
    );
  }
  async listAgentActions(
    tenantId: string,
    filter: ListActionsFilter = {},
  ): Promise<AgentActionRow[]> {
    return [...this.actions.values()].filter(
      (a) =>
        a.tenant_id === tenantId &&
        (filter.approvalStatus === undefined || a.approval_status === filter.approvalStatus) &&
        (filter.executionStatus === undefined || a.execution_status === filter.executionStatus),
    );
  }
  async updateAgentAction(
    tenantId: string,
    id: string,
    patch: Partial<AgentActionRow>,
  ): Promise<AgentActionRow> {
    const a = this.actions.get(id);
    if (!a || a.tenant_id !== tenantId) {
      throw new Error('agent_action not found for tenant');
    }
    const updated = { ...a, ...patch, updated_at: new Date().toISOString() };
    this.actions.set(id, updated);
    return updated;
  }

  async insertAuditEvent(event: AuditEventRow): Promise<void> {
    this.audits.push(event);
  }
  async listAuditEvents(tenantId: string): Promise<AuditEventRow[]> {
    return this.audits.filter((e) => e.tenant_id === tenantId);
  }

  async ingestExternalContact(
    input: IngestContactInput,
  ): Promise<{ contactId: string; created: boolean }> {
    // Unique (tenant, system, type=contact, external_id) — the dedupe backbone.
    const mapKey = [input.tenantId, input.externalSystem, 'contact', input.externalId].join('|');
    const now = new Date().toISOString();
    const existing = this.externalMaps.get(mapKey);

    if (existing) {
      const contact = this.contacts.get(existing.internal_id);
      if (contact) {
        const updated: ContactRow = {
          ...contact,
          full_name: input.contact.fullName ?? contact.full_name,
          title: input.contact.title ?? contact.title,
          persona: input.contact.persona ?? contact.persona,
          email_hash: input.contact.emailHash ?? contact.email_hash,
          updated_at: now,
        };
        this.contacts.set(updated.id, updated);
      }
      return { contactId: existing.internal_id, created: false };
    }

    const contactId = randomUUID();
    this.contacts.set(contactId, {
      id: contactId,
      tenant_id: input.tenantId,
      account_id: input.contact.accountId ?? null,
      full_name: input.contact.fullName ?? null,
      title: input.contact.title ?? null,
      persona: input.contact.persona ?? null,
      email_hash: input.contact.emailHash ?? null,
      phone_hash: null,
      is_suppressed: false,
      attributes: {},
      created_at: now,
      updated_at: now,
    });
    this.externalMaps.set(mapKey, {
      id: randomUUID(),
      tenant_id: input.tenantId,
      connection_id: null,
      external_system: input.externalSystem,
      external_type: 'contact',
      external_id: input.externalId,
      internal_type: 'contact',
      internal_id: contactId,
      created_at: now,
      updated_at: now,
    });
    return { contactId, created: true };
  }
}
