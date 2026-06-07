import { describe, it, expect } from 'vitest';
import {
  HttpHubspotClient,
  HubspotApiError,
  type HttpFetch,
  type HttpResponse,
} from './httpClient.js';

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): HttpResponse {
  return {
    status,
    headers: { get: (n) => headers[n.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const token = { getAccessToken: async () => 'access-token-123' };

describe('HttpHubspotClient — reads', () => {
  it('cursor-paginates companies and maps fields', async () => {
    const pages = [
      jsonResponse(200, {
        results: [
          {
            id: 'co-1',
            properties: { name: 'Acme', domain: 'acme.com', numberofemployees: '200' },
          },
        ],
        paging: { next: { after: 'CURSOR2' } },
      }),
      jsonResponse(200, {
        results: [{ id: 'co-2', properties: { name: 'Globex' } }],
      }),
    ];
    const calls: string[] = [];
    let i = 0;
    const fetch: HttpFetch = async (url, init) => {
      calls.push(url);
      expect(init?.headers?.['authorization']).toBe('Bearer access-token-123');
      return pages[i++]!;
    };
    const client = new HttpHubspotClient({ token, fetch });

    const first = await client.listCompanies({ tenantId: 't1' });
    expect(first.items[0]).toMatchObject({ externalId: 'co-1', name: 'Acme', employeeCount: 200 });
    expect(first.cursor).toBe('CURSOR2');

    const second = await client.listCompanies({ tenantId: 't1', cursor: first.cursor });
    expect(second.cursor).toBeUndefined();
    expect(calls[1]).toContain('after=CURSOR2');
  });

  it('hashes contact emails (never returns raw email)', async () => {
    const fetch: HttpFetch = async () =>
      jsonResponse(200, {
        results: [
          {
            id: 'ct-1',
            properties: { firstname: 'Ada', lastname: 'L', email: 'ada@acme.com', jobtitle: 'VP' },
            associations: { companies: { results: [{ id: 'co-1' }] } },
          },
        ],
      });
    const client = new HttpHubspotClient({ token, fetch });
    const page = await client.listContacts({ tenantId: 't1' });
    expect(page.items[0]!.fullName).toBe('Ada L');
    expect(page.items[0]!.companyExternalId).toBe('co-1');
    expect(page.items[0]!.emailHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(page.items[0])).not.toContain('ada@acme.com');
  });
});

describe('HttpHubspotClient — rate limiting', () => {
  it('retries on 429 honoring Retry-After, then succeeds', async () => {
    const slept: number[] = [];
    let n = 0;
    const fetch: HttpFetch = async () => {
      n++;
      if (n === 1) return jsonResponse(429, { error: 'rate' }, { 'retry-after': '2' });
      return jsonResponse(200, { results: [] });
    };
    const client = new HttpHubspotClient({
      token,
      fetch,
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    const page = await client.listDeals({ tenantId: 't1' });
    expect(page.items).toEqual([]);
    expect(n).toBe(2);
    expect(slept[0]).toBe(2000); // honored Retry-After seconds
  });

  it('gives up after maxRetries on persistent 5xx', async () => {
    const fetch: HttpFetch = async () => jsonResponse(503, { error: 'down' });
    const client = new HttpHubspotClient({ token, fetch, maxRetries: 2, sleep: async () => {} });
    await expect(client.listCompanies({ tenantId: 't1' })).rejects.toBeInstanceOf(HubspotApiError);
  });

  it('throws on 4xx (non-429) without retrying', async () => {
    let n = 0;
    const fetch: HttpFetch = async () => {
      n++;
      return jsonResponse(400, { error: 'bad' });
    };
    const client = new HttpHubspotClient({ token, fetch, sleep: async () => {} });
    await expect(client.listContacts({ tenantId: 't1' })).rejects.toBeInstanceOf(HubspotApiError);
    expect(n).toBe(1);
  });
});

describe('HttpHubspotClient — idempotent writes', () => {
  it('returns existing object when idempotency key already present (no create)', async () => {
    const urls: string[] = [];
    const fetch: HttpFetch = async (url) => {
      urls.push(url);
      if (url.includes('/search')) return jsonResponse(200, { results: [{ id: 'task-9' }] });
      throw new Error('should not POST create');
    };
    const client = new HttpHubspotClient({ token, fetch });
    const res = await client.createTask({
      tenantId: 't1',
      idempotencyKey: 'key-1',
      targetRef: 'account:x',
      payload: { hs_task_subject: 'Follow up' },
    });
    expect(res.idempotentReplay).toBe(true);
    expect(res.externalRef).toBe('hubspot:tasks:task-9');
    expect(urls.every((u) => u.includes('/search'))).toBe(true);
  });

  it('creates when no prior object exists', async () => {
    const fetch: HttpFetch = async (url) => {
      if (url.includes('/search')) return jsonResponse(200, { results: [] });
      return jsonResponse(201, { id: 'note-new' });
    };
    const client = new HttpHubspotClient({ token, fetch });
    const res = await client.createNote({
      tenantId: 't1',
      idempotencyKey: 'key-2',
      targetRef: 'contact:y',
      payload: { hs_note_body: 'hello' },
    });
    expect(res.idempotentReplay).toBe(false);
    expect(res.externalRef).toBe('hubspot:notes:note-new');
  });
});
