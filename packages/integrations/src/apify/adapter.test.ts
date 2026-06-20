import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { InMemoryRepository } from '@cognitia/db';
import type { CloserSourceRow } from '@cognitia/db';
import type { ApifySourceRisk } from './types.js';
import { ApifyAdapter } from './adapter.js';
import { FakeApifyClient } from './client.js';
import { HttpApifyClient, type ApifyHttpFetch } from './httpClient.js';
import { fixtureApifyConfig } from './config.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const WEBSITE = 'apify/website-content-crawler';
const MAPS = 'apify/google-places-scraper';

function ts(): string {
  return new Date().toISOString();
}

async function seedSource(
  repo: InMemoryRepository,
  over: Partial<CloserSourceRow> = {},
): Promise<CloserSourceRow> {
  const row: CloserSourceRow = {
    id: randomUUID(),
    tenant_id: TENANT,
    label: 'Test source',
    apify_actor_id: WEBSITE,
    input: {},
    source_risk: 'safe_public_website_crawl',
    max_results: 50,
    schedule: null,
    active: true,
    created_at: ts(),
    updated_at: ts(),
    ...over,
  };
  return repo.createCloserSource(row);
}

/** A live client whose fetch throws if ever called — proves no network. */
function throwingLiveClient(): { client: HttpApifyClient; calledRef: { called: boolean } } {
  const calledRef = { called: false };
  const fetch: ApifyHttpFetch = async () => {
    calledRef.called = true;
    throw new Error('network must not be called');
  };
  return { client: new HttpApifyClient({ token: 'unused', fetch }), calledRef };
}

describe('ApifyAdapter.ingest — fixture mode (default, no network)', () => {
  it('succeeds without APIFY_TOKEN and stages redacted records', async () => {
    const repo = new InMemoryRepository();
    const source = await seedSource(repo);
    const { client, calledRef } = throwingLiveClient();
    const adapter = new ApifyAdapter({
      repo,
      config: fixtureApifyConfig(), // no token, allowNetwork false
      liveClient: client,
    });

    const summary = await adapter.ingest({
      tenantId: TENANT,
      sourceId: source.id,
      actorId: WEBSITE,
      requestedBy: 'user:test',
    });

    expect(summary.mode).toBe('fixture');
    expect(summary.status).toBe('succeeded');
    expect(summary.read).toBeGreaterThan(0);
    expect(summary.inserted).toBeGreaterThan(0);
    expect(calledRef.called).toBe(false); // never touched the network

    const run = await repo.getCloserScrapeRun(TENANT, summary.scrapeRunId);
    expect(run?.status).toBe('succeeded');
    expect(run?.accounts_upserted).toBe(summary.inserted);

    // No outreach / no downstream actions / no briefs created.
    expect(await repo.listAgentActions(TENANT)).toHaveLength(0);
  });

  it('skips duplicate records within a run (idempotent staging)', async () => {
    const repo = new InMemoryRepository();
    const source = await seedSource(repo, {
      apify_actor_id: MAPS,
      source_risk: 'legal_review_required',
    });
    const adapter = new ApifyAdapter({ repo, config: fixtureApifyConfig() });

    const summary = await adapter.ingest({
      tenantId: TENANT,
      sourceId: source.id,
      actorId: MAPS,
      requestedBy: 'user:test',
      humanReviewApproved: true,
    });
    // maps fixture has 3 rows, two share the acmetoyota.example domain.
    expect(summary.read).toBe(3);
    expect(summary.inserted).toBe(2);
    expect(summary.duplicates).toBe(1);
    expect(summary.redacted).toBeGreaterThan(0);
  });

  it('clamps to the effective max-items in the mock client path', async () => {
    const repo = new InMemoryRepository();
    const source = await seedSource(repo);
    const adapter = new ApifyAdapter({ repo, config: fixtureApifyConfig({ maxItems: 1 }) });

    const summary = await adapter.ingest({
      tenantId: TENANT,
      sourceId: source.id,
      actorId: WEBSITE,
      requestedBy: 'user:test',
    });
    expect(summary.read).toBe(1);
  });

  it('marks the scrape run failed on a failed actor run (sanitized reason)', async () => {
    const repo = new InMemoryRepository();
    const source = await seedSource(repo);
    const adapter = new ApifyAdapter({
      repo,
      config: fixtureApifyConfig(),
      fixtureClient: new FakeApifyClient({ failRun: true }),
    });

    const summary = await adapter.ingest({
      tenantId: TENANT,
      sourceId: source.id,
      actorId: WEBSITE,
      requestedBy: 'user:test',
    });
    expect(summary.status).toBe('failed');
    expect(summary.reason).toBe('actor_run_failed');
    const run = await repo.getCloserScrapeRun(TENANT, summary.scrapeRunId);
    expect(run?.status).toBe('failed');
    expect(run?.error).toBe('actor_run_failed');
  });
});

describe('ApifyAdapter.ingest — policy blocks (no network, sanitized reasons)', () => {
  it('blocks an unknown actor', async () => {
    const repo = new InMemoryRepository();
    const source = await seedSource(repo);
    const adapter = new ApifyAdapter({ repo, config: fixtureApifyConfig() });
    const summary = await adapter.ingest({
      tenantId: TENANT,
      sourceId: source.id,
      actorId: 'apify/not-allowlisted',
      requestedBy: 'user:test',
    });
    expect(summary.status).toBe('failed');
    expect(summary.reason).toBe('unknown_actor');
  });

  it('blocks a disallowed source (no scrape run created)', async () => {
    const repo = new InMemoryRepository();
    const source = await seedSource(repo, { active: false, source_risk: 'disallowed' });
    const adapter = new ApifyAdapter({ repo, config: fixtureApifyConfig() });
    const summary = await adapter.ingest({
      tenantId: TENANT,
      sourceId: source.id,
      actorId: WEBSITE,
      requestedBy: 'user:test',
    });
    expect(summary.status).toBe('failed');
    expect(summary.reason).toBe('blocked_by_policy:disallowed');
    expect(summary.scrapeRunId).toBe('');
  });

  it('requires humanReviewApproved for a legal_review_required source', async () => {
    const repo = new InMemoryRepository();
    const source = await seedSource(repo, { source_risk: 'legal_review_required' });
    const adapter = new ApifyAdapter({ repo, config: fixtureApifyConfig() });

    const blocked = await adapter.ingest({
      tenantId: TENANT,
      sourceId: source.id,
      actorId: WEBSITE,
      requestedBy: 'user:test',
    });
    expect(blocked.reason).toBe('human_review_required');

    const ok = await adapter.ingest({
      tenantId: TENANT,
      sourceId: source.id,
      actorId: WEBSITE,
      requestedBy: 'user:test',
      humanReviewApproved: true,
    });
    expect(ok.status).toBe('succeeded');
  });
});

describe('ApifyAdapter.ingest — live mode is hard-gated (still no network here)', () => {
  const liveRequest = (sourceId: string) => ({
    tenantId: TENANT,
    sourceId,
    actorId: WEBSITE,
    requestedBy: 'user:test',
    fixtureMode: false as const,
  });

  it('blocks live without allow-network (never calls fetch)', async () => {
    const repo = new InMemoryRepository();
    const source = await seedSource(repo);
    const { client, calledRef } = throwingLiveClient();
    const adapter = new ApifyAdapter({
      repo,
      config: fixtureApifyConfig({ token: 'present-but-network-off', allowNetwork: false }),
      liveClient: client,
    });
    const summary = await adapter.ingest(liveRequest(source.id));
    expect(summary.status).toBe('failed');
    expect(summary.reason).toBe('network_not_allowed');
    expect(calledRef.called).toBe(false);
  });

  it('blocks live without a token (never calls fetch)', async () => {
    const repo = new InMemoryRepository();
    const source = await seedSource(repo);
    const { client, calledRef } = throwingLiveClient();
    const adapter = new ApifyAdapter({
      repo,
      config: fixtureApifyConfig({ allowNetwork: true, token: undefined }),
      liveClient: client,
    });
    const summary = await adapter.ingest(liveRequest(source.id));
    expect(summary.status).toBe('failed');
    expect(summary.reason).toBe('missing_token');
    expect(calledRef.called).toBe(false);
  });
});
