#!/usr/bin/env node
/**
 * ALPHA-1 — post-deploy smoke (deploy-verification runbook, automated subset).
 *
 * Runs the HTTP-verifiable deploy checks against a live deployment and prints
 * a PASS/FAIL/WARN table. Exits non-zero on any required failure, so it can
 * gate a deploy pipeline (B-5 deploy controls).
 *
 * Usage:
 *   BASE_URL=https://api.example.com \
 *   OPERATOR_TOKEN=$(node apps/api/scripts/issue-session.mjs ... --role operator) \
 *   VIEWER_TOKEN=$(node apps/api/scripts/issue-session.mjs ... --role viewer) \
 *   node apps/api/scripts/smoke-deploy.mjs
 *
 * Tokens are optional: without them the unauthenticated checks still run and
 * the authed ones are reported as SKIP (the runbook's manual steps remain).
 * Readiness is WARN (not FAIL) when NOT READY: a pre-portal-setup deploy is a
 * valid state — the check surfaces it without blocking the pipeline.
 */

/**
 * Pure smoke runner: `fetchLike` is injected so tests exercise every path
 * without a network. Returns { checks, ok } where required failures set
 * ok=false.
 */
export async function runSmoke({ baseUrl, fetchLike, operatorToken, viewerToken }) {
  const checks = [];
  const add = (name, status, detail, required = true) =>
    checks.push({ name, status, detail, required });

  const call = async (path, { method = 'GET', token } = {}) => {
    const res = await fetchLike(`${baseUrl}${path}`, {
      method,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  };

  // 1. Health: process up, DB reachable.
  try {
    const r = await call('/health');
    const dbUp = r.status === 200 && r.body && r.body.db === 'up';
    add(
      'health_db_up',
      dbUp ? 'PASS' : 'FAIL',
      `GET /health -> ${r.status} ${JSON.stringify(r.body)}`,
    );
  } catch (err) {
    add('health_db_up', 'FAIL', `GET /health unreachable: ${err.message}`);
    return { checks, ok: false }; // nothing else can run
  }

  // 2. Auth fails closed: no session => 401.
  {
    const r = await call('/accounts');
    add(
      'auth_fail_closed',
      r.status === 401 ? 'PASS' : 'FAIL',
      `GET /accounts (no auth) -> ${r.status} (expect 401)`,
    );
  }

  // 3. Email fence: inbound email surface must not exist (404).
  {
    const r = await call('/webhooks/email', { method: 'POST' });
    add(
      'email_fence_404',
      r.status === 404 ? 'PASS' : 'FAIL',
      `POST /webhooks/email -> ${r.status} (expect 404)`,
    );
  }

  if (!operatorToken) {
    add(
      'authed_checks',
      'SKIP',
      'OPERATOR_TOKEN not provided — run the manual runbook steps',
      false,
    );
  } else {
    // 4. Auth works for a real session.
    {
      const r = await call('/accounts', { token: operatorToken });
      add(
        'auth_session_ok',
        r.status === 200 ? 'PASS' : 'FAIL',
        `GET /accounts (operator) -> ${r.status} (expect 200)`,
      );
    }
    // 5. Governance derives from code and the fence holds in this deployment.
    {
      const r = await call('/governance', { token: operatorToken });
      const email = r.body?.action_types?.find((a) => a.action_type === 'email.draft.send');
      const fenced =
        r.status === 200 &&
        r.body?.derived_from_code === true &&
        email?.executable_in_deployment === false;
      add(
        'governance_fence',
        fenced ? 'PASS' : 'FAIL',
        `GET /governance -> ${r.status}; email executable=${String(email?.executable_in_deployment)} (expect false)`,
      );
    }
    // 6. Kill switch is enforced (status surface).
    {
      const r = await call('/integrations/status', { token: operatorToken });
      const enforced = r.status === 200 && r.body?.kill_switch?.enforced === true;
      add(
        'kill_switch_enforced',
        enforced ? 'PASS' : 'FAIL',
        `GET /integrations/status -> ${r.status}; enforced=${String(r.body?.kill_switch?.enforced)}`,
      );
    }
    // 7. Go-live readiness (WARN when not ready: valid pre-portal-setup state).
    {
      const r = await call('/integrations/readiness', { token: operatorToken });
      if (r.status === 200 && r.body?.ready === true) {
        add('readiness', 'PASS', 'READY — portal configured for live writes', false);
      } else {
        const missing = r.body?.missing_properties
          ? JSON.stringify(r.body.missing_properties)
          : (r.body?.reason ?? `status ${r.status}`);
        add('readiness', 'WARN', `NOT READY — ${missing}`, false);
      }
    }
    // 8. Trust metrics respond (live-derived surface up).
    {
      const r = await call('/metrics/trust', { token: operatorToken });
      add(
        'trust_metrics',
        r.status === 200 ? 'PASS' : 'FAIL',
        `GET /metrics/trust -> ${r.status} (expect 200)`,
      );
    }
  }

  if (!viewerToken) {
    add(
      'rbac_check',
      'SKIP',
      'VIEWER_TOKEN not provided — verify RBAC manually (viewer run => 403)',
      false,
    );
  } else {
    // 9. RBAC: a viewer cannot trigger agent runs.
    const r = await call('/agent-runs/mira', { method: 'POST', token: viewerToken });
    add(
      'rbac_viewer_403',
      r.status === 403 ? 'PASS' : 'FAIL',
      `POST /agent-runs/mira (viewer) -> ${r.status} (expect 403)`,
    );
  }

  const ok = checks.every((c) => !c.required || c.status !== 'FAIL');
  return { checks, ok };
}

// ---- CLI entry ----
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    console.error('BASE_URL env var is required (e.g. https://api.example.com)');
    process.exit(1);
  }
  const { checks, ok } = await runSmoke({
    baseUrl: baseUrl.replace(/\/$/, ''),
    fetchLike: globalThis.fetch,
    operatorToken: process.env.OPERATOR_TOKEN,
    viewerToken: process.env.VIEWER_TOKEN,
  });
  for (const c of checks) {
    console.log(`${c.status.padEnd(4)} ${c.required ? ' ' : '~'} ${c.name}: ${c.detail}`);
  }
  console.log(ok ? 'SMOKE: PASS' : 'SMOKE: FAIL');
  process.exit(ok ? 0 : 1);
}
