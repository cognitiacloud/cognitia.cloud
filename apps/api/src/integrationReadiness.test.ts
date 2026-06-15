import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type IntegrationConnectionRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient, REQUIRED_ENGAGEMENT_PROPERTIES } from '@cognitia/integrations';
import { ApiHandlers } from './handlers.js';

/**
 * RDY-1 — connection readiness endpoint. Verifies the go-live gate end to end:
 * ready only when the connection is active AND the portal has every required
 * property; 409 (not 200) when misconfigured; 503 when no read client exists.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

function connection(status: string): IntegrationConnectionRow {
  return {
    id: 'conn-1',
    tenant_id: TENANT,
    external_system: 'hubspot',
    status,
    credential_ref: 'cred-1',
    metadata: {},
    created_at: ts,
    updated_at: ts,
  };
}

function handlersWith(
  client: FakeHubspotClient | undefined,
  connStatus?: string,
): {
  handlers: ApiHandlers;
  repo: InMemoryRepository;
} {
  const repo = new InMemoryRepository();
  if (connStatus) repo.seedIntegrationConnection(connection(connStatus));
  const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }), {
    hubspotClient: client,
  });
  return { handlers, repo };
}

describe('GET /integrations/readiness (RDY-1)', () => {
  let client: FakeHubspotClient;
  beforeEach(() => {
    client = new FakeHubspotClient(); // defaults to all required properties present
  });

  it('200 + ready when connection active and portal fully configured', async () => {
    const { handlers } = handlersWith(client, 'active');
    const res = await handlers.integrationReadiness({ tenantId: TENANT, role: 'viewer' });
    expect(res.status).toBe(200);
    expect((res.body as { ready: boolean }).ready).toBe(true);
  });

  it('409 + named missing property when the portal is misconfigured', async () => {
    client.objectProperties = {
      tasks: [...REQUIRED_ENGAGEMENT_PROPERTIES],
      notes: REQUIRED_ENGAGEMENT_PROPERTIES.filter((p) => p !== 'cognitia_evidence_count'),
    };
    const { handlers } = handlersWith(client, 'active');
    const res = await handlers.integrationReadiness({ tenantId: TENANT });
    expect(res.status).toBe(409);
    const body = res.body as { ready: boolean; missing_properties: { notes: string[] } };
    expect(body.ready).toBe(false);
    expect(body.missing_properties.notes).toContain('cognitia_evidence_count');
  });

  it('409 when there is no connection row (not_connected)', async () => {
    const { handlers } = handlersWith(client); // no connection seeded
    const res = await handlers.integrationReadiness({ tenantId: TENANT });
    expect(res.status).toBe(409);
    expect((res.body as { connection_status: string }).connection_status).toBe('not_connected');
  });

  it('503 with a clear reason when no read client is configured (dev)', async () => {
    const { handlers } = handlersWith(undefined, 'active');
    const res = await handlers.integrationReadiness({ tenantId: TENANT });
    expect(res.status).toBe(503);
    expect((res.body as { ready: boolean; reason: string }).ready).toBe(false);
    expect((res.body as { reason: string }).reason).toContain('no HubSpot read client');
  });

  it('requires auth (401 without a principal)', async () => {
    const { handlers } = handlersWith(client, 'active');
    await expect(handlers.integrationReadiness({})).rejects.toMatchObject({ status: 401 });
  });
});
