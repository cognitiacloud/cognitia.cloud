import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import {
  InMemorySsoConfigStore,
  SsoSessionVerifier,
  issueAssertion,
  mapGroupsToRole,
  type TenantSsoConfig,
} from './sso.js';
import type { Role } from './auth.js';

/**
 * AUTH-2 — tenant-scoped SSO verification (SAML + OIDC). The tenant is resolved
 * from the verified issuer; the assertion is checked against THAT tenant's key;
 * groups map to roles fail-closed (least privilege); two tenants are isolated.
 */

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const NOW = 1_900_000_000_000; // fixed epoch ms
const nowSec = Math.floor(NOW / 1000);

type Keys = { publicKey: string; privateKey: string };
function rsa(): Keys {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

let okta: Keys;
let entra: Keys;
let attacker: Keys;

beforeAll(() => {
  okta = rsa();
  entra = rsa();
  attacker = rsa();
});

/** Tenant A: Okta / OIDC. Tenant B: Entra / SAML, using the `roles` claim. */
function storeWithBoth(): InMemorySsoConfigStore {
  const a: TenantSsoConfig = {
    tenantId: TENANT_A,
    protocol: 'oidc',
    provider: 'okta',
    issuer: 'https://acme.okta.com',
    audience: 'cognitia-client-a',
    signingPublicKeyPem: okta.publicKey,
    roleMapping: {
      'cognitia-owners': 'owner',
      'cognitia-ops': 'operator',
      'cognitia-viewers': 'viewer',
    },
    defaultRole: null, // reject unmapped (least privilege)
  };
  const b: TenantSsoConfig = {
    tenantId: TENANT_B,
    protocol: 'saml',
    provider: 'entra',
    issuer: 'https://sts.windows.net/contoso/',
    audience: 'spn:cognitia-b',
    signingPublicKeyPem: entra.publicKey,
    roleMapping: { Admins: 'owner', Sellers: 'operator' },
    defaultRole: 'viewer', // authenticated-but-unmapped ⇒ viewer
    groupsClaim: 'roles',
  };
  return new InMemorySsoConfigStore().put(a).put(b);
}

const verifier = (store: InMemorySsoConfigStore) => new SsoSessionVerifier(store, () => NOW);

const oidcToken = (over: Record<string, unknown> = {}) =>
  issueAssertion(okta.privateKey, {
    iss: 'https://acme.okta.com',
    aud: 'cognitia-client-a',
    sub: 'okta-user-1',
    exp: nowSec + 3600,
    groups: ['cognitia-ops'],
    ...over,
  });

const samlToken = (over: Record<string, unknown> = {}) =>
  issueAssertion(entra.privateKey, {
    iss: 'https://sts.windows.net/contoso/',
    aud: 'spn:cognitia-b',
    name_id: 'entra-user-9',
    exp: nowSec + 3600,
    roles: ['Sellers'],
    ...over,
  });

describe('AUTH-2 — SsoSessionVerifier', () => {
  it('OIDC: a valid Okta id_token maps groups → role and resolves the tenant', async () => {
    const p = await verifier(storeWithBoth()).verify(oidcToken());
    expect(p).toEqual({ tenantId: TENANT_A, userRef: 'okta:okta-user-1', role: 'operator' });
  });

  it('SAML: a valid Entra assertion uses NameID + the configured roles claim', async () => {
    const p = await verifier(storeWithBoth()).verify(samlToken());
    expect(p).toEqual({ tenantId: TENANT_B, userRef: 'entra:entra-user-9', role: 'operator' });
  });

  it('rejects a wrong signature (token signed by an untrusted key)', async () => {
    const forged = issueAssertion(attacker.privateKey, {
      iss: 'https://acme.okta.com',
      aud: 'cognitia-client-a',
      sub: 'okta-user-1',
      exp: nowSec + 3600,
      groups: ['cognitia-owners'],
    });
    expect(await verifier(storeWithBoth()).verify(forged)).toBeNull();
  });

  it('rejects expired, not-yet-valid, wrong-audience, and unknown-issuer tokens', async () => {
    const v = verifier(storeWithBoth());
    expect(await v.verify(oidcToken({ exp: nowSec - 1 }))).toBeNull(); // expired
    expect(await v.verify(oidcToken({ nbf: nowSec + 100 }))).toBeNull(); // not yet valid
    expect(await v.verify(oidcToken({ aud: 'someone-else' }))).toBeNull(); // wrong aud
    expect(await v.verify(oidcToken({ iss: 'https://evil.example' }))).toBeNull(); // no tenant
  });

  it('least privilege: an unmapped group with defaultRole=null is rejected', async () => {
    const p = await verifier(storeWithBoth()).verify(oidcToken({ groups: ['random-group'] }));
    expect(p).toBeNull();
  });

  it('an unmapped group with a defaultRole falls through to it (tenant B = viewer)', async () => {
    const p = await verifier(storeWithBoth()).verify(samlToken({ roles: ['Nobody'] }));
    expect(p).toEqual({ tenantId: TENANT_B, userRef: 'entra:entra-user-9', role: 'viewer' });
  });

  it('grants the highest mapped role when a user is in several groups', async () => {
    const p = await verifier(storeWithBoth()).verify(
      oidcToken({ groups: ['cognitia-viewers', 'cognitia-owners', 'cognitia-ops'] }),
    );
    expect(p?.role).toBe('owner');
  });

  it('tenant isolation: a token from tenant A never authenticates as tenant B', async () => {
    // A's Okta token is signed by okta key; B's config uses the entra key and a
    // different issuer — A's issuer resolves only to tenant A.
    const p = await verifier(storeWithBoth()).verify(oidcToken());
    expect(p?.tenantId).toBe(TENANT_A);
    // An attacker re-labels A's token with B's issuer: signature check vs B's key fails.
    const spoof = issueAssertion(okta.privateKey, {
      iss: 'https://sts.windows.net/contoso/',
      aud: 'spn:cognitia-b',
      name_id: 'x',
      exp: nowSec + 3600,
      roles: ['Admins'],
    });
    expect(await verifier(storeWithBoth()).verify(spoof)).toBeNull();
  });

  it('rejects malformed and empty tokens', async () => {
    const v = verifier(storeWithBoth());
    expect(await v.verify(undefined)).toBeNull();
    expect(await v.verify('')).toBeNull();
    expect(await v.verify('not.a.jwt.token')).toBeNull();
    expect(await v.verify('only-one-part')).toBeNull();
  });
});

describe('AUTH-2 — mapGroupsToRole (pure)', () => {
  const mapping: Record<string, Role> = { admin: 'owner', ops: 'operator', read: 'viewer' };
  it('returns the highest mapped role', () => {
    expect(mapGroupsToRole(['read', 'ops'], mapping, null)).toBe('operator');
    expect(mapGroupsToRole(['admin', 'read'], mapping, null)).toBe('owner');
  });
  it('falls through to defaultRole, or rejects when null', () => {
    expect(mapGroupsToRole(['unknown'], mapping, 'viewer')).toBe('viewer');
    expect(mapGroupsToRole(['unknown'], mapping, null)).toBeNull();
    expect(mapGroupsToRole([], mapping, null)).toBeNull();
  });
});
