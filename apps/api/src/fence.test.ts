import { describe, it, expect } from 'vitest';
import { InMemoryRepository, type AccountRow, type ContactRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers } from './handlers.js';
import { buildServer } from './server.js';
import { HmacSessionVerifier } from './auth.js';

/**
 * V1 scope-fence guards (FEN-1..3 in docs/testing/v1-acceptance.md). These prove
 * the "CRM write-back only, no email" fence is enforced in CODE, not just docs.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-06T00:00:00.000Z';

function seededRepo(): InMemoryRepository {
  const repo = new InMemoryRepository();
  const account: AccountRow = {
    id: 'acc-1',
    tenant_id: TENANT,
    name: 'Acme',
    domain: 'acme.com',
    industry: 'SaaS',
    employee_count: 100,
    region: 'NA',
    fit_score: 0.9,
    timing_score: 0.8,
    attributes: {},
    created_at: ts,
    updated_at: ts,
  };
  const contact: ContactRow = {
    id: 'ct-1',
    tenant_id: TENANT,
    account_id: 'acc-1',
    full_name: 'Ada',
    title: 'VP Eng',
    persona: 'champion',
    email_hash: 'sha256:ada',
    phone_hash: null,
    is_suppressed: false,
    attributes: {},
    created_at: ts,
    updated_at: ts,
  };
  repo.seedAccount(account);
  repo.seedContact(contact);
  return repo;
}

describe('FEN-1 — no /webhooks/email route in the V1 server', () => {
  it('POST /webhooks/email returns 404 (route absent)', async () => {
    const repo = seededRepo();
    const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }), {});
    const app = buildServer(handlers, { verifier: new HmacSessionVerifier('s') });
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/email',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('FEN-2 — no executable email path in the V1 composition', () => {
  it('v1Mode adapter registry has no handler for email.draft.send', () => {
    const repo = seededRepo();
    const v1 = createGtmServices({ repo, v1Mode: true });
    expect(v1.deps.adapters.find('email.draft.send')).toBeUndefined();
    // CRM actions are still handled.
    expect(v1.deps.adapters.find('crm.task.create')).toBeDefined();

    // Control: the non-V1 composition DOES register email (proves the gate works).
    const legacy = createGtmServices({ repo });
    expect(legacy.deps.adapters.find('email.draft.send')).toBeDefined();
  });
});

describe('FEN-3 — Mira proposes only crm.* in V1', () => {
  it('a V1 Mira run yields no email.draft.send actions', async () => {
    const repo = seededRepo();
    const services = createGtmServices({ repo, v1Mode: true });
    const result = await services.mira.run({ tenantId: TENANT, objective: 'x', traceId: 't' });
    expect(result.proposedActionIds.length).toBeGreaterThan(0);
    const actions = await repo.listAgentActions(TENANT);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => a.action_type.startsWith('crm.'))).toBe(true);
    expect(actions.some((a) => a.action_type === 'email.draft.send')).toBe(false);
  });
});
