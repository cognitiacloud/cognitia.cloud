import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { FakeHubspotClient } from './client.js';
import { HubspotSyncService } from './sync.js';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

function seedClient(): FakeHubspotClient {
  const client = new FakeHubspotClient();
  client.companies = [
    { externalId: 'co-1', name: 'Acme', domain: 'acme.com', industry: 'SaaS', employeeCount: 200 },
    { externalId: 'co-2', name: 'Globex', domain: 'globex.com' },
  ];
  client.contacts = [
    {
      externalId: 'ct-1',
      companyExternalId: 'co-1',
      fullName: 'Ada',
      title: 'VP Eng',
      emailHash: 'sha256:ada',
    },
    {
      externalId: 'ct-2',
      companyExternalId: 'co-2',
      fullName: 'Bo',
      title: 'CTO',
      emailHash: 'sha256:bo',
    },
  ];
  client.deals = [
    {
      externalId: 'd-1',
      companyExternalId: 'co-1',
      name: 'Acme Expansion',
      stage: 'qualified',
      amount: 50000,
    },
    { externalId: 'd-orphan', name: 'No Company Deal', stage: 'open' }, // must be skipped
  ];
  return client;
}

describe('HubspotSyncService — repo-native, idempotent, tenant-safe', () => {
  let repo: InMemoryRepository;
  let client: FakeHubspotClient;
  let svc: HubspotSyncService;

  beforeEach(() => {
    repo = new InMemoryRepository();
    client = seedClient();
    svc = new HubspotSyncService(repo, client);
  });

  it('syncs companies, contacts, and deals into canonical rows', async () => {
    const summary = await svc.sync({ tenantId: TENANT_A, traceId: 'trace-1' });

    expect(summary.companies).toEqual({ created: 2, updated: 0, skipped: 0 });
    expect(summary.contacts).toEqual({ created: 2, updated: 0, skipped: 0 });
    // d-orphan has no resolvable company -> skipped (account_id is NOT NULL).
    expect(summary.deals).toEqual({ created: 1, updated: 0, skipped: 1 });

    const accounts = await repo.listAccounts(TENANT_A);
    expect(accounts).toHaveLength(2);
    const acme = accounts.find((a) => a.name === 'Acme')!;
    expect(acme.industry).toBe('SaaS');

    // Contact linked to its account via the company external id.
    const acmeContacts = await repo.listContactsByAccount(TENANT_A, acme.id);
    expect(acmeContacts.map((c) => c.full_name)).toContain('Ada');

    // Deal linked to the account.
    const opps = await repo.listOpportunitiesByAccount(TENANT_A, acme.id);
    expect(opps).toHaveLength(1);
    expect(opps[0]!.name).toBe('Acme Expansion');
    expect(opps[0]!.amount).toBe(50000);
  });

  it('is idempotent under repeated sync (no duplicate rows)', async () => {
    await svc.sync({ tenantId: TENANT_A, traceId: 't1' });
    const second = await svc.sync({ tenantId: TENANT_A, traceId: 't2' });

    // Second pass updates existing rows, creates nothing new.
    expect(second.companies).toEqual({ created: 0, updated: 2, skipped: 0 });
    expect(second.contacts).toEqual({ created: 0, updated: 2, skipped: 0 });
    expect(second.deals).toEqual({ created: 0, updated: 1, skipped: 1 });

    expect(await repo.listAccounts(TENANT_A)).toHaveLength(2);
    expect(await repo.listOpportunities(TENANT_A)).toHaveLength(1);
    const acme = (await repo.listAccounts(TENANT_A)).find((a) => a.name === 'Acme')!;
    expect(await repo.listContactsByAccount(TENANT_A, acme.id)).toHaveLength(1);

    // Create/update parity: 1st pass emitted created, 2nd pass updated.
    const names = (await repo.listEvents(TENANT_A)).map((e) => e.event_name);
    expect(names).toContain('crm.opportunity.created.v1');
    expect(names).toContain('crm.opportunity.updated.v1');
  });

  it('resolves the same external id to the same internal id (external_object_maps uniqueness)', async () => {
    await svc.sync({ tenantId: TENANT_A, traceId: 't1' });
    const id1 = await repo.findInternalIdByExternal(TENANT_A, 'hubspot', 'company', 'co-1');
    await svc.sync({ tenantId: TENANT_A, traceId: 't2' });
    const id2 = await repo.findInternalIdByExternal(TENANT_A, 'hubspot', 'company', 'co-1');
    expect(id1).not.toBeNull();
    expect(id2).toBe(id1);
  });

  it('is tenant-safe: syncing tenant A creates nothing for tenant B', async () => {
    await svc.sync({ tenantId: TENANT_A, traceId: 't1' });
    expect(await repo.listAccounts(TENANT_B)).toHaveLength(0);
    expect(await repo.listOpportunities(TENANT_B)).toHaveLength(0);
    // Same external ids under tenant B resolve independently (no cross-tenant map).
    expect(await repo.findInternalIdByExternal(TENANT_B, 'hubspot', 'company', 'co-1')).toBeNull();
  });

  it('emits crm.* events and records a completed sync_run', async () => {
    const summary = await svc.sync({ tenantId: TENANT_A, traceId: 'trace-1' });
    const events = await repo.listEvents(TENANT_A);
    const names = events.map((e) => e.event_name);
    expect(names).toContain('crm.account.created.v1');
    expect(names).toContain('crm.contact.created.v1');
    expect(names).toContain('crm.opportunity.created.v1');
    // Events carry refs only (external_id), never raw PII.
    const contactEvent = events.find((e) => e.event_name === 'crm.contact.created.v1')!;
    expect(contactEvent.payload).toEqual({ external_id: 'ct-1' });
    expect(summary.syncRunId).toBeTruthy();
  });
});
