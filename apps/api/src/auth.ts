import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Operator-API authentication. The tenant is derived from a verified session
 * principal — NEVER from a client-supplied `x-tenant-id` header (that was an auth
 * bypass). This module is the seam an OIDC/IdP integration plugs into: replace
 * `HmacSessionVerifier` with a verifier that validates the IdP-issued session and
 * maps it to `{ tenantId, userRef, role }`.
 */

export type Role = 'owner' | 'operator' | 'viewer';

export interface RequestPrincipal {
  tenantId: string;
  userRef: string;
  role: Role;
}

/** Verifies an opaque session token from the `Authorization: Bearer` header. */
export interface SessionVerifier {
  verify(token: string | undefined): Promise<RequestPrincipal | null>;
}

interface SessionClaims {
  tid: string; // tenant id
  uid: string; // user ref
  role: Role;
  exp: number; // epoch ms
}

const b64url = (b: Buffer): string => b.toString('base64url');

const ROLES: ReadonlySet<string> = new Set(['owner', 'operator', 'viewer']);
const isRole = (v: unknown): v is Role => typeof v === 'string' && ROLES.has(v);

/**
 * Stateless signed-session verifier (HMAC-SHA256). Token = `payload.signature`,
 * both base64url. This is a real, testable session mechanism that stands in for
 * an IdP-issued session until OIDC is wired; it removes header-trust today.
 *
 * `signSession` issues a token (used by the login path / tests). The signing
 * secret comes from the secret manager, never the client.
 */
export class HmacSessionVerifier implements SessionVerifier {
  constructor(
    private readonly secret: string,
    private readonly now: () => number = () => Date.now(),
  ) {
    if (!secret) throw new Error('HmacSessionVerifier requires a non-empty secret');
  }

  async verify(token: string | undefined): Promise<RequestPrincipal | null> {
    if (!token) return null;
    const dot = token.indexOf('.');
    if (dot <= 0) return null;
    const payloadPart = token.slice(0, dot);
    const sigPart = token.slice(dot + 1);

    const expected = createHmac('sha256', this.secret).update(payloadPart).digest();
    let provided: Buffer;
    try {
      provided = Buffer.from(sigPart, 'base64url');
    } catch {
      return null;
    }
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      return null;
    }

    let claims: SessionClaims;
    try {
      claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as SessionClaims;
    } catch {
      return null;
    }
    // Fail closed on malformed claims: tid/uid must be non-empty strings and the
    // role must be one of the closed enum — a buggy or over-permissive issuer
    // must not be able to mint a principal with an unknown role or typed-wrong
    // tenant id that downstream code never expects.
    if (typeof claims.tid !== 'string' || claims.tid === '') return null;
    if (typeof claims.uid !== 'string' || claims.uid === '') return null;
    if (!isRole(claims.role)) return null;
    if (!Number.isFinite(claims.exp) || claims.exp <= this.now()) return null; // expired

    return { tenantId: claims.tid, userRef: claims.uid, role: claims.role };
  }
}

/** Issue a signed session token (login path / tests). Secret stays server-side. */
export function signSession(
  secret: string,
  principal: RequestPrincipal,
  ttlMs: number,
  now: () => number = () => Date.now(),
): string {
  const claims: SessionClaims = {
    tid: principal.tenantId,
    uid: principal.userRef,
    role: principal.role,
    exp: now() + ttlMs,
  };
  const payloadPart = b64url(Buffer.from(JSON.stringify(claims), 'utf8'));
  const sig = b64url(createHmac('sha256', secret).update(payloadPart).digest());
  return `${payloadPart}.${sig}`;
}

/** Roles permitted to take side effects (approve/reject/execute, run agents). */
export const MUTATING_ROLES: ReadonlySet<Role> = new Set<Role>(['owner', 'operator']);
