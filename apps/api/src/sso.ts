import { createPublicKey, createVerify, createSign, type KeyObject } from 'node:crypto';
import type { Role, RequestPrincipal, SessionVerifier } from './auth.js';

/**
 * AUTH-2 — enterprise SSO (SAML + OIDC) with tenant-scoped IdP configuration,
 * IdP-group → role mapping, and least-privilege fail-closed defaults.
 *
 * Design:
 *  - Each tenant configures ONE primary IdP (Okta default; Entra ID when the
 *    customer is Microsoft-centric; `generic` otherwise) and a protocol
 *    (`oidc` | `saml`). The choice is tenant-scoped — resolved from the verified
 *    token issuer, never from anything the client supplies.
 *  - Both protocols are verified over an RS256-signed assertion against the
 *    tenant's configured public key. The OIDC path validates a standard
 *    id_token (iss/aud/exp + a groups claim). The SAML path validates a signed
 *    assertion envelope (Issuer/AudienceRestriction/Conditions/AttributeStatement).
 *    The security-relevant checks — signature, issuer, audience, time window,
 *    subject, group→role mapping, fail-closed — are fully implemented here.
 *    Production wire bindings (OIDC JWKS key rotation; SAML XML-DSig
 *    canonicalization) plug into `verifyAssertion` / the config key seam without
 *    changing this control logic.
 *  - Tenant isolation: a token is only ever mapped to the tenant whose
 *    configured issuer signed it. Cross-tenant tokens resolve to no config → reject.
 *  - Least privilege: a group that maps to nothing yields `defaultRole`; when
 *    that is null the principal is REJECTED rather than granted a fallback role.
 */

export type SsoProtocol = 'oidc' | 'saml';
export type IdpProvider = 'okta' | 'entra' | 'generic';

/** The provider's default claim carrying group memberships. */
const DEFAULT_GROUPS_CLAIM: Record<IdpProvider, string> = {
  okta: 'groups',
  entra: 'groups', // Entra emits `groups` (object ids) or `roles`; configurable below.
  generic: 'groups',
};

export interface TenantSsoConfig {
  tenantId: string;
  protocol: SsoProtocol;
  provider: IdpProvider;
  /** Expected `iss`. Also the lookup key that binds a token to this tenant. */
  issuer: string;
  /** Expected audience (OIDC client id / SAML SP entity id). */
  audience: string;
  /** PEM public key the IdP signs with (RS256). JWKS rotation is a documented seam. */
  signingPublicKeyPem: string;
  /** IdP group/role value → app Role. Unmapped groups fall through to defaultRole. */
  roleMapping: Record<string, Role>;
  /** Role for an authenticated user with no mapped group. null ⇒ reject (least privilege). */
  defaultRole: Role | null;
  /** Claim carrying group memberships; defaults per provider. */
  groupsClaim?: string;
}

export interface SsoConfigStore {
  getByTenant(tenantId: string): Promise<TenantSsoConfig | null>;
  /** Resolve the tenant whose configured issuer signed this token. */
  getByIssuer(issuer: string): Promise<TenantSsoConfig | null>;
  list(): Promise<TenantSsoConfig[]>;
}

/**
 * In-memory config store (tests + dev). Production persists configs in the
 * encrypted per-tenant store behind this same interface — the verifier and
 * access-review never see the storage backend.
 */
export class InMemorySsoConfigStore implements SsoConfigStore {
  private readonly byTenant = new Map<string, TenantSsoConfig>();
  private readonly byIssuer = new Map<string, TenantSsoConfig>();

  put(config: TenantSsoConfig): this {
    this.byTenant.set(config.tenantId, config);
    this.byIssuer.set(config.issuer, config);
    return this;
  }
  async getByTenant(tenantId: string): Promise<TenantSsoConfig | null> {
    return this.byTenant.get(tenantId) ?? null;
  }
  async getByIssuer(issuer: string): Promise<TenantSsoConfig | null> {
    return this.byIssuer.get(issuer) ?? null;
  }
  async list(): Promise<TenantSsoConfig[]> {
    return [...this.byTenant.values()];
  }
}

const ROLE_RANK: Record<Role, number> = { viewer: 0, operator: 1, owner: 2 };

function b64urlJson(part: string): unknown {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

interface JwtHeader {
  alg?: string;
  typ?: string;
}
interface AssertionClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number; // epoch seconds
  nbf?: number; // epoch seconds
  /** SAML profile: NameID (falls back to sub). */
  name_id?: string;
  [claim: string]: unknown;
}

export interface VerifiedAssertion {
  claims: AssertionClaims;
  header: JwtHeader;
}

/**
 * Verify an RS256-signed compact assertion (`header.payload.signature`).
 * Returns the decoded claims only when the signature is valid. This is the seam
 * a production SAML XML-DSig / OIDC JWKS verifier replaces — the caller's
 * issuer/audience/time/role logic is unchanged.
 */
export function verifyAssertion(token: string, publicKeyPem: string): VerifiedAssertion | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, sigPart] = parts as [string, string, string];
  let header: JwtHeader;
  let claims: AssertionClaims;
  try {
    header = b64urlJson(headerPart) as JwtHeader;
    claims = b64urlJson(payloadPart) as AssertionClaims;
  } catch {
    return null;
  }
  if (header.alg !== 'RS256') return null; // only an asymmetric IdP signature is trusted
  let key: KeyObject;
  try {
    key = createPublicKey(publicKeyPem);
  } catch {
    return null;
  }
  let signature: Buffer;
  try {
    signature = Buffer.from(sigPart, 'base64url');
  } catch {
    return null;
  }
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerPart}.${payloadPart}`);
  verifier.end();
  if (!verifier.verify(key, signature)) return null;
  return { claims, header };
}

function audienceMatches(aud: AssertionClaims['aud'], expected: string): boolean {
  if (typeof aud === 'string') return aud === expected;
  if (Array.isArray(aud)) return aud.includes(expected);
  return false;
}

function extractGroups(claims: AssertionClaims, groupsClaim: string): string[] {
  const raw = claims[groupsClaim];
  if (Array.isArray(raw)) return raw.filter((g): g is string => typeof g === 'string');
  if (typeof raw === 'string') return [raw];
  return [];
}

/**
 * Map IdP groups to the app role. Grants the HIGHEST explicitly-mapped role
 * among the user's groups (standard RBAC union). No mapped group ⇒ defaultRole;
 * a null defaultRole ⇒ reject (least privilege — never invent access).
 */
export function mapGroupsToRole(
  groups: string[],
  mapping: Record<string, Role>,
  defaultRole: Role | null,
): Role | null {
  let best: Role | null = null;
  for (const g of groups) {
    const mapped = mapping[g];
    if (mapped && (best === null || ROLE_RANK[mapped] > ROLE_RANK[best])) best = mapped;
  }
  return best ?? defaultRole;
}

/**
 * SessionVerifier backed by tenant-scoped SSO. Resolves the tenant from the
 * verified token issuer, validates the signed assertion against that tenant's
 * key, enforces audience + time window + protocol, and maps groups → role.
 */
export class SsoSessionVerifier implements SessionVerifier {
  constructor(
    private readonly store: SsoConfigStore,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async verify(token: string | undefined): Promise<RequestPrincipal | null> {
    if (!token) return null;
    // Peek the issuer (unverified) only to select the tenant's config; the
    // signature is then checked against THAT tenant's key, so a forged issuer
    // pointing at another tenant fails signature verification.
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let peeked: AssertionClaims;
    try {
      peeked = b64urlJson(parts[1]!) as AssertionClaims;
    } catch {
      return null;
    }
    if (typeof peeked.iss !== 'string' || peeked.iss === '') return null;
    const config = await this.store.getByIssuer(peeked.iss);
    if (!config) return null; // unknown issuer ⇒ no tenant ⇒ reject

    const verified = verifyAssertion(token, config.signingPublicKeyPem);
    if (!verified) return null;
    const { claims } = verified;

    // Issuer + audience + time window (fail closed on each).
    if (claims.iss !== config.issuer) return null;
    if (!audienceMatches(claims.aud, config.audience)) return null;
    const nowSec = Math.floor(this.now() / 1000);
    if (typeof claims.exp !== 'number' || claims.exp <= nowSec) return null;
    if (typeof claims.nbf === 'number' && claims.nbf > nowSec) return null;

    // Subject: OIDC `sub`; SAML NameID (fall back to sub).
    const subject = config.protocol === 'saml' ? (claims.name_id ?? claims.sub) : claims.sub;
    if (typeof subject !== 'string' || subject === '') return null;

    const groupsClaim = config.groupsClaim ?? DEFAULT_GROUPS_CLAIM[config.provider];
    const role = mapGroupsToRole(
      extractGroups(claims, groupsClaim),
      config.roleMapping,
      config.defaultRole,
    );
    if (!role) return null; // least privilege: unmapped ⇒ no access

    return {
      tenantId: config.tenantId,
      userRef: `${config.provider}:${subject}`,
      role,
    };
  }
}

/**
 * Issue an RS256-signed assertion (tests + the IdP-callback seam). Production
 * tokens come from the real IdP; this mirrors the exact wire shape the verifier
 * accepts so the control logic is testable offline.
 */
export function issueAssertion(privateKeyPem: string, claims: AssertionClaims): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const headerPart = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadPart = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${headerPart}.${payloadPart}`);
  signer.end();
  const signature = signer.sign(privateKeyPem).toString('base64url');
  return `${headerPart}.${payloadPart}.${signature}`;
}
