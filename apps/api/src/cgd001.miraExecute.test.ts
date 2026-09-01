import { describe, it, expect, afterEach, vi } from 'vitest';
import { InMemoryRepository, type AccountRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { LIVE_SURFACE_DENIED, LiveSurfaceDeniedError } from '@cognitia/core';
import { HttpHubspotClient, type HttpFetch } from '@cognitia/integrations';
import { ApiHandlers } from './handlers.js';

/**
 * CGD-001: Mira CRM action execution against a live HTTP client is
 * deny-by-default even when HubSpot secrets are set. Network must not be used.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.HUBSPOT_CLIENT_SECRET;
});

describe('CGD-001 Mira live execute denied', () => {
  it('approved CRM execute is LIVE_SURFACE_DENIED; fetch and token never run', async () => {
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

    const repo = new InMemoryRepository();
    repo.seedAccount({
      id: 'acc-1',
      tenant_id: TENANT,
      name: 'Acme',
      domain: 'acme.com',
      industry: 'SaaS',
      employee_count: 100,
      region: 'NA',
      fit_score: 0.9,
      timing_score: 0.8,
      attributes: {},
      created_at: ts,
      updated_at: ts,
    } satisfies AccountRow);

    const services = createGtmServices({ repo, v1Mode: true, hubspotClient: client });
    const handlers = new ApiHandlers(repo, services);

    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    const actionId = (
      list.body as { actions: Array<{ id: string; action_type: string }> }
    ).actions.find((a) => a.action_type === 'crm.task.create')!.id;

    await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: { reason: { reason_code: 'meets_playbook' } },
    });

    const res = await handlers.executeAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
    });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: LIVE_SURFACE_DENIED,
      code: LIVE_SURFACE_DENIED,
      outbound: false,
    });
    expect(fetches).toBe(0);
    expect(tokens).toBe(0);

    await expect(services.ledger.execute(TENANT, actionId)).rejects.toBeInstanceOf(
      LiveSurfaceDeniedError,
    );
    expect(fetches).toBe(0);
    expect(tokens).toBe(0);
  });
});
