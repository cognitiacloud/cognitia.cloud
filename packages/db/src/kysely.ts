import { type Kysely, type RawBuilder, sql } from 'kysely';
import type { Database } from './schema.js';
import { withTenant } from './client.js';
import type {
  Repository,
  AccountRow,
  ContactRow,
  EventRow,
  AgentRunRow,
  AgentActionRow,
  AuditEventRow,
  OpportunityRow,
  SyncRunRow,
  ListActionsFilter,
  IngestResult,
  IngestAccountInput,
  IngestContactInput,
  IngestOpportunityInput,
} from './repository.js';

/** Wrap a JS value as a jsonb literal (node-postgres mis-encodes JS arrays as PG arrays). */
function jb<T>(value: T): RawBuilder<T> {
  return sql<T>`${JSON.stringify(value ?? null)}::jsonb`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Production Repository over Kysely + Postgres. Every method runs inside a
 * `withTenant` transaction, which sets the transaction-local `app.current_tenant_id`
 * GUC that RLS reads — so isolation is enforced by Postgres, not app code. A
 * redundant `tenant_id =` predicate is added to reads as defense in depth.
 *
 * Idempotent ingest resolves through `external_object_maps`
 * (unique (tenant_id, external_system, external_type, external_id), migration 0002),
 * matching the InMemoryRepository contract used by the test suite.
 */
export class KyselyRepository implements Repository {
  constructor(private readonly db: Kysely<Database>) {}

  private run<T>(tenantId: string, fn: (trx: Kysely<Database>) => Promise<T>): Promise<T> {
    return withTenant(this.db, tenantId, fn);
  }

  // --- accounts / contacts ---

  listAccounts(tenantId: string): Promise<AccountRow[]> {
    return this.run(tenantId, (trx) =>
      trx.selectFrom('accounts').selectAll().where('tenant_id', '=', tenantId).execute(),
    );
  }
  getAccount(tenantId: string, id: string): Promise<AccountRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('accounts')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .executeTakeFirst()) ?? null,
    );
  }
  listContactsByAccount(tenantId: string, accountId: string): Promise<ContactRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('contacts')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('account_id', '=', accountId)
        .execute(),
    );
  }
  getContact(tenantId: string, id: string): Promise<ContactRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('contacts')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .executeTakeFirst()) ?? null,
    );
  }

  // --- events (immutable, insert-only) ---

  insertEvent(event: EventRow): Promise<void> {
    return this.run(event.tenant_id, async (trx) => {
      await trx
        .insertInto('events')
        .values({ ...event, payload: jb(event.payload) })
        .execute();
    });
  }
  listEvents(tenantId: string): Promise<EventRow[]> {
    return this.run(tenantId, (trx) =>
      trx.selectFrom('events').selectAll().where('tenant_id', '=', tenantId).execute(),
    );
  }

  // --- agent runs ---

  createAgentRun(run: AgentRunRow): Promise<AgentRunRow> {
    return this.run(run.tenant_id, async (trx) => {
      await trx
        .insertInto('agent_runs')
        .values({ ...run, input_refs: jb(run.input_refs) })
        .execute();
      return run;
    });
  }
  getAgentRun(tenantId: string, id: string): Promise<AgentRunRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('agent_runs')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .executeTakeFirst()) ?? null,
    );
  }
  updateAgentRunStatus(tenantId: string, id: string, status: string): Promise<void> {
    return this.run(tenantId, async (trx) => {
      await trx
        .updateTable('agent_runs')
        .set({ status, updated_at: nowIso() })
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .execute();
    });
  }

  // --- agent actions ---

  createAgentAction(action: AgentActionRow): Promise<AgentActionRow> {
    return this.run(action.tenant_id, async (trx) => {
      const existing = await trx
        .selectFrom('agent_actions')
        .selectAll()
        .where('tenant_id', '=', action.tenant_id)
        .where('idempotency_key', '=', action.idempotency_key)
        .executeTakeFirst();
      if (existing) return existing;
      await trx
        .insertInto('agent_actions')
        .values({
          ...action,
          evidence_refs: jb(action.evidence_refs),
          guardrail_results: jb(action.guardrail_results),
          result: action.result === null ? null : jb(action.result),
        })
        .execute();
      return action;
    });
  }
  getAgentAction(tenantId: string, id: string): Promise<AgentActionRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('agent_actions')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('id', '=', id)
          .executeTakeFirst()) ?? null,
    );
  }
  findActionByIdempotencyKey(tenantId: string, key: string): Promise<AgentActionRow | null> {
    return this.run(
      tenantId,
      async (trx) =>
        (await trx
          .selectFrom('agent_actions')
          .selectAll()
          .where('tenant_id', '=', tenantId)
          .where('idempotency_key', '=', key)
          .executeTakeFirst()) ?? null,
    );
  }
  listAgentActions(tenantId: string, filter: ListActionsFilter = {}): Promise<AgentActionRow[]> {
    return this.run(tenantId, (trx) => {
      let q = trx.selectFrom('agent_actions').selectAll().where('tenant_id', '=', tenantId);
      if (filter.approvalStatus !== undefined) {
        q = q.where('approval_status', '=', filter.approvalStatus);
      }
      if (filter.executionStatus !== undefined) {
        q = q.where('execution_status', '=', filter.executionStatus);
      }
      return q.execute();
    });
  }
  updateAgentAction(
    tenantId: string,
    id: string,
    patch: Partial<AgentActionRow>,
  ): Promise<AgentActionRow> {
    return this.run(tenantId, async (trx) => {
      // Map only provided fields; jsonb columns are cast explicitly.
      const set: Record<string, unknown> = { updated_at: nowIso() };
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'updated_at') continue;
        if (k === 'evidence_refs' || k === 'guardrail_results') {
          set[k] = jb(v);
        } else if (k === 'result') {
          set[k] = v === null ? null : jb(v);
        } else {
          set[k] = v;
        }
      }
      const updated = await trx
        .updateTable('agent_actions')
        .set(set as never)
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!updated) throw new Error('agent_action not found for tenant');
      return updated;
    });
  }

  // --- opportunities ---

  listOpportunities(tenantId: string): Promise<OpportunityRow[]> {
    return this.run(tenantId, (trx) =>
      trx.selectFrom('opportunities').selectAll().where('tenant_id', '=', tenantId).execute(),
    );
  }
  listOpportunitiesByAccount(tenantId: string, accountId: string): Promise<OpportunityRow[]> {
    return this.run(tenantId, (trx) =>
      trx
        .selectFrom('opportunities')
        .selectAll()
        .where('tenant_id', '=', tenantId)
        .where('account_id', '=', accountId)
        .execute(),
    );
  }

  // --- audit trail (append-only) ---

  insertAuditEvent(event: AuditEventRow): Promise<void> {
    return this.run(event.tenant_id, async (trx) => {
      await trx
        .insertInto('audit_events')
        .values({ ...event, detail: jb(event.detail) })
        .execute();
    });
  }
  listAuditEvents(tenantId: string): Promise<AuditEventRow[]> {
    return this.run(tenantId, (trx) =>
      trx.selectFrom('audit_events').selectAll().where('tenant_id', '=', tenantId).execute(),
    );
  }

  // --- external object maps + idempotent ingest ---

  findInternalIdByExternal(
    tenantId: string,
    externalSystem: string,
    externalType: string,
    externalId: string,
  ): Promise<string | null> {
    return this.run(tenantId, (trx) =>
      this.resolveExternal(trx, tenantId, externalSystem, externalType, externalId),
    );
  }

  private async resolveExternal(
    trx: Kysely<Database>,
    tenantId: string,
    system: string,
    type: string,
    externalId: string,
  ): Promise<string | null> {
    const row = await trx
      .selectFrom('external_object_maps')
      .select('internal_id')
      .where('tenant_id', '=', tenantId)
      .where('external_system', '=', system)
      .where('external_type', '=', type)
      .where('external_id', '=', externalId)
      .executeTakeFirst();
    return row?.internal_id ?? null;
  }

  private async putExternalMap(
    trx: Kysely<Database>,
    tenantId: string,
    system: string,
    type: string,
    externalId: string,
    internalId: string,
  ): Promise<void> {
    const ts = nowIso();
    await trx
      .insertInto('external_object_maps')
      .values({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        connection_id: null,
        external_system: system,
        external_type: type,
        external_id: externalId,
        internal_type: type,
        internal_id: internalId,
        created_at: ts,
        updated_at: ts,
      })
      .execute();
  }

  ingestExternalAccount(input: IngestAccountInput): Promise<IngestResult> {
    return this.run(input.tenantId, async (trx) => {
      const existingId = await this.resolveExternal(
        trx,
        input.tenantId,
        input.externalSystem,
        'company',
        input.externalId,
      );
      if (existingId) {
        await trx
          .updateTable('accounts')
          .set({
            name: input.account.name,
            domain: input.account.domain ?? null,
            industry: input.account.industry ?? null,
            employee_count: input.account.employeeCount ?? null,
            region: input.account.region ?? null,
            updated_at: nowIso(),
          })
          .where('tenant_id', '=', input.tenantId)
          .where('id', '=', existingId)
          .execute();
        return { id: existingId, created: false };
      }
      const id = crypto.randomUUID();
      const ts = nowIso();
      await trx
        .insertInto('accounts')
        .values({
          id,
          tenant_id: input.tenantId,
          name: input.account.name,
          domain: input.account.domain ?? null,
          industry: input.account.industry ?? null,
          employee_count: input.account.employeeCount ?? null,
          region: input.account.region ?? null,
          fit_score: null,
          timing_score: null,
          attributes: jb({}),
          created_at: ts,
          updated_at: ts,
        })
        .execute();
      await this.putExternalMap(
        trx,
        input.tenantId,
        input.externalSystem,
        'company',
        input.externalId,
        id,
      );
      return { id, created: true };
    });
  }

  ingestExternalContact(
    input: IngestContactInput,
  ): Promise<{ contactId: string; created: boolean }> {
    return this.run(input.tenantId, async (trx) => {
      const existingId = await this.resolveExternal(
        trx,
        input.tenantId,
        input.externalSystem,
        'contact',
        input.externalId,
      );
      if (existingId) {
        await trx
          .updateTable('contacts')
          .set({
            account_id: input.contact.accountId ?? null,
            full_name: input.contact.fullName ?? null,
            title: input.contact.title ?? null,
            persona: input.contact.persona ?? null,
            email_hash: input.contact.emailHash ?? null,
            updated_at: nowIso(),
          })
          .where('tenant_id', '=', input.tenantId)
          .where('id', '=', existingId)
          .execute();
        return { contactId: existingId, created: false };
      }
      const id = crypto.randomUUID();
      const ts = nowIso();
      await trx
        .insertInto('contacts')
        .values({
          id,
          tenant_id: input.tenantId,
          account_id: input.contact.accountId ?? null,
          full_name: input.contact.fullName ?? null,
          title: input.contact.title ?? null,
          persona: input.contact.persona ?? null,
          email_hash: input.contact.emailHash ?? null,
          phone_hash: null,
          is_suppressed: false,
          attributes: jb({}),
          created_at: ts,
          updated_at: ts,
        })
        .execute();
      await this.putExternalMap(
        trx,
        input.tenantId,
        input.externalSystem,
        'contact',
        input.externalId,
        id,
      );
      return { contactId: id, created: true };
    });
  }

  ingestExternalOpportunity(input: IngestOpportunityInput): Promise<IngestResult> {
    return this.run(input.tenantId, async (trx) => {
      const existingId = await this.resolveExternal(
        trx,
        input.tenantId,
        input.externalSystem,
        'deal',
        input.externalId,
      );
      if (existingId) {
        await trx
          .updateTable('opportunities')
          .set({
            account_id: input.opportunity.accountId,
            name: input.opportunity.name,
            stage: input.opportunity.stage ?? 'open',
            amount: input.opportunity.amount ?? null,
            owner_ref: input.opportunity.ownerRef ?? null,
            updated_at: nowIso(),
          })
          .where('tenant_id', '=', input.tenantId)
          .where('id', '=', existingId)
          .execute();
        return { id: existingId, created: false };
      }
      const id = crypto.randomUUID();
      const ts = nowIso();
      await trx
        .insertInto('opportunities')
        .values({
          id,
          tenant_id: input.tenantId,
          account_id: input.opportunity.accountId,
          name: input.opportunity.name,
          stage: input.opportunity.stage ?? 'open',
          amount: input.opportunity.amount ?? null,
          owner_ref: input.opportunity.ownerRef ?? null,
          attributes: jb({}),
          created_at: ts,
          updated_at: ts,
        })
        .execute();
      await this.putExternalMap(
        trx,
        input.tenantId,
        input.externalSystem,
        'deal',
        input.externalId,
        id,
      );
      return { id, created: true };
    });
  }

  // --- sync runs ---

  createSyncRun(input: {
    tenantId: string;
    connectionId?: string | null;
    status?: string;
  }): Promise<SyncRunRow> {
    return this.run(input.tenantId, async (trx) => {
      const ts = nowIso();
      const row: SyncRunRow = {
        id: crypto.randomUUID(),
        tenant_id: input.tenantId,
        connection_id: input.connectionId ?? null,
        status: input.status ?? 'running',
        started_at: ts,
        finished_at: null,
        stats: {},
        created_at: ts,
        updated_at: ts,
      };
      await trx
        .insertInto('sync_runs')
        .values({ ...row, stats: jb(row.stats) })
        .execute();
      return row;
    });
  }
  updateSyncRun(
    tenantId: string,
    id: string,
    patch: Partial<Pick<SyncRunRow, 'status' | 'finished_at' | 'stats'>>,
  ): Promise<SyncRunRow> {
    return this.run(tenantId, async (trx) => {
      const set: Record<string, unknown> = { updated_at: nowIso() };
      if (patch.status !== undefined) set.status = patch.status;
      if (patch.finished_at !== undefined) set.finished_at = patch.finished_at;
      if (patch.stats !== undefined) set.stats = jb(patch.stats);
      const updated = await trx
        .updateTable('sync_runs')
        .set(set as never)
        .where('tenant_id', '=', tenantId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!updated) throw new Error('sync_run not found for tenant');
      return updated as SyncRunRow;
    });
  }
}
