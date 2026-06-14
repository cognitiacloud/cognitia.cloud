/**
 * Deploy-readiness preflight (Item 7) — a PURE, read-only configuration check.
 *
 * Aggregates the fail-closed gates that `buildHandlersFromEnv` / the boot entry
 * point enforce at startup (see apps/api/src/server.ts) into a single report a
 * deployer can run BEFORE shipping. It reuses the real validators in
 * `secrets.ts` (single source of truth) so the rules cannot drift from boot.
 *
 * Scope is deliberately narrow and honest:
 *   - It NEVER deploys, connects to a database, mutates state, or reads secret
 *     *material* into logs — it only checks presence/shape via the same
 *     validators boot uses.
 *   - Checks that require a LIVE resource (e.g. the DB-role RLS-enforcement
 *     check, which needs a connection) are reported as `skip` with a note that
 *     they are enforced at boot — never claimed "verified" here.
 *   - Fail-closed: any `fail` makes the report `ok: false`; the CLI exits
 *     non-zero so a bad config stops a pipeline before it ships.
 */
import {
  envSecretSource,
  isProductionDeploy,
  requireKeyBytes,
  requireSecret,
  SecretConfigError,
  type SecretSource,
} from './secrets.js';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface ReadinessCheck {
  id: string;
  status: CheckStatus;
  /** Human-readable result. Never contains secret material — presence/shape only. */
  detail: string;
}

export interface ReadinessReport {
  deploy_env: 'production' | 'non-production';
  /** false when any check failed (fail-closed). */
  ok: boolean;
  checks: ReadinessCheck[];
}

/** Try a validator; classify the outcome without ever surfacing the value. */
function validate(
  source: SecretSource,
  name: string,
  run: () => void,
  prod: boolean,
): ReadinessCheck {
  const present = source.get(name) !== undefined;
  try {
    run();
    return { id: name, status: 'pass', detail: `${name} present and valid` };
  } catch (err) {
    const reason = err instanceof SecretConfigError ? err.message : `${name} failed validation`;
    if (!present && !prod) {
      return { id: name, status: 'warn', detail: `${name} not set (dev fallback in use)` };
    }
    // Missing in prod, or present-but-malformed anywhere, is a hard fail.
    return { id: name, status: prod || present ? 'fail' : 'warn', detail: reason };
  }
}

/**
 * Compute the deploy-readiness report from a secret source (defaults to env).
 * Pure: no I/O beyond reading the provided source.
 */
export function preflightReadiness(source: SecretSource = envSecretSource): ReadinessReport {
  const prod = isProductionDeploy(source);
  const checks: ReadinessCheck[] = [];

  // 1) DATABASE_URL — required in production (boot refuses the in-memory repo).
  const hasDb = source.get('DATABASE_URL') !== undefined;
  checks.push({
    id: 'DATABASE_URL',
    status: hasDb ? 'pass' : prod ? 'fail' : 'warn',
    detail: hasDb
      ? 'database URL configured'
      : prod
        ? 'required in production (boot refuses the in-memory repo)'
        : 'not set — using in-memory repo (dev)',
  });

  // 2) CREDENTIAL_SECRET_KEY_BASE64 — required in prod; must decode to 32 bytes.
  checks.push(
    validate(
      source,
      'CREDENTIAL_SECRET_KEY_BASE64',
      () => requireKeyBytes('CREDENTIAL_SECRET_KEY_BASE64', 32, source),
      prod,
    ),
  );

  // 3) SESSION_SECRET — entropy floor (>= 32). In prod, boot also accepts an SSO
  //    IdP instead; this offline check cannot see the SSO store, so a MISSING
  //    secret is a warn (boot still fail-closes), while a present-but-weak secret
  //    is always a hard fail.
  const sessionSecret = source.get('SESSION_SECRET');
  if (sessionSecret === undefined) {
    checks.push({
      id: 'SESSION_SECRET',
      status: 'warn',
      detail: prod
        ? 'not set — production boot requires SESSION_SECRET (>=32) OR a configured SSO IdP'
        : 'not set (dev session auth optional)',
    });
  } else {
    checks.push(
      validate(source, 'SESSION_SECRET', () => requireSecret('SESSION_SECRET', { minLength: 32, source }), prod), // prettier-ignore
    );
  }

  // 4) HUBSPOT_WEBHOOK_SECRET — optional; without it inbound webhook signatures
  //    are not verified. Warn (never fail) so it stays visible.
  const hasWebhookSecret = source.get('HUBSPOT_WEBHOOK_SECRET') !== undefined;
  checks.push({
    id: 'HUBSPOT_WEBHOOK_SECRET',
    status: hasWebhookSecret ? 'pass' : 'warn',
    detail: hasWebhookSecret
      ? 'webhook signature verification enabled'
      : 'not set — inbound HubSpot webhook signatures are not verified',
  });

  // 5) DB-role RLS enforcement — a LIVE check (needs a connection); enforced at
  //    boot by assertEnforcedRlsRole. Not checkable offline, so report it as
  //    skipped rather than implying it passed here.
  checks.push({
    id: 'DB_ROLE_RLS_ENFORCED',
    status: 'skip',
    detail:
      'live check — enforced at boot via assertEnforcedRlsRole (app must run under a non-superuser, non-BYPASSRLS role)',
  });

  return {
    deploy_env: prod ? 'production' : 'non-production',
    ok: !checks.some((c) => c.status === 'fail'),
    checks,
  };
}

/** Render a readiness report as a compact, human-readable text block. */
export function formatReadinessReport(report: ReadinessReport): string {
  const mark: Record<CheckStatus, string> = {
    pass: 'PASS',
    fail: 'FAIL',
    warn: 'WARN',
    skip: 'SKIP',
  };
  const lines = report.checks.map((c) => `  [${mark[c.status]}] ${c.id}: ${c.detail}`);
  const verdict = report.ok ? 'READY' : 'NOT READY';
  return [`Deploy-readiness preflight (${report.deploy_env}): ${verdict}`, ...lines].join('\n');
}
