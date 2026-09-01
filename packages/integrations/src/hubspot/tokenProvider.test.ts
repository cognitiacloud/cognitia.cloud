import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryRepository, type IntegrationConnectionRow } from '@cognitia/db';
import type { HttpFetch, HttpResponse } from './httpClient.js';
import {
  ConnectionTokenProvider,
  InMemorySecretStore,
  AesGcmSecretStore,
  InMemoryCiphertextStore,
  MissingCredentialError,
  TokenExpiredError,
  TokenRefreshError,
  type HubspotOAuthCredential,
} from './tokenProvider.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const NOW = 1_700_000_000_000;
const ts = '2026-06-06T00:00:00.000Z';

function connection(over: Partial<IntegrationConnectionRow> = {}): IntegrationConnectionRow {
  return {
    id: 'conn-1',
    tenant_id: TENANT,
    external_system: 'hubspot',
    status: 'active',
    credential_ref: 'cred-ref-1',
    metadata: {},
    created_at: ts,
    updated_at: ts,
    ...over,
  };
}

function repoWith(conn?: IntegrationConnectionRow): InMemoryRepository {
  const repo = new InMemoryRepository();
  if (conn) repo.seedIntegrationConnection(conn);
  return repo;
}

function jsonResponse(status: number, body: unknown): HttpResponse {
  return {
    status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function allowHubspotOAuthRefresh() {
  vi.stubEnv('LIVE_OUTBOUND_EXPLICITLY_ALLOWED', 'true');
  vi.stubEnv('LIVE_OUTBOUND_HUBSPOT_OAUTH_REFRESH', 'true');
}


describe('ConnectionTokenProvider — lookup', () => {
  it('resolves a valid access token for the tenant', async () => {
    const repo = repoWith(connection());
    const secrets = new InMemorySecretStore();
    await secrets.put('cred-ref-1', {
      accessToken: 'valid-token',
      expiresAt: new Date(NOW + 3_600_000).toISOString(),
    });
    const provider = new ConnectionTokenProvider({ repo, secrets, now: () => NOW });

    expect(await provider.getAccessToken(TENANT)).toBe('valid-token');
  });

  it('caches the token across calls (single secret read)', async () => {
    const repo = repoWith(connection());
    const secrets = new InMemorySecretStore();
    await secrets.put('cred-ref-1', {
      accessToken: 'valid-token',
      expiresAt: new Date(NOW + 3_600_000).toISOString(),
    });
    const getSpy = vi.spyOn(secrets, 'get');
    const provider = new ConnectionTokenProvider({ repo, secrets, now: () => NOW });

    await provider.getAccessToken(TENANT);
    await provider.getAccessToken(TENANT);
    expect(getSpy).toHaveBeenCalledTimes(1); // second call served from cache
  });
});

describe('ConnectionTokenProvider — missing credentials', () => {
  it('throws when there is no connection', async () => {
    const provider = new ConnectionTokenProvider({
      repo: repoWith(),
      secrets: new InMemorySecretStore(),
      now: () => NOW,
    });
    await expect(provider.getAccessToken(TENANT)).rejects.toBeInstanceOf(MissingCredentialError);
  });

  it('throws when credential_ref is missing', async () => {
    const provider = new ConnectionTokenProvider({
      repo: repoWith(connection({ credential_ref: null })),
      secrets: new InMemorySecretStore(),
      now: () => NOW,
    });
    await expect(provider.getAccessToken(TENANT)).rejects.toMatchObject({
      name: 'MissingCredentialError',
      reason: 'no_credential_ref',
    });
  });

  it('throws when the secret is absent for the ref', async () => {
    const provider = new ConnectionTokenProvider({
      repo: repoWith(connection()),
      secrets: new InMemorySecretStore(), // nothing stored
      now: () => NOW,
    });
    await expect(provider.getAccessToken(TENANT)).rejects.toMatchObject({
      reason: 'secret_not_found',
    });
  });

  it('throws when the connection is not active', async () => {
    const provider = new ConnectionTokenProvider({
      repo: repoWith(connection({ status: 'paused' })),
      secrets: new InMemorySecretStore(),
      now: () => NOW,
    });
    await expect(provider.getAccessToken(TENANT)).rejects.toBeInstanceOf(MissingCredentialError);
  });
});

describe('ConnectionTokenProvider — refresh', () => {
  beforeEach(allowHubspotOAuthRefresh);
  function expiredCredential(over: Partial<HubspotOAuthCredential> = {}): HubspotOAuthCredential {
    return {
      accessToken: 'old-token',
      refreshToken: 'refresh-token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      expiresAt: new Date(NOW - 1000).toISOString(), // already expired
      ...over,
    };
  }

  it('refreshes an expired token and persists the rotation', async () => {
    const repo = repoWith(connection());
    const secrets = new InMemorySecretStore();
    await secrets.put('cred-ref-1', expiredCredential());

    const fetch: HttpFetch = async (url, init) => {
      expect(url).toContain('/oauth/v1/token');
      expect(init?.body).toContain('grant_type=refresh_token');
      return jsonResponse(200, {
        access_token: 'fresh-token',
        refresh_token: 'fresh-refresh',
        expires_in: 1800,
      });
    };
    const provider = new ConnectionTokenProvider({ repo, secrets, fetch, now: () => NOW });

    expect(await provider.getAccessToken(TENANT)).toBe('fresh-token');
    // Rotation persisted back to the secret store.
    const stored = await secrets.get('cred-ref-1');
    expect(stored?.accessToken).toBe('fresh-token');
    expect(stored?.refreshToken).toBe('fresh-refresh');
  });

  it('documented fallback: cannot refresh without a refresh token => TokenExpiredError', async () => {
    const repo = repoWith(connection());
    const secrets = new InMemorySecretStore();
    await secrets.put('cred-ref-1', expiredCredential({ refreshToken: undefined }));
    const provider = new ConnectionTokenProvider({ repo, secrets, now: () => NOW });

    await expect(provider.getAccessToken(TENANT)).rejects.toBeInstanceOf(TokenExpiredError);
  });

  it('raises TokenRefreshError on a failed refresh (no token in the error)', async () => {
    const repo = repoWith(connection());
    const secrets = new InMemorySecretStore();
    await secrets.put('cred-ref-1', expiredCredential());
    const fetch: HttpFetch = async () => jsonResponse(400, { error: 'invalid_grant' });
    const provider = new ConnectionTokenProvider({ repo, secrets, fetch, now: () => NOW });

    const err = await provider.getAccessToken(TENANT).catch((e) => e);
    expect(err).toBeInstanceOf(TokenRefreshError);
    expect(String(err)).not.toContain('refresh-token');
    expect(String(err)).not.toContain('old-token');
  });
});

describe('no raw token leakage', () => {
  it('AesGcmSecretStore stores ciphertext only (token not in backing store)', async () => {
    const backing = new InMemoryCiphertextStore();
    const store = new AesGcmSecretStore(Buffer.alloc(32, 7), backing);
    await store.put('ref-1', {
      accessToken: 'super-secret-token',
      expiresAt: new Date(NOW + 1000).toISOString(),
    });
    const atRest = await backing.get('ref-1');
    expect(atRest).toBeTruthy();
    expect(atRest).not.toContain('super-secret-token'); // encrypted at rest
    // Round-trips back to plaintext only via the store.
    expect((await store.get('ref-1'))?.accessToken).toBe('super-secret-token');
  });

  it('refresh logs never contain the access token', async () => {
    allowHubspotOAuthRefresh();
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    const repo = repoWith(connection());
    const secrets = new InMemorySecretStore();
    await secrets.put('cred-ref-1', {
      accessToken: 'old-token',
      refreshToken: 'refresh-token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      expiresAt: new Date(NOW - 1000).toISOString(),
    });
    const fetch: HttpFetch = async () =>
      jsonResponse(200, { access_token: 'fresh-token', expires_in: 1800 });
    const provider = new ConnectionTokenProvider({ repo, secrets, fetch, now: () => NOW });

    await provider.getAccessToken(TENANT);
    const all = lines.join('\n');
    expect(all).toContain('hubspot.token.refreshed');
    expect(all).not.toContain('fresh-token');
    expect(all).not.toContain('refresh-token');
    expect(all).not.toContain('client-secret');
  });
});
