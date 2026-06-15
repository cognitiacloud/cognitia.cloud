import { describe, it, expect, beforeEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import {
  InMemorySsoConfigStore,
  SsoSessionVerifier,
  issueAssertion,
  type TenantSsoConfig,
} from './sso.js';
import { buildServer } from './server.js';
import type { AccessReview } from './accessReview.js';

/**
 * AUTH-2 — access-review export. Owner-only; aggregates observed access from
 * the immutable audit trail and the tenant SSO policy (signing key NEVER
 * exported). Plus a server-level proof that IdP-mapped roles gate actions.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = (n: number) => `2026-06-${String(10 + n).padStart(2, '0')}T00:00:00.000Z`;

function rsa() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

const PUBLIC_KEY_SENTINEL = rsa().publicKey;

function ssoStore(): InMemorySsoConfigStore {
  const cfg: TenantSsoConfig = {
    tenantId: TENANT,
    protocol: 'oidc',
    provider: 'okta',
    issuer: 'https://acme.okta.com',
    audience: 'cognitia-client',
    signingPublicKeyPem: PUBLIC_KEY_SENTINEL,
    roleMapping: { owners: 'owner', ops: 'operator' },
    defaultRole: null,
  };
  return new InMemorySsoConfigStore().put(cfg);
}

async function seedAudit(repo: InMemoryRepository): Promise<void> {
  const ev = (actor: string, action: string, at: string) =>
    repo.insertAuditEvent({
      id: crypto.randomUUID(),
      tenant_id: TENANT,
      actor_ref: actor,
      action,
      subject_ref: 'agent_action:x',
      detail: {},
      occurred_at: at,
      created_at: at,
    });
  await ev('okta:alice', 'approved', ts(1));
  await ev('okta:alice', 'executed', ts(3));
  await ev('okta:bob', 'rejected', ts(2));
}

const owner = (over: Partial<ApiRequest> = {}): ApiRequest => ({
  tenantId: TENANT,
  role: 'owner',
  userRef: 'okta:olivia',
  ...over,
});

describe('AUTH-2 — access-review export', () => {
  let repo: InMemoryRepository;
  let handlers: ApiHandlers;

  beforeEach(async () => {
    repo = new InMemoryRepository();
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }), {
      ssoConfigStore: ssoStore(),
    });
    await seedAudit(repo);
  });

  it('aggregates observed access from the audit trail (owner-only)', async () => {
    const res = await handlers.accessReview(owner());
    expect(res.status).toBe(200);
    const review = res.body as AccessReview;
    // alice + bob (the export itself adds olivia's access_review_exported AFTER
    // the read, so the body reflects the two pre-existing actors).
    const alice = review.users.find((u) => u.actor_ref === 'okta:alice');
    expect(alice).toMatchObject({ action_count: 2, first_seen: ts(1), last_seen: ts(3) });
    expect(alice!.actions).toEqual(['approved', 'executed']);
    expect(review.users.find((u) => u.actor_ref === 'okta:bob')?.action_count).toBe(1);
  });

  it('embeds the SSO policy but NEVER the signing key', async () => {
    const res = await handlers.accessReview(owner());
    const review = res.body as AccessReview;
    expect(review.sso).toMatchObject({
      configured: true,
      protocol: 'oidc',
      provider: 'okta',
      issuer: 'https://acme.okta.com',
      role_mapping: { owners: 'owner', ops: 'operator' },
      default_role: null,
    });
    expect(JSON.stringify(review)).not.toContain('BEGIN PUBLIC KEY');
    expect(JSON.stringify(review)).not.toContain(PUBLIC_KEY_SENTINEL);
  });

  it('logs the export to the audit trail (accountable)', async () => {
    await handlers.accessReview(owner());
    const events = await repo.listAuditEvents(TENANT);
    const exportEvent = events.find((e) => e.action === 'access_review_exported');
    expect(exportEvent?.actor_ref).toBe('user:okta:olivia');
  });

  it('is owner-only: operator and viewer are refused (403)', async () => {
    for (const role of ['operator', 'viewer'] as const) {
      const err = await handlers.accessReview(owner({ role })).catch((e) => e);
      expect(err.status).toBe(403);
    }
  });

  it('reports sso.configured=false when the tenant has no IdP', async () => {
    const bare = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }), {});
    const res = await bare.accessReview(owner());
    expect((res.body as AccessReview).sso.configured).toBe(false);
  });
});

describe('AUTH-2 — IdP-mapped roles gate actions end to end', () => {
  const NOW = 1_900_000_000_000;
  const nowSec = Math.floor(NOW / 1000);
  let keys: ReturnType<typeof rsa>;
  let store: InMemorySsoConfigStore;

  function appWithSso() {
    const repo = new InMemoryRepository();
    repo.seedAccount({
      id: 'acc-a',
      tenant_id: TENANT,
      name: 'Acme',
      domain: 'acme.com',
      industry: 'SaaS',
      employee_count: 100,
      region: 'NA',
      fit_score: 0.9,
      timing_score: 0.8,
      attributes: {},
      created_at: ts(0),
      updated_at: ts(0),
    });
    const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }), {});
    return buildServer(handlers, { verifier: new SsoSessionVerifier(store, () => NOW) });
  }

  beforeEach(() => {
    keys = rsa();
    store = new InMemorySsoConfigStore().put({
      tenantId: TENANT,
      protocol: 'oidc',
      provider: 'okta',
      issuer: 'https://acme.okta.com',
      audience: 'cognitia',
      signingPublicKeyPem: keys.publicKey,
      roleMapping: { ops: 'operator', read: 'viewer' },
      defaultRole: null,
    });
  });

  const token = (groups: string[]) =>
    `Bearer ${issueAssertion(keys.privateKey, {
      iss: 'https://acme.okta.com',
      aud: 'cognitia',
      sub: 'u1',
      exp: nowSec + 3600,
      groups,
    })}`;

  it('an operator-mapped token may run a mutating route; a viewer-mapped token is 403', async () => {
    const app = appWithSso();
    const okRes = await app.inject({
      method: 'POST',
      url: '/agent-runs/mira',
      headers: { authorization: token(['ops']) },
      payload: {},
    });
    expect(okRes.statusCode).toBe(201); // authorized: run created

    const forbidden = await app.inject({
      method: 'POST',
      url: '/agent-runs/mira',
      headers: { authorization: token(['read']) },
      payload: {},
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('an unmapped token is unauthenticated (401), not silently granted access', async () => {
    const res = await appWithSso().inject({
      method: 'GET',
      url: '/accounts',
      headers: { authorization: token(['nobody']) },
    });
    expect(res.statusCode).toBe(401);
  });
});
