import { makeEvent, log, type KnownEventName } from '@cognitia/core';
import type { Repository, EventRow } from '@cognitia/db';
import type { HubspotClient, HubspotPage } from './client.js';

export interface SyncEntityCounts {
  created: number;
  updated: number;
  skipped: number;
}
export interface HubspotSyncSummary {
  syncRunId: string;
  companies: SyncEntityCounts;
  contacts: SyncEntityCounts;
  deals: SyncEntityCounts;
}

export interface HubspotSyncDeps {
  now?: () => Date;
  newId?: () => string;
}

const SYSTEM = 'hubspot';

/**
 * Repo-native HubSpot sync. Pages companies → contacts → deals from a
 * HubspotClient and upserts canonical rows through the real Repository, fully
 * tenant-scoped and idempotent (every write resolves via external_object_maps).
 *
 * Order matters: companies first so contacts/deals can resolve their internal
 * account id. Emits crm.* events and records a sync_runs row. No raw PII — only
 * hashes/refs cross into events and logs.
 */
export class HubspotSyncService {
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(
    private readonly repo: Repository,
    private readonly client: HubspotClient,
    deps: HubspotSyncDeps = {},
  ) {
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  async sync(input: {
    tenantId: string;
    traceId: string;
    connectionId?: string | null;
  }): Promise<HubspotSyncSummary> {
    const { tenantId, traceId } = input;
    const run = await this.repo.createSyncRun({
      tenantId,
      connectionId: input.connectionId ?? null,
      status: 'running',
    });

    const companies: SyncEntityCounts = { created: 0, updated: 0, skipped: 0 };
    const contacts: SyncEntityCounts = { created: 0, updated: 0, skipped: 0 };
    const deals: SyncEntityCounts = { created: 0, updated: 0, skipped: 0 };

    try {
      // 1) Companies → accounts.
      for await (const company of this.page((c) => this.client.listCompanies(c), tenantId)) {
        const res = await this.repo.ingestExternalAccount({
          tenantId,
          externalSystem: SYSTEM,
          externalId: company.externalId,
          account: {
            name: company.name ?? company.externalId,
            domain: company.domain ?? null,
            industry: company.industry ?? null,
            employeeCount: company.employeeCount ?? null,
          },
        });
        bump(companies, res.created);
        await this.emit(
          tenantId,
          traceId,
          res.created ? 'crm.account.created.v1' : 'crm.account.updated.v1',
          'account',
          res.id,
          { external_id: company.externalId },
        );
      }

      // 2) Contacts → contacts (linked to account via company external id).
      for await (const contact of this.page((c) => this.client.listContacts(c), tenantId)) {
        const accountId = contact.companyExternalId
          ? await this.repo.findInternalIdByExternal(
              tenantId,
              SYSTEM,
              'company',
              contact.companyExternalId,
            )
          : null;
        const res = await this.repo.ingestExternalContact({
          tenantId,
          externalSystem: SYSTEM,
          externalId: contact.externalId,
          contact: {
            accountId,
            fullName: contact.fullName ?? null,
            title: contact.title ?? null,
            emailHash: contact.emailHash ?? null, // hash only — never raw email
          },
        });
        bump(contacts, res.created);
        await this.emit(
          tenantId,
          traceId,
          res.created ? 'crm.contact.created.v1' : 'crm.contact.updated.v1',
          'contact',
          res.contactId,
          { external_id: contact.externalId },
        );
      }

      // 3) Deals → opportunities (require a resolvable company; account_id is NOT NULL).
      for await (const deal of this.page((c) => this.client.listDeals(c), tenantId)) {
        const accountId = deal.companyExternalId
          ? await this.repo.findInternalIdByExternal(
              tenantId,
              SYSTEM,
              'company',
              deal.companyExternalId,
            )
          : null;
        if (!accountId) {
          deals.skipped++;
          log({
            level: 'warn',
            message: 'hubspot.sync.deal_skipped_no_company',
            tenant_id: tenantId,
            trace_id: traceId,
            entity_ref: `deal:${deal.externalId}`,
          });
          continue;
        }
        const res = await this.repo.ingestExternalOpportunity({
          tenantId,
          externalSystem: SYSTEM,
          externalId: deal.externalId,
          opportunity: {
            accountId,
            name: deal.name ?? deal.externalId,
            stage: deal.stage,
            amount: deal.amount ?? null,
            ownerRef: deal.ownerRef ?? null,
          },
        });
        bump(deals, res.created);
        await this.emit(tenantId, traceId, 'crm.opportunity.updated.v1', 'opportunity', res.id, {
          external_id: deal.externalId,
        });
      }

      await this.repo.updateSyncRun(tenantId, run.id, {
        status: 'completed',
        finished_at: this.now().toISOString(),
        stats: { companies, contacts, deals },
      });
      log({
        level: 'info',
        message: 'hubspot.sync.completed',
        tenant_id: tenantId,
        trace_id: traceId,
      });
      return { syncRunId: run.id, companies, contacts, deals };
    } catch (err) {
      await this.repo.updateSyncRun(tenantId, run.id, {
        status: 'failed',
        finished_at: this.now().toISOString(),
        stats: { error: err instanceof Error ? err.message : String(err) },
      });
      log({
        level: 'error',
        message: 'hubspot.sync.failed',
        tenant_id: tenantId,
        trace_id: traceId,
      });
      throw err;
    }
  }

  /** Follow `cursor` paging until exhausted. */
  private async *page<T>(
    fetch: (c: { tenantId: string; cursor?: string }) => Promise<HubspotPage<T>>,
    tenantId: string,
  ): AsyncGenerator<T> {
    let cursor: string | undefined;
    do {
      const pageResult = await fetch({ tenantId, cursor });
      for (const item of pageResult.items) yield item;
      cursor = pageResult.cursor;
    } while (cursor);
  }

  private async emit(
    tenantId: string,
    traceId: string,
    eventName: KnownEventName,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const event = makeEvent(
      {
        tenant_id: tenantId,
        event_name: eventName,
        entity_type: entityType,
        entity_id: entityId,
        source: SYSTEM,
        payload,
        trace_id: traceId,
      },
      this.now,
      this.newId,
    ) as EventRow;
    await this.repo.insertEvent(event);
  }
}

function bump(counts: SyncEntityCounts, created: boolean): void {
  if (created) counts.created++;
  else counts.updated++;
}
