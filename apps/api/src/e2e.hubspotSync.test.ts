import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { InMemoryRepository, type IntegrationConnectionRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import {
  AesGcmSecretStore,
  ConnectionTokenProvider,
  HttpHubspotClient,
  HubspotSyncService,
  type HttpFetch,
  type HttpResponse,
} from '@cognitia/integrations';
import { ApiHandlers } from './handlers.js';
import { buildServer } from './server.js';

/**
 * End-to-end composition smoke test. NOT a live-infra test: the only mocked
 * boundaries are HubSpot HTTP (injected `fetch`) and the secret backing store.
 * Everything else is the real code that production wiring (`buildCrmSyncRuntime`)
 * composes — ConnectionTokenProvider → HttpHubspotClient → HubspotSyncService →
 * Repository — plus the real Fastify webhook route + signature verification.
 *
 * The repo is the in-memory `Repository` implementation, which is contract-tested
 * against the production KyselyRepository over PGlite (repository.contract.ts), so
 * this test focuses on the cross-component wiring rather than re-proving SQL.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const NOW = 1_700_000_000_000;
const ACCESS_TOKEN = 'acme-access-token';
const CREDENTIAL_REF = 'cred-ref-acme';

function connection(): IntegrationConnectionRow {
  return {
    id: 'conn-1',
    tenant_id: TENANT,
    external_system: 'hubspot',
    status: 'active',
    credential_ref: CREDENTIAL_REF,
    metadata: {},
    created_at: '2026-06-06T00:00:00.000Z',
    updated_at: '2026-06-06T00:00:00.000Z',
  };
}

function hubspotResponse(status: number, body: unknown): HttpResponse {
  return {
    status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/** A mocked HubSpot CRM v3 transport that asserts the per-tenant bearer token. */
function mockHubspotFetch(tokenSeen: { value?: string }): HttpFetch {
  const company = {
    id: 'co-1',
    properties: { name: 'Acme', domain: 'acme.com', numberofemployees: '200' },
  };
  const contact = {
    id: 'ct-1',
    properties: { firstname: 'Ada', lastname: 'L', jobtitle: 'VP', email: 'ada@acme.com' },
    associations: { companies: { results: [{ id: 'co-1' }] } },
  };
  const deal = {
    id: 'd-1',
    properties: { dealname: 'Acme Expansion', dealstage: 'qualified', amount: '50000' },
    associations: { companies: { results: [{ id: 'co-1' }] } },
  };
  return async (url, init) => {
    tokenSeen.value = init?.headers?.['authorization'];
    if (url.includes('/objects/companies')) return hubspotResponse(200, { results: [company] });
    if (url.includes('/objects/contacts')) return hubspotResponse(200, { results: [contact] });
    if (url.includes('/objects/deals')) return hubspotResponse(200, { results: [deal] });
    throw new Error(`unexpected HubSpot URL: ${url}`);
  };
}

function buildSyncStack(repo: InMemoryRepository) {
  // Encrypted-at-rest secret store seeded with a valid (non-expired) credential.
  const secrets = new AesGcmSecretStore(Buffer.alloc(32, 9));
  const tokenSeen: { value?: string } = {};
  const setup = async () => {
    repo.seedIntegrationConnection(connection());
    await secrets.put(CREDENTIAL_REF, {
      accessToken: ACCESS_TOKEN,
      expiresAt: new Date(NOW + 3_600_000).toISOString(),
    });
  };
  const tokenProvider = new ConnectionTokenProvider({ repo, secrets, now: () => NOW });
  const client = new HttpHubspotClient({
    token: tokenProvider,
    fetch: mockHubspotFetch(tokenSeen),
  });
  const service = new HubspotSyncService(repo, client);
  return { service, tokenSeen, setup };
}

describe('E2E smoke: HubSpot tenant sync through the real runtime wiring', () => {
  it('resolves the per-tenant token, syncs companies/contacts/deals, emits events', async () => {
    const repo = new InMemoryRepository();
    const { service, tokenSeen, setup } = buildSyncStack(repo);
    await setup();

    const summary = await service.sync({ tenantId: TENANT, traceId: 'e2e-1' });

    // Token provider resolved the per-tenant credential and the client used it.
    expect(tokenSeen.value).toBe(`Bearer ${ACCESS_TOKEN}`);

    // Sync wrote canonical rows.
    expect(summary.companies).toEqual({ created: 1, updated: 0, skipped: 0 });
    expect(summary.contacts).toEqual({ created: 1, updated: 0, skipped: 0 });
    expect(summary.deals).toEqual({ created: 1, updated: 0, skipped: 0 });

    const accounts = await repo.listAccounts(TENANT);
    expect(accounts).toHaveLength(1);
    const acme = accounts[0]!;
    expect(acme.name).toBe('Acme');

    const contacts = await repo.listContactsByAccount(TENANT, acme.id);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]!.full_name).toBe('Ada L');
    // PII-safe: email stored as a hash, never raw.
    expect(contacts[0]!.email_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(contacts[0])).not.toContain('ada@acme.com');

    const opps = await repo.listOpportunitiesByAccount(TENANT, acme.id);
    expect(opps).toHaveLength(1);
    expect(Number(opps[0]!.amount)).toBe(50000);

    // Events emitted with refs only.
    const eventNames = (await repo.listEvents(TENANT)).map((e) => e.event_name);
    expect(eventNames).toContain('crm.account.created.v1');
    expect(eventNames).toContain('crm.contact.created.v1');
    expect(eventNames).toContain('crm.opportunity.created.v1');
  });

  it('re-running the sync is idempotent (no duplicate rows)', async () => {
    const repo = new InMemoryRepository();
    const { service, setup } = buildSyncStack(repo);
    await setup();

    await service.sync({ tenantId: TENANT, traceId: 'e2e-1' });
    const second = await service.sync({ tenantId: TENANT, traceId: 'e2e-2' });

    expect(second.companies).toEqual({ created: 0, updated: 1, skipped: 0 });
    expect(second.contacts).toEqual({ created: 0, updated: 1, skipped: 0 });
    expect(second.deals).toEqual({ created: 0, updated: 1, skipped: 0 });

    expect(await repo.listAccounts(TENANT)).toHaveLength(1);
    expect(await repo.listOpportunities(TENANT)).toHaveLength(1);
    const acme = (await repo.listAccounts(TENANT))[0]!;
    expect(await repo.listContactsByAccount(TENANT, acme.id)).toHaveLength(1);
  });
});

describe('E2E smoke: signed HubSpot webhook ingests through the API', () => {
  const SECRET = 'hs-client-secret';
  const HOST = 'app.cognitia.cloud';
  const FULL_URI = `http://${HOST}/webhooks/hubspot`;

  function sign(body: string, ts: number): string {
    return createHmac('sha256', SECRET)
      .update(`POST${FULL_URI}${body}${ts}`, 'utf8')
      .digest('base64');
  }

  it('verifies the signature and ingests the contact into the same repo path', async () => {
    const repo = new InMemoryRepository();
    const services = createGtmServices({ repo });
    const handlers = new ApiHandlers(repo, services, {
      hubspotWebhookSecret: SECRET,
      now: () => NOW,
    });
    const app = buildServer(handlers);

    const body = JSON.stringify({
      externalId: 'hs-contact-777',
      fullName: 'Bo Park',
      title: 'CTO',
      emailHash: 'sha256:bo',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/hubspot',
      headers: {
        host: HOST,
        'content-type': 'application/json',
        'x-tenant-id': TENANT,
        'x-hubspot-signature-v3': sign(body, NOW),
        'x-hubspot-request-timestamp': String(NOW),
      },
      payload: body,
    });

    expect(res.statusCode).toBe(201);
    const ingestedId = await repo.findInternalIdByExternal(
      TENANT,
      'hubspot',
      'contact',
      'hs-contact-777',
    );
    expect(ingestedId).toBeTruthy();
    const contact = await repo.getContact(TENANT, ingestedId!);
    expect(contact?.full_name).toBe('Bo Park');
  });

  it('rejects an unsigned webhook (fails closed, no ingest)', async () => {
    const repo = new InMemoryRepository();
    const handlers = new ApiHandlers(repo, createGtmServices({ repo }), {
      hubspotWebhookSecret: SECRET,
      now: () => NOW,
    });
    const app = buildServer(handlers);

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/hubspot',
      headers: { host: HOST, 'content-type': 'application/json', 'x-tenant-id': TENANT },
      payload: JSON.stringify({ externalId: 'nope', emailHash: 'x' }),
    });
    expect(res.statusCode).toBe(401);
    expect(await repo.findInternalIdByExternal(TENANT, 'hubspot', 'contact', 'nope')).toBeNull();
  });
});
