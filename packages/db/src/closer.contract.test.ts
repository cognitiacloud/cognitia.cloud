import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { InMemoryRepository } from './memory.js';
import type {
  CloserSourceRow,
  CloserScrapeRunRow,
  CloserRawRecordRow,
  CloserAccountProfileRow,
  CloserBriefRow,
} from './repository.js';

/**
 * Sales Closer repository contract (Phase 1) against InMemoryRepository — the
 * same invariants the Kysely+RLS path enforces in Postgres: tenant isolation,
 * idempotent raw ingest, 1:1 profile upsert, brief status transitions, and the
 * source-risk safety guards (disallowed never active / never runs).
 */

const ACME = '11111111-1111-1111-1111-111111111111';
const GLOBEX = '22222222-2222-2222-2222-222222222222';
const ACME_ACCOUNT = 'a1000000-0000-4000-8000-000000000001';

function ts(): string {
  return new Date().toISOString();
}

function source(tenantId: string, over: Partial<CloserSourceRow> = {}): CloserSourceRow {
  return {
    id: randomUUID(),
    tenant_id: tenantId,
    label: 'Website crawl',
    apify_actor_id: 'apify/website-content-crawler',
    input: { startUrls: [{ url: 'https://targeta.com' }] },
    source_risk: 'safe_public_website_crawl',
    max_results: 50,
    schedule: null,
    active: true,
    created_at: ts(),
    updated_at: ts(),
    ...over,
  };
}

function scrapeRun(tenantId: string, over: Partial<CloserScrapeRunRow> = {}): CloserScrapeRunRow {
  return {
    id: randomUUID(),
    tenant_id: tenantId,
    agent_run_id: randomUUID(),
    source_id: null,
    apify_run_id: null,
    dataset_id: null,
    source_risk: 'safe_public_website_crawl',
    status: 'queued',
    stage: 'run_actor',
    rows_in: 0,
    accounts_upserted: 0,
    contacts_upserted: 0,
    error: null,
    created_at: ts(),
    updated_at: ts(),
    ...over,
  };
}

function rawRecord(
  tenantId: string,
  scrapeRunId: string,
  dedupeKey: string,
  over: Partial<CloserRawRecordRow> = {},
): CloserRawRecordRow {
  return {
    id: randomUUID(),
    tenant_id: tenantId,
    scrape_run_id: scrapeRunId,
    payload: { url: `https://${dedupeKey}` },
    normalized: { domain: dedupeKey },
    dedupe_key: dedupeKey,
    account_id: null,
    created_at: ts(),
    ...over,
  };
}

function profile(
  tenantId: string,
  accountId: string,
  over: Partial<CloserAccountProfileRow> = {},
): CloserAccountProfileRow {
  return {
    id: randomUUID(),
    tenant_id: tenantId,
    account_id: accountId,
    tier: 'B',
    score: 72,
    dimensions: { fit: 0.8, intent: 0.6, timing: 0.7, reachability: 0.65 },
    rationale: 'Strong fit.',
    model: 'mock',
    crm_vendor: 'DealerSocket',
    monthly_lead_volume: 220,
    rooftops: 3,
    oem_brands: ['Toyota'],
    funnel_audit: {},
    scored_at: ts(),
    created_at: ts(),
    updated_at: ts(),
    ...over,
  };
}

function brief(
  tenantId: string,
  accountId: string,
  over: Partial<CloserBriefRow> = {},
): CloserBriefRow {
  return {
    id: randomUUID(),
    tenant_id: tenantId,
    account_id: accountId,
    agent_run_id: null,
    model: 'mock',
    content_md: '# Brief',
    structured: { pains: ['Slow lead response'] },
    claims: [
      { text: 'Operates 3 rooftops', evidence_tag: 'verified_fact', evidence_ref: 'signal:x' },
    ],
    status: 'draft',
    created_at: ts(),
    updated_at: ts(),
    ...over,
  };
}

describe('closer sources', () => {
  it('isolates sources by tenant', async () => {
    const repo = new InMemoryRepository();
    await repo.createCloserSource(source(ACME));
    await repo.createCloserSource(source(GLOBEX));
    expect(await repo.listCloserSources(ACME)).toHaveLength(1);
    expect(await repo.listCloserSources(GLOBEX)).toHaveLength(1);
    expect((await repo.listCloserSources(ACME))[0]!.tenant_id).toBe(ACME);
  });

  it('rejects an active disallowed source on create and on update', async () => {
    const repo = new InMemoryRepository();
    await expect(
      repo.createCloserSource(source(ACME, { source_risk: 'disallowed', active: true })),
    ).rejects.toThrow(/disallowed/i);

    const ok = await repo.createCloserSource(
      source(ACME, { source_risk: 'disallowed', active: false }),
    );
    await expect(repo.updateCloserSource(ACME, ok.id, { active: true })).rejects.toThrow(
      /disallowed/i,
    );
  });
});

describe('closer scrape runs', () => {
  it('records status/stage transitions and never runs a disallowed source', async () => {
    const repo = new InMemoryRepository();
    const run = await repo.createCloserScrapeRun(scrapeRun(ACME));
    const updated = await repo.updateCloserScrapeRun(ACME, run.id, {
      status: 'succeeded',
      stage: 'brief',
      rows_in: 10,
    });
    expect(updated?.status).toBe('succeeded');
    expect(updated?.stage).toBe('brief');
    expect(updated?.rows_in).toBe(10);

    await expect(
      repo.createCloserScrapeRun(scrapeRun(ACME, { source_risk: 'disallowed' as never })),
    ).rejects.toThrow(/disallowed/i);
  });
});

describe('closer raw records', () => {
  it('is idempotent on (tenant, run, dedupe_key)', async () => {
    const repo = new InMemoryRepository();
    const runId = randomUUID();
    const first = await repo.insertCloserRawRecords([
      rawRecord(ACME, runId, 'targeta.com'),
      rawRecord(ACME, runId, 'targetb.com'),
    ]);
    expect(first).toEqual({ inserted: 2, skipped: 0 });

    const second = await repo.insertCloserRawRecords([rawRecord(ACME, runId, 'targeta.com')]);
    expect(second).toEqual({ inserted: 0, skipped: 1 });

    expect(await repo.listCloserRawRecordsByRun(ACME, runId)).toHaveLength(2);
  });

  it('links a staged row to its account', async () => {
    const repo = new InMemoryRepository();
    const runId = randomUUID();
    const row = rawRecord(ACME, runId, 'targeta.com');
    await repo.insertCloserRawRecords([row]);
    const linked = await repo.linkCloserRawRecordToAccount(ACME, row.id, ACME_ACCOUNT);
    expect(linked?.account_id).toBe(ACME_ACCOUNT);
  });
});

describe('closer account profiles', () => {
  it('upserts 1:1 per account', async () => {
    const repo = new InMemoryRepository();
    await repo.upsertCloserAccountProfile(profile(ACME, ACME_ACCOUNT, { tier: 'C', score: 40 }));
    await repo.upsertCloserAccountProfile(profile(ACME, ACME_ACCOUNT, { tier: 'A', score: 90 }));
    const all = await repo.listCloserAccountProfiles(ACME);
    expect(all).toHaveLength(1);
    expect(all[0]!.tier).toBe('A');
    expect(all[0]!.score).toBe(90);
  });

  it('filters by tier and isolates by tenant', async () => {
    const repo = new InMemoryRepository();
    await repo.upsertCloserAccountProfile(profile(ACME, ACME_ACCOUNT, { tier: 'A' }));
    await repo.upsertCloserAccountProfile(profile(GLOBEX, 'b1000000-0000-4000-8000-000000000001'));
    expect(await repo.listCloserAccountProfiles(ACME, { tier: 'A' })).toHaveLength(1);
    expect(await repo.listCloserAccountProfiles(ACME, { tier: 'D' })).toHaveLength(0);
    expect(await repo.getCloserAccountProfile(GLOBEX, ACME_ACCOUNT)).toBeNull();
  });
});

describe('closer briefs', () => {
  it('transitions draft → approved → sent', async () => {
    const repo = new InMemoryRepository();
    const b = await repo.createCloserBrief(brief(ACME, ACME_ACCOUNT));
    expect(b.status).toBe('draft');
    expect((await repo.updateCloserBriefStatus(ACME, b.id, 'approved'))?.status).toBe('approved');
    expect((await repo.updateCloserBriefStatus(ACME, b.id, 'sent'))?.status).toBe('sent');
    expect(await repo.listCloserBriefsByAccount(ACME, ACME_ACCOUNT)).toHaveLength(1);
  });

  it('does not leak briefs across tenants', async () => {
    const repo = new InMemoryRepository();
    const b = await repo.createCloserBrief(brief(ACME, ACME_ACCOUNT));
    expect(await repo.getCloserBrief(GLOBEX, b.id)).toBeNull();
  });
});
