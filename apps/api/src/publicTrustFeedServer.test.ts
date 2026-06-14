import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers } from './handlers.js';
import { buildServer } from './server.js';

/**
 * V-5 — server-level integration for the public trust feed route:
 *   - Cache-Control header is emitted on the (unauthenticated) feed;
 *   - the secondary in-process rate limiter returns 429 past the limit, with a
 *     Retry-After header and NO internal/DB details in the body;
 *   - the route stays read-only (no write verbs accepted).
 */

const RATE_KEY = 'COGNITIA_PUBLIC_FEED_RATE_LIMIT';
const WINDOW_KEY = 'COGNITIA_PUBLIC_FEED_RATE_WINDOW_SEC';
const TENANT_KEY = 'COGNITIA_PUBLIC_TENANT_ID';

function makeApp() {
  const repo = new InMemoryRepository();
  const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  return buildServer(handlers); // no verifier needed; public route is unauthenticated
}

beforeEach(() => {
  delete process.env[RATE_KEY];
  delete process.env[WINDOW_KEY];
  delete process.env[TENANT_KEY];
});
afterEach(() => {
  delete process.env[RATE_KEY];
  delete process.env[WINDOW_KEY];
  delete process.env[TENANT_KEY];
});

describe('GET /public/trust-feed — V-5 server behavior', () => {
  it('returns 200 with a Cache-Control header even when unconfigured', async () => {
    const app = makeApp();
    const res = await app.inject({ method: 'GET', url: '/public/trust-feed' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=60');
    const body = res.json() as { configured: boolean };
    expect(body.configured).toBe(false);
    await app.close();
  });

  it('rate-limits past the configured limit with 429 + Retry-After, no internals leaked', async () => {
    process.env[RATE_KEY] = '2';
    process.env[WINDOW_KEY] = '60';
    const app = makeApp();
    const url = '/public/trust-feed';
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(200);
    const limited = await app.inject({ method: 'GET', url });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.headers['x-ratelimit-limit']).toBe('2');
    const body = limited.json() as Record<string, unknown>;
    expect(body.error).toBe('rate limited');
    // No DB/stack internals.
    expect(JSON.stringify(body)).not.toMatch(/relation|postgres|5432|stack|at Object/i);
    await app.close();
  });

  it('does not rate-limit when disabled (limit=0)', async () => {
    process.env[RATE_KEY] = '0';
    const app = makeApp();
    for (let i = 0; i < 5; i++) {
      expect((await app.inject({ method: 'GET', url: '/public/trust-feed' })).statusCode).toBe(200);
    }
    await app.close();
  });

  it('stays read-only: POST/PUT/DELETE are not accepted on the public feed', async () => {
    const app = makeApp();
    for (const method of ['POST', 'PUT', 'DELETE'] as const) {
      const res = await app.inject({ method, url: '/public/trust-feed' });
      expect(res.statusCode).toBe(404); // no such route/verb registered
    }
    await app.close();
  });
});
