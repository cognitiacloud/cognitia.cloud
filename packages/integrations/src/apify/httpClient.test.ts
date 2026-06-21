import { describe, it, expect } from 'vitest';
import {
  HttpApifyClient,
  ApifyHttpError,
  type ApifyHttpFetch,
  type ApifyHttpResponse,
} from './httpClient.js';

function jsonResponse(status: number, body: unknown): ApifyHttpResponse {
  return {
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

const TOKEN = 'SECRET-TOKEN-do-not-leak';
const sleep = async () => {};

describe('HttpApifyClient.listDatasetItems — hard max-items clamp', () => {
  it('stops paginating at the requested limit across pages', async () => {
    const big = Array.from({ length: 1000 }, (_, i) => ({ i }));
    const calls: Array<{ offset: number; limit: number }> = [];
    const fetch: ApifyHttpFetch = async (url) => {
      const u = new URL(url);
      const offset = Number(u.searchParams.get('offset'));
      const limit = Number(u.searchParams.get('limit'));
      calls.push({ offset, limit });
      return jsonResponse(200, big.slice(offset, offset + limit));
    };
    const client = new HttpApifyClient({ token: TOKEN, fetch, pageLimit: 10, sleep });

    const items = await client.listDatasetItems('ds-1', { limit: 25 });
    expect(items).toHaveLength(25);
    // pages of 10, 10, 5 — never fetches beyond the cap
    expect(calls).toEqual([
      { offset: 0, limit: 10 },
      { offset: 10, limit: 10 },
      { offset: 20, limit: 5 },
    ]);
  });
});

describe('HttpApifyClient.runActor — lifecycle', () => {
  it('starts → polls to SUCCEEDED → returns capped dataset items', async () => {
    const dataset = Array.from({ length: 100 }, (_, i) => ({ i }));
    let polls = 0;
    const fetch: ApifyHttpFetch = async (url, init) => {
      const u = new URL(url);
      if (init?.method === 'POST') return jsonResponse(201, { data: { id: 'run-1' } });
      if (u.pathname.endsWith('/actor-runs/run-1')) {
        polls += 1;
        const status = polls < 2 ? 'RUNNING' : 'SUCCEEDED';
        return jsonResponse(200, { data: { status, defaultDatasetId: 'ds-1', startedAt: 't0' } });
      }
      // dataset items
      const offset = Number(u.searchParams.get('offset'));
      const limit = Number(u.searchParams.get('limit'));
      return jsonResponse(200, dataset.slice(offset, offset + limit));
    };
    const client = new HttpApifyClient({ token: TOKEN, fetch, sleep, pollIntervalMs: 0 });

    const run = await client.runActor({
      actorId: 'apify/website-content-crawler',
      input: {},
      maxItems: 25,
      timeoutMs: 10_000,
    });
    expect(run.status).toBe('SUCCEEDED');
    expect(run.itemCount).toBe(25);
    expect(run.datasetItems).toHaveLength(25);
  });

  it('returns FAILED (and no items) when the run fails', async () => {
    const fetch: ApifyHttpFetch = async (url, init) => {
      if (init?.method === 'POST') return jsonResponse(201, { data: { id: 'run-1' } });
      const u = new URL(url);
      if (u.pathname.endsWith('/actor-runs/run-1')) {
        return jsonResponse(200, { data: { status: 'FAILED', defaultDatasetId: 'ds-1' } });
      }
      return jsonResponse(200, []);
    };
    const client = new HttpApifyClient({ token: TOKEN, fetch, sleep, pollIntervalMs: 0 });
    const run = await client.runActor({
      actorId: 'apify/website-content-crawler',
      input: {},
      maxItems: 25,
      timeoutMs: 10_000,
    });
    expect(run.status).toBe('FAILED');
    expect(run.itemCount).toBe(0);
  });

  it('never includes the token in error messages', async () => {
    const fetch: ApifyHttpFetch = async () => jsonResponse(500, 'upstream boom');
    const client = new HttpApifyClient({ token: TOKEN, fetch, sleep });
    let caught: unknown;
    try {
      await client.runActor({
        actorId: 'apify/website-content-crawler',
        input: {},
        maxItems: 5,
        timeoutMs: 1000,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApifyHttpError);
    expect((caught as Error).message).not.toContain(TOKEN);
    expect((caught as Error).message).toContain('500');
  });
});
