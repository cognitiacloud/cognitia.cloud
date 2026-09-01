import { describe, it, expect, afterEach, vi } from 'vitest';
import { LIVE_SURFACE_DENIED, LiveSurfaceDeniedError, readLiveOutboundFlags } from '@cognitia/core';
import {
  HttpHubspotClient,
  HubspotProvider,
  executeSalesforceWrite,
  executeWebhookOutboundSideEffect,
  type HttpFetch,
} from './index.js';

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
