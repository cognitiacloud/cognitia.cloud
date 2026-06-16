import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Fail-closed guard tests for the V-6 managed-RLS harness.
 *
 * These do NOT touch a database — they prove the harness REFUSES to run unless it
 * is explicitly pointed at an acknowledged dev/throwaway DB, and refuses outright
 * for production-looking targets. This is the safety contract that lets the
 * harness exist in the repo without risking a real database.
 */

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'verify-managed-rls.mjs');

function run(env: Record<string, string | undefined>) {
  return spawnSync(process.execPath, [script], {
    env: { ...process.env, CONFIRM_DEV_DB: undefined, DATABASE_URL: undefined, ...env },
    encoding: 'utf8',
  });
}

describe('verify-managed-rls fails closed', () => {
  it('refuses with no env (no CONFIRM_DEV_DB)', () => {
    const r = run({});
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/REFUSED: CONFIRM_DEV_DB/);
  });

  it('refuses when confirmed but DATABASE_URL is missing', () => {
    const r = run({ CONFIRM_DEV_DB: 'true' });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/REFUSED: DATABASE_URL/);
  });

  it('refuses a production-looking target even when confirmed', () => {
    const r = run({
      CONFIRM_DEV_DB: 'true',
      DATABASE_URL: 'postgres://u@db.prod.example.com:5432/app',
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/REFUSED: target looks like production/);
  });

  it('refuses a moveros target (documented collision app) even when confirmed', () => {
    const r = run({
      CONFIRM_DEV_DB: 'true',
      DATABASE_URL: 'postgres://u@host:5432/moveros_staging',
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/REFUSED: target looks like production/);
  });

  it('does not echo the connection string in any refusal', () => {
    const secret = 'postgres://user:SUPERSECRET@db.prod.example.com/app';
    const r = run({ CONFIRM_DEV_DB: 'true', DATABASE_URL: secret });
    expect(r.stdout + r.stderr).not.toContain('SUPERSECRET');
  });
});
