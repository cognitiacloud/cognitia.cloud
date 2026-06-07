import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers } from './handlers.js';
import { buildServer } from './server.js';

const SECRET = 'hs-client-secret';
const HOST = 'app.cognitia.cloud';
const URL = '/webhooks/hubspot';
const FULL_URI = `http://${HOST}${URL}`;
const NOW = 1_700_000_000_000;
const payload = JSON.stringify({
  externalId: 'hs-123',
  fullName: 'Ada A',
  emailHash: 'sha256:ada',
});

function sign(body: string, timestamp: number, secret = SECRET): string {
  return createHmac('sha256', secret)
    .update(`POST${FULL_URI}${body}${timestamp}`, 'utf8')
    .digest('base64');
}

function buildApp(config: { secret?: string } = { secret: SECRET }) {
  const repo = new InMemoryRepository();
  const services = createGtmServices({ repo });
  const handlers = new ApiHandlers(repo, services, {
    hubspotWebhookSecret: config.secret,
    now: () => NOW,
  });
  return { app: buildServer(handlers), repo };
}

function inject(
  app: ReturnType<typeof buildServer>,
  opts: { body: string; headers: Record<string, string> },
) {
  return app.inject({
    method: 'POST',
    url: URL,
    headers: { host: HOST, 'content-type': 'application/json', ...opts.headers },
    payload: opts.body,
  });
}

describe('POST /webhooks/hubspot — signature verification (fail closed)', () => {
  let app: ReturnType<typeof buildServer>;

  beforeEach(() => {
    app = buildApp().app;
  });

  it('accepts a validly signed webhook and ingests', async () => {
    const ts = NOW;
    const res = await inject(app, {
      body: payload,
      headers: {
        'x-hubspot-signature-v3': sign(payload, ts),
        'x-hubspot-request-timestamp': String(ts),
        'x-tenant-id': '11111111-1111-1111-1111-111111111111',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ created: true });
  });

  it('rejects a tampered body (signature no longer matches)', async () => {
    const ts = NOW;
    const signature = sign(payload, ts);
    const res = await inject(app, {
      body: JSON.stringify({ externalId: 'tampered', emailHash: 'x' }),
      headers: {
        'x-hubspot-signature-v3': signature,
        'x-hubspot-request-timestamp': String(ts),
        'x-tenant-id': '11111111-1111-1111-1111-111111111111',
      },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: 'invalid_signature' });
  });

  it('rejects a signature made with the wrong secret', async () => {
    const ts = NOW;
    const res = await inject(app, {
      body: payload,
      headers: {
        'x-hubspot-signature-v3': sign(payload, ts, 'wrong-secret'),
        'x-hubspot-request-timestamp': String(ts),
        'x-tenant-id': '11111111-1111-1111-1111-111111111111',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an expired/replayed timestamp', async () => {
    const ts = NOW - 10 * 60 * 1000; // 10 minutes old (window is 5)
    const res = await inject(app, {
      body: payload,
      headers: {
        'x-hubspot-signature-v3': sign(payload, ts),
        'x-hubspot-request-timestamp': String(ts),
        'x-tenant-id': '11111111-1111-1111-1111-111111111111',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects missing signature headers', async () => {
    const res = await inject(app, {
      body: payload,
      headers: { 'x-tenant-id': '11111111-1111-1111-1111-111111111111' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: 'missing_signature_headers' });
  });

  it('fails closed when no webhook secret is configured', async () => {
    const noSecret = buildApp({ secret: undefined }).app;
    const ts = NOW;
    const res = await inject(noSecret, {
      body: payload,
      headers: {
        'x-hubspot-signature-v3': sign(payload, ts),
        'x-hubspot-request-timestamp': String(ts),
        'x-tenant-id': '11111111-1111-1111-1111-111111111111',
      },
    });
    expect(res.statusCode).toBe(503);
  });
});

describe('raw-body capture is route-scoped', () => {
  it('other JSON routes still parse normally (default parser)', async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/agent-runs/mira',
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': '11111111-1111-1111-1111-111111111111',
      },
      payload: JSON.stringify({ objective: 'outbound' }),
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toHaveProperty('runId');
  });
});
