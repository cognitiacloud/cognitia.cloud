import { describe, it, expect, afterEach, vi } from 'vitest';
import { LIVE_SURFACE_DENIED, LiveSurfaceDeniedError, readLiveOutboundFlags } from '@cognitia/core';
import {
  ConnectionTokenProvider,
  FakeHubspotClient,
  HttpHubspotClient,
  HubspotProvider,
  HubspotSyncService,
  InMemorySecretStore,
  executeSalesforceRead,
  executeSalesforceWrite,
  executeWebhookOutboundSideEffect,
  type HttpFetch,
} from './index.js';
import { InMemoryRepository } from '@cognitia/db';

/**
 * CGD-001: network is stubbed. If fetch is invoked the test fails.
 * Secrets in env are not consent.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.HUBSPOT_CLIENT_SECRET;
  delete process.env.SALESFORCE_CLIENT_SECRET;
});

function explodingFetch(): HttpFetch {
  return async () => {
    throw new Error('CGD-001 packet failed: network was used');
  };
}

describe('CGD-001 live-surface quarantine (network stubbed)', () => {
  it('default deny: committed flags read as false from empty env', () => {
    const flags = readLiveOutboundFlags({});
    expect(flags.LIVE_OUTBOUND_EXPLICITLY_ALLOWED).toBe(false);
    expect(Object.values(flags.surfaces).every((v) => v === false)).toBe(true);
  });

  it('HubSpot write is denied even with client secret set; fetch is never called', async () => {
    process.env.HUBSPOT_CLIENT_SECRET = 'hs-secret-not-consent';
    vi.stubEnv('HUBSPOT_CLIENT_SECRET', 'hs-secret-not-consent');
    let fetches = 0;
    let tokens = 0;
    const fetch: HttpFetch = async () => {
      fetches += 1;
      throw new Error('CGD-001 packet failed: network was used');
    };
    const client = new HttpHubspotClient({
      token: {
        getAccessToken: async () => {
          tokens += 1;
          throw new Error('CGD-001 packet failed: token fetched before gate');
        },
      },
      fetch,
    });
    await expect(
      client.createTask({
        tenantId: 't1',
        idempotencyKey: 'k1',
        targetRef: 'account:x',
        payload: { hs_task_subject: 'nope' },
      }),
    ).rejects.toMatchObject({
      name: 'LiveSurfaceDeniedError',
      code: LIVE_SURFACE_DENIED,
      outbound: false,
      surface: 'hubspot',
    });
    await expect(
      client.createNote({
        tenantId: 't1',
        idempotencyKey: 'k2',
        targetRef: 'account:x',
        payload: {},
      }),
    ).rejects.toBeInstanceOf(LiveSurfaceDeniedError);
    expect(fetches).toBe(0);
    expect(tokens).toBe(0);
  });

  it('Salesforce write is denied even with client secret set; no client constructed', async () => {
    process.env.SALESFORCE_CLIENT_SECRET = 'sf-secret-not-consent';
    vi.stubEnv('SALESFORCE_CLIENT_SECRET', 'sf-secret-not-consent');
    await expect(
      executeSalesforceWrite({ operation: 'createTask', payload: { subject: 'nope' } }),
    ).rejects.toMatchObject({
      name: 'LiveSurfaceDeniedError',
      code: LIVE_SURFACE_DENIED,
      outbound: false,
      surface: 'salesforce',
    });
  });

  it('HubspotProvider.write is denied before unimplemented body', async () => {
    const provider = new HubspotProvider();
    await expect(
      provider.write(
        { tenantId: 't', connectionId: 'c', credentialRef: 'r' },
        { type: 'crm.task.create', idempotencyKey: 'k', payload: {} },
      ),
    ).rejects.toMatchObject({ code: LIVE_SURFACE_DENIED, outbound: false, surface: 'hubspot' });
  });

  it('webhook outbound side-effect is denied before fetch', async () => {
    await expect(executeWebhookOutboundSideEffect('hubspot')).rejects.toMatchObject({
      code: LIVE_SURFACE_DENIED,
      outbound: false,
      surface: 'hubspot',
    });
  });

  it('HttpHubspotClient default fetch is never reached on deny', async () => {
    const client = new HttpHubspotClient({
      token: { getAccessToken: async () => 'tok' },
      fetch: explodingFetch(),
    });
    await expect(
      client.archiveEngagement({ tenantId: 't', object: 'tasks', externalId: 'x' }),
    ).rejects.toBeInstanceOf(LiveSurfaceDeniedError);
  });
});

describe('CGD-002 HubSpot read/sync/OAuth-refresh quarantine (network stubbed)', () => {
  it('HubSpot GET is denied even with client secret set; fetch and token never run', async () => {
    process.env.HUBSPOT_CLIENT_SECRET = 'hs-secret-not-consent';
    vi.stubEnv('HUBSPOT_CLIENT_SECRET', 'hs-secret-not-consent');
    let fetches = 0;
    let tokens = 0;
    const fetch: HttpFetch = async () => {
      fetches += 1;
      throw new Error('CGD-002 packet failed: network was used');
    };
    const client = new HttpHubspotClient({
      token: {
        getAccessToken: async () => {
          tokens += 1;
          throw new Error('CGD-002 packet failed: token fetched before gate');
        },
      },
      fetch,
    });
    await expect(client.listCompanies({ tenantId: 't1' })).rejects.toMatchObject({
      name: 'LiveSurfaceDeniedError',
      code: LIVE_SURFACE_DENIED,
      outbound: false,
      inboundVendor: false,
      surface: 'hubspotRead',
    });
    await expect(client.listContacts({ tenantId: 't1' })).rejects.toBeInstanceOf(
      LiveSurfaceDeniedError,
    );
    await expect(client.listDeals({ tenantId: 't1' })).rejects.toBeInstanceOf(
      LiveSurfaceDeniedError,
    );
    await expect(
      client.listObjectProperties({ tenantId: 't1', object: 'tasks' }),
    ).rejects.toMatchObject({ code: LIVE_SURFACE_DENIED, surface: 'hubspotRead' });
    expect(fetches).toBe(0);
    expect(tokens).toBe(0);
  });

  it('OAuth refresh is denied even with secrets set; fetch is never called', async () => {
    process.env.HUBSPOT_CLIENT_SECRET = 'hs-secret-not-consent';
    vi.stubEnv('HUBSPOT_CLIENT_SECRET', 'hs-secret-not-consent');
    let fetches = 0;
    const repo = new InMemoryRepository();
    repo.seedIntegrationConnection({
      id: 'conn-1',
      tenant_id: '11111111-1111-1111-1111-111111111111',
      external_system: 'hubspot',
      status: 'active',
      credential_ref: 'cred-ref-1',
      metadata: {},
      created_at: '2026-06-06T00:00:00.000Z',
      updated_at: '2026-06-06T00:00:00.000Z',
    });
    const secrets = new InMemorySecretStore();
    await secrets.put('cred-ref-1', {
      accessToken: 'old-token',
      refreshToken: 'refresh-token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      expiresAt: new Date(1_700_000_000_000 - 1000).toISOString(),
    });
    const fetch: HttpFetch = async () => {
      fetches += 1;
      throw new Error('CGD-002 packet failed: network was used');
    };
    const provider = new ConnectionTokenProvider({
      repo,
      secrets,
      fetch,
      now: () => 1_700_000_000_000,
    });
    await expect(
      provider.getAccessToken('11111111-1111-1111-1111-111111111111'),
    ).rejects.toMatchObject({
      name: 'LiveSurfaceDeniedError',
      code: LIVE_SURFACE_DENIED,
      outbound: false,
      inboundVendor: false,
      surface: 'hubspotOAuthRefresh',
    });
    expect(fetches).toBe(0);
  });

  it('live HubspotSyncService is denied before paging the HTTP client', async () => {
    let fetches = 0;
    let tokens = 0;
    const client = new HttpHubspotClient({
      token: {
        getAccessToken: async () => {
          tokens += 1;
          throw new Error('CGD-002 packet failed: token fetched before gate');
        },
      },
      fetch: async () => {
        fetches += 1;
        throw new Error('CGD-002 packet failed: network was used');
      },
    });
    const svc = new HubspotSyncService(new InMemoryRepository(), client);
    await expect(svc.sync({ tenantId: 't1', traceId: 'tr-1' })).rejects.toMatchObject({
      code: LIVE_SURFACE_DENIED,
      outbound: false,
      inboundVendor: false,
      surface: 'hubspotRead',
    });
    expect(fetches).toBe(0);
    expect(tokens).toBe(0);
  });

  it('FakeHubspotClient sync still works without read flags (liveOutbound=false)', async () => {
    const repo = new InMemoryRepository();
    const client = new FakeHubspotClient();
    client.companies = [{ externalId: 'co-1', name: 'Acme' }];
    const svc = new HubspotSyncService(repo, client);
    const summary = await svc.sync({
      tenantId: '11111111-1111-1111-1111-111111111111',
      traceId: 'fix-1',
    });
    expect(summary.companies.created).toBe(1);
  });

  it('Salesforce read is denied even with client secret set; no client constructed', async () => {
    process.env.SALESFORCE_CLIENT_SECRET = 'sf-secret-not-consent';
    vi.stubEnv('SALESFORCE_CLIENT_SECRET', 'sf-secret-not-consent');
    await expect(
      executeSalesforceRead({ operation: 'query', query: { soql: 'SELECT Id FROM Account' } }),
    ).rejects.toMatchObject({
      name: 'LiveSurfaceDeniedError',
      code: LIVE_SURFACE_DENIED,
      outbound: false,
      inboundVendor: false,
      surface: 'salesforceRead',
    });
  });

  it('HubspotProvider.sync and .read are denied before unimplemented body', async () => {
    const provider = new HubspotProvider();
    const conn = { tenantId: 't', connectionId: 'c', credentialRef: 'r' };
    await expect(provider.sync(conn)).rejects.toMatchObject({
      code: LIVE_SURFACE_DENIED,
      outbound: false,
      inboundVendor: false,
      surface: 'hubspotRead',
    });
    await expect(provider.read(conn, { id: 'x' })).rejects.toMatchObject({
      code: LIVE_SURFACE_DENIED,
      surface: 'hubspotRead',
    });
  });

  it('write flag does not authorize HubSpot GET', async () => {
    vi.stubEnv('LIVE_OUTBOUND_EXPLICITLY_ALLOWED', 'true');
    vi.stubEnv('LIVE_OUTBOUND_HUBSPOT', 'true');
    const client = new HttpHubspotClient({
      token: { getAccessToken: async () => 'tok' },
      fetch: explodingFetch(),
    });
    await expect(client.listCompanies({ tenantId: 't1' })).rejects.toMatchObject({
      code: LIVE_SURFACE_DENIED,
      surface: 'hubspotRead',
    });
  });
});
