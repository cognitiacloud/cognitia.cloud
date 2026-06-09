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
});
