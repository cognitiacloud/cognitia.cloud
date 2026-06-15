import { describe, it, expect } from 'vitest';
import {
  preflightReadiness,
  formatReadinessReport,
  type ReadinessCheck,
} from './preflightReadiness.js';
import { type SecretSource } from './secrets.js';

/**
 * Item 7 — deploy-readiness preflight. The checker is PURE (a SecretSource in,
 * a report out) and FAIL-CLOSED: any `fail` makes the report not-ready. It
 * reuses the real secrets.ts validators so the rules cannot drift from boot,
 * and it never claims the live-only DB-role check passed.
 */

const src = (env: Record<string, string>): SecretSource => ({ get: (n) => env[n] });
const KEY32 = Buffer.alloc(32, 7).toString('base64');
const STRONG = 's'.repeat(40);
const PROD_OK = {
  DEPLOY_ENV: 'production',
  DATABASE_URL: 'postgres://app_user@db/app',
  CREDENTIAL_SECRET_KEY_BASE64: KEY32,
  SESSION_SECRET: STRONG,
  HUBSPOT_WEBHOOK_SECRET: 'whsec',
};
const byId = (checks: ReadinessCheck[], id: string) => checks.find((c) => c.id === id)!;

describe('preflightReadiness — production', () => {
  it('a fully-configured production env is READY (no fails)', () => {
    const r = preflightReadiness(src(PROD_OK));
    expect(r.deploy_env).toBe('production');
    expect(r.ok).toBe(true);
    expect(r.checks.some((c) => c.status === 'fail')).toBe(false);
    // The live-only DB-role check is reported, not claimed verified.
    expect(byId(r.checks, 'DB_ROLE_RLS_ENFORCED').status).toBe('skip');
  });

  it('missing DATABASE_URL in production fails closed', () => {
    const { DATABASE_URL: _omit, ...rest } = PROD_OK;
    const r = preflightReadiness(src(rest));
    expect(byId(r.checks, 'DATABASE_URL').status).toBe('fail');
    expect(r.ok).toBe(false);
  });

  it('missing credential key in production fails closed', () => {
    const { CREDENTIAL_SECRET_KEY_BASE64: _omit, ...rest } = PROD_OK;
    const r = preflightReadiness(src(rest));
    expect(byId(r.checks, 'CREDENTIAL_SECRET_KEY_BASE64').status).toBe('fail');
    expect(r.ok).toBe(false);
  });

  it('a wrong-size credential key fails closed (reuses requireKeyBytes)', () => {
    const r = preflightReadiness(
      src({ ...PROD_OK, CREDENTIAL_SECRET_KEY_BASE64: Buffer.alloc(16).toString('base64') }),
    );
    expect(byId(r.checks, 'CREDENTIAL_SECRET_KEY_BASE64').status).toBe('fail');
    expect(r.ok).toBe(false);
  });

  it('a present-but-weak SESSION_SECRET always fails; a missing one only warns', () => {
    const weak = preflightReadiness(src({ ...PROD_OK, SESSION_SECRET: 'short' }));
    expect(byId(weak.checks, 'SESSION_SECRET').status).toBe('fail');
    expect(weak.ok).toBe(false);

    const { SESSION_SECRET: _omit, ...rest } = PROD_OK;
    const missing = preflightReadiness(src(rest));
    // Missing is a warn (boot also accepts an SSO IdP this offline check can't see).
    expect(byId(missing.checks, 'SESSION_SECRET').status).toBe('warn');
    expect(missing.ok).toBe(true);
  });

  it('a missing webhook secret warns but does not block', () => {
    const { HUBSPOT_WEBHOOK_SECRET: _omit, ...rest } = PROD_OK;
    const r = preflightReadiness(src(rest));
    expect(byId(r.checks, 'HUBSPOT_WEBHOOK_SECRET').status).toBe('warn');
    expect(r.ok).toBe(true);
  });
});

describe('preflightReadiness — non-production', () => {
  it('an empty dev env is READY: prod-only requirements downgrade to warn', () => {
    const r = preflightReadiness(src({}));
    expect(r.deploy_env).toBe('non-production');
    expect(r.ok).toBe(true);
    expect(byId(r.checks, 'DATABASE_URL').status).toBe('warn');
    expect(byId(r.checks, 'CREDENTIAL_SECRET_KEY_BASE64').status).toBe('warn');
  });

  it('a malformed secret fails even in dev (present-but-invalid is never ok)', () => {
    const r = preflightReadiness(src({ CREDENTIAL_SECRET_KEY_BASE64: 'not-32-bytes' }));
    expect(byId(r.checks, 'CREDENTIAL_SECRET_KEY_BASE64').status).toBe('fail');
    expect(r.ok).toBe(false);
  });
});

describe('formatReadinessReport', () => {
  it('renders a verdict and one line per check', () => {
    const r = preflightReadiness(src(PROD_OK));
    const text = formatReadinessReport(r);
    expect(text).toContain('READY');
    expect(text.split('\n')).toHaveLength(r.checks.length + 1);
  });

  it('renders NOT READY when a check fails', () => {
    const text = formatReadinessReport(preflightReadiness(src({ DEPLOY_ENV: 'production' })));
    expect(text).toContain('NOT READY');
  });
});
