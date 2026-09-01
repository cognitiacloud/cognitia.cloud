import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { assertLiveOutboundAllowed, log } from '@cognitia/core';
import type { Repository } from '@cognitia/db';
import type { HttpFetch, TokenProvider } from './httpClient.js';

/**
 * Per-tenant HubSpot OAuth, resolved from `integration_connections.credential_ref`.
 *
 * Design:
 *  - `integration_connections` stores only a `credential_ref` (a pointer) — never
 *    a raw token. The actual token material lives in a `SecretStore`, encrypted at
 *    rest (`AesGcmSecretStore`).
 *  - `ConnectionTokenProvider` looks up the connection, decrypts the credential,
 *    returns a valid access token, and transparently refreshes expired tokens
 *    (HubSpot refresh-token grant), persisting the rotated credential back.
 *  - Tokens are NEVER logged or placed in error messages — only tenant ids,
 *    credential-ref hashes, and reason codes.
 */

export interface HubspotOAuthCredential {
  accessToken: string;
  refreshToken?: string;
  /** ISO timestamp when `accessToken` expires. */
  expiresAt: string;
  clientId?: string;
  clientSecret?: string;
}

/** Stores credentials encrypted at rest, keyed by `credential_ref`. */
export interface SecretStore {
  get(ref: string): Promise<HubspotOAuthCredential | null>;
  put(ref: string, credential: HubspotOAuthCredential): Promise<void>;
}

/** Backing key/value store for ciphertext (DB table, KV, etc.). */
export interface CiphertextStore {
  get(ref: string): Promise<string | null>;
  set(ref: string, ciphertext: string): Promise<void>;
}

/** Default in-process ciphertext store (tests / single-node). */
export class InMemoryCiphertextStore implements CiphertextStore {
  private readonly map = new Map<string, string>();
  async get(ref: string): Promise<string | null> {
    return this.map.get(ref) ?? null;
  }
  async set(ref: string, ciphertext: string): Promise<void> {
    this.map.set(ref, ciphertext);
  }
}

/**
 * AES-256-GCM secret store. Credentials are encrypted before they touch the
 * backing store, so the at-rest representation is ciphertext only. The key is
 * supplied by the caller (KMS/Vault/env in production) and never stored here.
 */
export class AesGcmSecretStore implements SecretStore {
  constructor(
    private readonly key: Buffer, // 32 bytes
    private readonly backing: CiphertextStore = new InMemoryCiphertextStore(),
  ) {
    if (key.length !== 32) {
      throw new Error('AesGcmSecretStore requires a 32-byte key');
    }
  }

  async get(ref: string): Promise<HubspotOAuthCredential | null> {
    const blob = await this.backing.get(ref);
    if (!blob) return null;
    const [ivB64, tagB64, dataB64] = blob.split('.');
    if (!ivB64 || !tagB64 || !dataB64) throw new Error('corrupt secret blob');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(plain) as HubspotOAuthCredential;
  }

  async put(ref: string, credential: HubspotOAuthCredential): Promise<void> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(credential), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    await this.backing.set(
      ref,
      `${iv.toString('base64')}.${tag.toString('base64')}.${data.toString('base64')}`,
    );
  }
}

/** In-memory secret store for tests (no encryption; do not use in production). */
export class InMemorySecretStore implements SecretStore {
  private readonly map = new Map<string, HubspotOAuthCredential>();
  async get(ref: string): Promise<HubspotOAuthCredential | null> {
    return this.map.get(ref) ?? null;
  }
  async put(ref: string, credential: HubspotOAuthCredential): Promise<void> {
    this.map.set(ref, credential);
  }
}

// --- errors (never carry token material) ---

export class MissingCredentialError extends Error {
  constructor(
    readonly tenantId: string,
    readonly reason: string,
  ) {
    super(`no usable HubSpot credential for tenant ${tenantId}: ${reason}`);
    this.name = 'MissingCredentialError';
  }
}
export class TokenExpiredError extends Error {
  constructor(readonly tenantId: string) {
    super(`HubSpot token for tenant ${tenantId} is expired and cannot be refreshed`);
    this.name = 'TokenExpiredError';
  }
}
export class TokenRefreshError extends Error {
  constructor(
    readonly tenantId: string,
    readonly status: number,
  ) {
    super(`HubSpot token refresh failed for tenant ${tenantId} (status ${status})`);
    this.name = 'TokenRefreshError';
  }
}

export interface ConnectionTokenProviderOptions {
  repo: Pick<Repository, 'getIntegrationConnection'>;
  secrets: SecretStore;
  /** Injected HTTP for the refresh call (defaults to global fetch). */
  fetch?: HttpFetch;
  now?: () => number;
  /** Refresh this many ms before actual expiry. Default 60s. */
  refreshSkewMs?: number;
  oauthTokenUrl?: string;
  externalSystem?: string;
}

const DEFAULT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

export class ConnectionTokenProvider implements TokenProvider {
  private readonly fetch: HttpFetch;
  private readonly now: () => number;
  private readonly skew: number;
  private readonly tokenUrl: string;
  private readonly system: string;
  /** Short-lived per-tenant access-token cache (value is the token + expiry). */
  private readonly cache = new Map<string, { token: string; expiresAtMs: number }>();

  constructor(private readonly opts: ConnectionTokenProviderOptions) {
    this.fetch = opts.fetch ?? (globalThis as { fetch?: HttpFetch }).fetch!;
    this.now = opts.now ?? (() => Date.now());
    this.skew = opts.refreshSkewMs ?? 60_000;
    this.tokenUrl = opts.oauthTokenUrl ?? DEFAULT_TOKEN_URL;
    this.system = opts.externalSystem ?? 'hubspot';
  }

  async getAccessToken(tenantId: string): Promise<string> {
    const now = this.now();
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAtMs - this.skew > now) {
      return cached.token;
    }

    const conn = await this.opts.repo.getIntegrationConnection(tenantId, this.system);
    if (!conn || conn.status !== 'active') {
      throw new MissingCredentialError(
        tenantId,
        conn ? `connection ${conn.status}` : 'no_connection',
      );
    }
    if (!conn.credential_ref) {
      throw new MissingCredentialError(tenantId, 'no_credential_ref');
    }

    let credential = await this.opts.secrets.get(conn.credential_ref);
    if (!credential) {
      throw new MissingCredentialError(tenantId, 'secret_not_found');
    }

    if (this.isExpired(credential, now)) {
      credential = await this.refresh(tenantId, conn.credential_ref, credential);
    }

    this.cache.set(tenantId, {
      token: credential.accessToken,
      expiresAtMs: Date.parse(credential.expiresAt),
    });
    return credential.accessToken;
  }

  private isExpired(credential: HubspotOAuthCredential, now: number): boolean {
    const expiresAtMs = Date.parse(credential.expiresAt);
    return !Number.isFinite(expiresAtMs) || expiresAtMs - this.skew <= now;
  }

  /**
   * Refresh via HubSpot's refresh-token grant and persist the rotated credential.
   * Documented fallback: if the credential has no refresh_token / client creds,
   * we cannot refresh — the connection must be re-authorized (TokenExpiredError).
   */
  private async refresh(
    tenantId: string,
    credentialRef: string,
    credential: HubspotOAuthCredential,
  ): Promise<HubspotOAuthCredential> {
    // CGD-002: deny-by-default BEFORE HubSpot token HTTP. Secrets are not consent.
    assertLiveOutboundAllowed('hubspotOAuthRefresh');
    if (!credential.refreshToken || !credential.clientId || !credential.clientSecret) {
      throw new TokenExpiredError(tenantId);
    }
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: credential.clientId,
      client_secret: credential.clientSecret,
      refresh_token: credential.refreshToken,
    }).toString();

    const res = await this.fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (res.status < 200 || res.status >= 300) {
      throw new TokenRefreshError(tenantId, res.status);
    }
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) {
      throw new TokenRefreshError(tenantId, res.status);
    }
    const rotated: HubspotOAuthCredential = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credential.refreshToken,
      expiresAt: new Date(this.now() + (data.expires_in ?? 1800) * 1000).toISOString(),
      clientId: credential.clientId,
      clientSecret: credential.clientSecret,
    };
    await this.opts.secrets.put(credentialRef, rotated);
    // PII/secret-safe: log only tenant + a ref hash + reason, never the token.
    log({ level: 'info', message: 'hubspot.token.refreshed', tenant_id: tenantId });
    return rotated;
  }
}
