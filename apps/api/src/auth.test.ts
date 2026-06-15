import { describe, it, expect } from 'vitest';
import { HmacSessionVerifier, signSession, type RequestPrincipal } from './auth.js';

const SECRET = 'session-signing-secret';
const NOW = 1_700_000_000_000;
const principal: RequestPrincipal = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  userRef: 'user:ada',
  role: 'operator',
};

describe('HmacSessionVerifier', () => {
  const verifier = new HmacSessionVerifier(SECRET, () => NOW);

  it('verifies a freshly signed session and returns the principal', async () => {
    const token = signSession(SECRET, principal, 3_600_000, () => NOW);
    expect(await verifier.verify(token)).toEqual(principal);
  });

  it('rejects a missing token', async () => {
    expect(await verifier.verify(undefined)).toBeNull();
    expect(await verifier.verify('')).toBeNull();
  });

  it('rejects a tampered payload (signature mismatch)', async () => {
    const token = signSession(SECRET, principal, 3_600_000, () => NOW);
    const [, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ tid: 'attacker', uid: 'x', role: 'owner', exp: NOW + 1000 }),
    ).toString('base64url');
    expect(await verifier.verify(`${forged}.${sig}`)).toBeNull();
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = signSession('other-secret', principal, 3_600_000, () => NOW);
    expect(await verifier.verify(token)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = signSession(SECRET, principal, 1000, () => NOW - 10_000); // issued 10s ago, 1s TTL
    expect(await verifier.verify(token)).toBeNull();
  });

  /**
   * SEC-1 — strict claim validation. Even a CORRECTLY-SIGNED token must fail
   * closed if its claims are malformed: a buggy or over-permissive issuer must
   * not be able to mint a principal with a role outside the closed enum or a
   * typed-wrong tenant/user id that downstream code never expects.
   */
  it('rejects a correctly-signed token whose role is outside the closed enum', async () => {
    const token = signSession(
      SECRET,
      { ...principal, role: 'admin' as unknown as RequestPrincipal['role'] },
      3_600_000,
      () => NOW,
    );
    expect(await verifier.verify(token)).toBeNull();
  });

  it('rejects correctly-signed tokens with non-string tid/uid claims', async () => {
    // signSession types prevent this; forge the claims directly and sign them
    // with the REAL secret so only claim validation can reject the token.
    const { createHmac } = await import('node:crypto');
    const mint = (claims: Record<string, unknown>): string => {
      const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
      const sig = createHmac('sha256', SECRET).update(payload).digest().toString('base64url');
      return `${payload}.${sig}`;
    };
    const exp = NOW + 3_600_000;
    expect(await verifier.verify(mint({ tid: 123, uid: 'u', role: 'viewer', exp }))).toBeNull();
    expect(
      await verifier.verify(mint({ tid: 't', uid: { x: 1 }, role: 'viewer', exp })),
    ).toBeNull();
    expect(await verifier.verify(mint({ tid: '', uid: 'u', role: 'viewer', exp }))).toBeNull();
    // Control: well-formed claims signed the same way DO verify.
    expect(await verifier.verify(mint({ tid: 't', uid: 'u', role: 'viewer', exp }))).toEqual({
      tenantId: 't',
      userRef: 'u',
      role: 'viewer',
    });
  });
});
