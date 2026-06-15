import { describe, it, expect } from 'vitest';
import { runSmoke, type SmokeFetch } from '../scripts/smoke-deploy.mjs';

/**
 * ALPHA-1 — deploy smoke runner. Exercises every path with an injected fetch:
 * a healthy deploy passes, each guard failure is caught (auth not failing
 * closed, fence open, governance drift, viewer RBAC hole), readiness is a
 * WARN not a FAIL, and a dead deploy short-circuits.
 */

type Route = { status: number; body?: unknown };

function fakeDeploy(routes: Record<string, Route>): SmokeFetch {
  return async (url, init) => {
    const path = new URL(url).pathname;
    const key = `${init?.method ?? 'GET'} ${path}`;
    const r = routes[key] ?? { status: 404, body: { error: 'not found' } };
    return { status: r.status, json: async () => r.body ?? {} };
  };
}

const HEALTHY: Record<string, Route> = {
  'GET /health': { status: 200, body: { db: 'up' } },
  'GET /accounts': { status: 401 }, // unauthed default; token branch overridden below
  'POST /webhooks/email': { status: 404 },
};

const HEALTHY_AUTHED: Record<string, Route> = {
  ...HEALTHY,
  'GET /governance': {
    status: 200,
    body: {
      derived_from_code: true,
      action_types: [{ action_type: 'email.draft.send', executable_in_deployment: false }],
    },
  },
  'GET /integrations/status': { status: 200, body: { kill_switch: { enforced: true } } },
  'GET /integrations/readiness': { status: 200, body: { ready: true } },
  'GET /metrics/trust': { status: 200, body: {} },
  'POST /agent-runs/mira': { status: 403 },
};

/** Authed /accounts must 200; unauthed must 401 — route on the header. */
function authAwareAccounts(routes: Record<string, Route>): SmokeFetch {
  const base = fakeDeploy(routes);
  return async (url, init) => {
    if (new URL(url).pathname === '/accounts' && init?.headers?.['authorization']) {
      return { status: 200, json: async () => ({ accounts: [] }) };
    }
    return base(url, init);
  };
}

describe('runSmoke', () => {
  it('a healthy, configured deploy passes every check', async () => {
    const { checks, ok } = await runSmoke({
      baseUrl: 'http://api',
      fetchLike: authAwareAccounts(HEALTHY_AUTHED),
      operatorToken: 'op',
      viewerToken: 'view',
    });
    expect(ok).toBe(true);
    expect(checks.filter((c) => c.status === 'FAIL')).toHaveLength(0);
    expect(checks.map((c) => c.name)).toContain('rbac_viewer_403');
  });

  it('fails when auth does not fail closed (unauthed /accounts 200)', async () => {
    const { checks, ok } = await runSmoke({
      baseUrl: 'http://api',
      fetchLike: fakeDeploy({ ...HEALTHY, 'GET /accounts': { status: 200, body: {} } }),
    });
    expect(ok).toBe(false);
    expect(checks.find((c) => c.name === 'auth_fail_closed')?.status).toBe('FAIL');
  });

  it('fails when the email fence is open (webhook not 404)', async () => {
    const { ok, checks } = await runSmoke({
      baseUrl: 'http://api',
      fetchLike: fakeDeploy({ ...HEALTHY, 'POST /webhooks/email': { status: 200 } }),
    });
    expect(ok).toBe(false);
    expect(checks.find((c) => c.name === 'email_fence_404')?.status).toBe('FAIL');
  });

  it('fails when governance shows email executable (fence drift)', async () => {
    const drifted = {
      ...HEALTHY_AUTHED,
      'GET /governance': {
        status: 200,
        body: {
          derived_from_code: true,
          action_types: [{ action_type: 'email.draft.send', executable_in_deployment: true }],
        },
      },
    };
    const { ok, checks } = await runSmoke({
      baseUrl: 'http://api',
      fetchLike: authAwareAccounts(drifted),
      operatorToken: 'op',
    });
    expect(ok).toBe(false);
    expect(checks.find((c) => c.name === 'governance_fence')?.status).toBe('FAIL');
  });

  it('fails when a viewer can trigger agent runs (RBAC hole)', async () => {
    const hole = { ...HEALTHY_AUTHED, 'POST /agent-runs/mira': { status: 201 } };
    const { ok, checks } = await runSmoke({
      baseUrl: 'http://api',
      fetchLike: authAwareAccounts(hole),
      operatorToken: 'op',
      viewerToken: 'view',
    });
    expect(ok).toBe(false);
    expect(checks.find((c) => c.name === 'rbac_viewer_403')?.status).toBe('FAIL');
  });

  it('NOT READY is a WARN with the missing properties named — never a FAIL', async () => {
    const notReady = {
      ...HEALTHY_AUTHED,
      'GET /integrations/readiness': {
        status: 409,
        body: { ready: false, missing_properties: { tasks: ['cognitia_agent'], notes: [] } },
      },
    };
    const { ok, checks } = await runSmoke({
      baseUrl: 'http://api',
      fetchLike: authAwareAccounts(notReady),
      operatorToken: 'op',
      viewerToken: 'view',
    });
    expect(ok).toBe(true); // pre-portal-setup deploy is a valid state
    const readiness = checks.find((c) => c.name === 'readiness');
    expect(readiness?.status).toBe('WARN');
    expect(readiness?.detail).toContain('cognitia_agent');
  });

  it('missing tokens produce SKIPs, never silent passes', async () => {
    const { checks, ok } = await runSmoke({
      baseUrl: 'http://api',
      fetchLike: fakeDeploy(HEALTHY),
    });
    expect(ok).toBe(true);
    expect(checks.find((c) => c.name === 'authed_checks')?.status).toBe('SKIP');
    expect(checks.find((c) => c.name === 'rbac_check')?.status).toBe('SKIP');
  });

  it('a dead deploy short-circuits with a health FAIL', async () => {
    const dead: SmokeFetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const { checks, ok } = await runSmoke({ baseUrl: 'http://api', fetchLike: dead });
    expect(ok).toBe(false);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ name: 'health_db_up', status: 'FAIL' });
  });
});
