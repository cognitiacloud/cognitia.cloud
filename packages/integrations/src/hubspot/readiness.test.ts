import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LIVE_SURFACE_DENIED } from '@cognitia/core';
import { FakeHubspotClient } from './client.js';
import { HttpHubspotClient, type HttpFetch, type HttpResponse } from './httpClient.js';
import { checkHubspotReadiness } from './readiness.js';
import { REQUIRED_ENGAGEMENT_PROPERTIES } from './writePlan.js';

/**
 * RDY-1 — connection readiness gate. The point: catch a misconfigured portal
 * (missing required custom properties, inactive connection) BEFORE the first
 * live write, with the exact missing properties named.
 */

const TENANT = 't-1';
const allPresent = [...REQUIRED_ENGAGEMENT_PROPERTIES];

describe('checkHubspotReadiness', () => {
  it('is ready when the connection is active and all required properties exist', async () => {
    const client = new FakeHubspotClient(); // defaults to all-present
    const r = await checkHubspotReadiness(client, { tenantId: TENANT, connectionStatus: 'active' });
    expect(r.ready).toBe(true);
    expect(r.missing_properties).toEqual({ tasks: [], notes: [] });
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });

  it('is NOT ready and names the missing property when a provenance prop is absent on notes', async () => {
    const client = new FakeHubspotClient();
    client.objectProperties = {
      tasks: allPresent,
      notes: allPresent.filter((p) => p !== 'cognitia_approved_by'),
    };
    const r = await checkHubspotReadiness(client, { tenantId: TENANT, connectionStatus: 'active' });
    expect(r.ready).toBe(false);
    expect(r.missing_properties.tasks).toEqual([]);
    expect(r.missing_properties.notes).toEqual(['cognitia_approved_by']);
    expect(r.checks.find((c) => c.name === 'properties_notes')?.detail).toContain(
      'cognitia_approved_by',
    );
  });

  it('flags a missing idempotency property (the duplicate-write risk)', async () => {
    const client = new FakeHubspotClient();
    const noIdem = allPresent.filter((p) => p !== 'cognitia_idempotency_key');
    client.objectProperties = { tasks: noIdem, notes: noIdem };
    const r = await checkHubspotReadiness(client, { tenantId: TENANT, connectionStatus: 'active' });
    expect(r.ready).toBe(false);
    expect(r.missing_properties.tasks).toContain('cognitia_idempotency_key');
    expect(r.missing_properties.notes).toContain('cognitia_idempotency_key');
  });

  it('is NOT ready when the connection is not active, even if properties exist', async () => {
    const client = new FakeHubspotClient();
    const paused = await checkHubspotReadiness(client, {
      tenantId: TENANT,
      connectionStatus: 'paused',
    });
    expect(paused.ready).toBe(false);
    expect(paused.checks.find((c) => c.name === 'connection_active')?.ok).toBe(false);

    const notConnected = await checkHubspotReadiness(client, {
      tenantId: TENANT,
      connectionStatus: 'not_connected',
    });
    expect(notConnected.ready).toBe(false);
  });

  it('treats a property-read failure as not-ready with the reason surfaced', async () => {
    const failing: Pick<FakeHubspotClient, 'listObjectProperties'> = {
      async listObjectProperties() {
        throw new Error('401 unauthorized');
      },
    };
    const client = Object.assign(new FakeHubspotClient(), failing);
    const r = await checkHubspotReadiness(client, { tenantId: TENANT, connectionStatus: 'active' });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'properties_tasks')?.detail).toContain('401');
  });
});

describe('HttpHubspotClient.listObjectProperties', () => {
  beforeEach(() => {
    vi.stubEnv('LIVE_OUTBOUND_EXPLICITLY_ALLOWED', 'true');
    vi.stubEnv('LIVE_OUTBOUND_HUBSPOT_READ', 'true');
  });
  afterEach(() => vi.unstubAllEnvs());
  it('reads GET /crm/v3/properties/:object and returns internal names', async () => {
    const calls: string[] = [];
    const fetch: HttpFetch = async (url): Promise<HttpResponse> => {
      calls.push(url);
      return {
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          results: [{ name: 'cognitia_agent' }, { name: 'hs_task_subject' }, { name: '' }],
        }),
        text: async () => '',
      };
    };
    const client = new HttpHubspotClient({ token: { getAccessToken: async () => 'tok' }, fetch });
    const names = await client.listObjectProperties({ tenantId: TENANT, object: 'tasks' });
    expect(calls[0]).toBe('https://api.hubapi.com/crm/v3/properties/tasks');
    expect(names).toEqual(['cognitia_agent', 'hs_task_subject']); // empty names dropped
  });
});

describe('CGD-002 live readiness with read flags off', () => {
  it('returns a not-ready report instead of throwing; fetch and token never run', async () => {
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
    const r = await checkHubspotReadiness(client, {
      tenantId: TENANT,
      connectionStatus: 'paused',
    });
    expect(r.ready).toBe(false);
    expect(r.connection_status).toBe('paused');
    expect(r.checks.find((c) => c.name === 'connection_active')?.ok).toBe(false);
    expect(r.checks.find((c) => c.name === 'properties_tasks')?.ok).toBe(false);
    expect(r.checks.find((c) => c.name === 'properties_tasks')?.detail).toContain(LIVE_SURFACE_DENIED);
    expect(fetches).toBe(0);
    expect(tokens).toBe(0);
  });
});
