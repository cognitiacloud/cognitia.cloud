import { describe, it, expect } from 'vitest';
import {
  isProductionDeploy,
  requireKeyBytes,
  requireSecret,
  SecretConfigError,
  type SecretSource,
} from './secrets.js';

/** AUTH alpha-blocker #2 — secret resolution + fail-closed validation. */

const src = (env: Record<string, string>): SecretSource => ({ get: (n) => env[n] });

describe('secrets', () => {
  it('requireSecret enforces presence and a minimum length', () => {
    expect(requireSecret('S', { source: src({ S: 'x'.repeat(32) }), minLength: 32 })).toHaveLength(
      32,
    );
    expect(() => requireSecret('S', { source: src({}) })).toThrow(SecretConfigError);
    expect(() => requireSecret('S', { source: src({ S: 'short' }), minLength: 32 })).toThrow(
      /too short/i,
    );
  });

  it('requireKeyBytes requires an exactly-sized base64 key (AES-256 = 32 bytes)', () => {
    const key32 = Buffer.alloc(32, 7).toString('base64');
    expect(requireKeyBytes('K', 32, src({ K: key32 }))).toHaveLength(32);
    const key16 = Buffer.alloc(16, 7).toString('base64');
    expect(() => requireKeyBytes('K', 32, src({ K: key16 }))).toThrow(/exactly 32 bytes/i);
    expect(() => requireKeyBytes('K', 32, src({}))).toThrow(/required/i);
  });

  it('isProductionDeploy reads DEPLOY_ENV / NODE_ENV', () => {
    expect(isProductionDeploy(src({ DEPLOY_ENV: 'production' }))).toBe(true);
    expect(isProductionDeploy(src({ NODE_ENV: 'production' }))).toBe(true);
    expect(isProductionDeploy(src({ NODE_ENV: 'test' }))).toBe(false);
    expect(isProductionDeploy(src({}))).toBe(false);
  });
});
