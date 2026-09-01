import { describe, it, expect, afterEach, vi } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { LIVE_SURFACE_DENIED } from '@cognitia/core';
import { FakeHubspotClient, HttpHubspotClient, type HttpFetch } from '@cognitia/integrations';
import { crmSyncJob } from './crmSync.js';

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.HUBSPOT_CLIENT_SECRET;
});

describe('CGD-002 crm-sync inbound read quarantine', () => {
  it('denies live HttpHubspotClient before fetch/token even with secrets set', async () => {
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
    const job = crmSyncJob({
      repo: new InMemoryRepository(),
      client,
      tenantId: '11111111-1111-1111-1111-111111111111',
    });
    await expect(job.run()).rejects.toMatchObject({
      code: LIVE_SURFACE_DENIED,
      outbound: false,
      inboundVendor: false,
      surface: 'hubspotRead',
    });
    expect(fetches).toBe(0);
    expect(tokens).toBe(0);
  });

  it('fixture FakeHubspotClient still syncs without the read flag', async () => {
    const repo = new InMemoryRepository();
    const client = new FakeHubspotClient();
    client.companies = [{ externalId: 'co-1', name: 'Acme' }];
    const job = crmSyncJob({
      repo,
      client,
      tenantId: '11111111-1111-1111-1111-111111111111',
    });
    await job.run();
    expect(await repo.listAccounts('11111111-1111-1111-1111-111111111111')).toHaveLength(1);
  });
});
