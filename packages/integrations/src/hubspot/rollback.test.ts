import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StubHubspotAdapter } from './adapter.js';
import { FakeHubspotClient } from './client.js';
import { HttpHubspotClient, HubspotApiError, type HttpFetch } from './httpClient.js';
import { AdapterRegistry, StubEmailAdapter } from '../index.js';

/**
 * UNDO-1 — rollback plumbing: external_ref parsing, idempotent archive,
 * real DELETE issued by the HTTP client (404 tolerated), and the registry
 * refusing irreversible action types.
 */

describe('StubHubspotAdapter.rollback', () => {
  it('archives the engagement behind an executed external_ref (both ref spellings)', async () => {
    const client = new FakeHubspotClient();
    const adapter = new StubHubspotAdapter(client);
    expect((await adapter.rollback('t-1', 'hubspot:tasks:123')).ok).toBe(true);
    expect((await adapter.rollback('t-1', 'hubspot:note:abc')).ok).toBe(true);
    expect(client.archiveLog).toEqual([
      { object: 'tasks', externalId: '123' },
      { object: 'notes', externalId: 'abc' },
    ]);
  });

  it('is idempotent at the client (re-archive is a no-op)', async () => {
    const client = new FakeHubspotClient();
    const adapter = new StubHubspotAdapter(client);
    await adapter.rollback('t-1', 'hubspot:tasks:123');
    await adapter.rollback('t-1', 'hubspot:tasks:123');
    expect(client.archiveLog).toHaveLength(1);
  });

  it('refuses an unrecognized external_ref', async () => {
    const adapter = new StubHubspotAdapter(new FakeHubspotClient());
    const res = await adapter.rollback('t-1', 'salesforce:task:1');
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('unrecognized');
  });
});

function allowHubspotLiveWrites() {
  vi.stubEnv('LIVE_OUTBOUND_EXPLICITLY_ALLOWED', 'true');
  vi.stubEnv('LIVE_OUTBOUND_HUBSPOT', 'true');
}

describe('HttpHubspotClient.archiveEngagement', () => {
  beforeEach(allowHubspotLiveWrites);
  afterEach(() => vi.unstubAllEnvs());
  const harness = (status: number) => {
    const calls: Array<{ url: string; method?: string }> = [];
    const fetch: HttpFetch = async (url, init) => {
      calls.push({ url, method: init?.method });
      return {
        status,
        headers: { get: () => null },
        json: async () => ({}),
        text: async () => 'gone',
      };
    };
    const client = new HttpHubspotClient({ token: { getAccessToken: async () => 'tok' }, fetch });
    return { calls, client };
  };

  it('issues DELETE /crm/v3/objects/tasks/:id (HubSpot archive)', async () => {
    const { calls, client } = harness(204);
    await client.archiveEngagement({ tenantId: 't-1', object: 'tasks', externalId: 'hs-9' });
    expect(calls[0]).toEqual({
      url: 'https://api.hubapi.com/crm/v3/objects/tasks/hs-9',
      method: 'DELETE',
    });
  });

  it('treats 404 (already archived) as success; other errors propagate', async () => {
    await expect(
      harness(404).client.archiveEngagement({ tenantId: 't', object: 'notes', externalId: 'x' }),
    ).resolves.toBeUndefined();
    await expect(
      harness(403).client.archiveEngagement({ tenantId: 't', object: 'notes', externalId: 'x' }),
    ).rejects.toBeInstanceOf(HubspotApiError);
  });
});

describe('AdapterRegistry.rollback', () => {
  it('refuses irreversible action types (no rollback implementation)', async () => {
    const registry = new AdapterRegistry().register(new StubEmailAdapter());
    const res = await registry.rollback('email.draft.send', 't-1', 'email:msg:1');
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('irreversible');
  });

  it('refuses unknown action types', async () => {
    const registry = new AdapterRegistry();
    const res = await registry.rollback('crm.task.create', 't-1', 'hubspot:tasks:1');
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('no adapter');
  });
});
