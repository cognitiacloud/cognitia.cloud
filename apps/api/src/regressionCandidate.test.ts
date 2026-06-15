import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow, type ContactRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers } from './handlers.js';
import type { GoldenScenario } from '@cognitia/evals';

/**
 * REGR-1 — the API end of the flywheel: a rejected action exports an
 * anonymized regression candidate carrying the rejection's reason code.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

describe('GET /agent-actions/:id/regression-candidate (REGR-1)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;
  let actionId: string;

  beforeEach(async () => {
    repo = new InMemoryRepository();
    const account: AccountRow = {
      id: 'acc-1',
      tenant_id: TENANT,
      name: 'Very Real Customer Co',
      domain: 'veryrealcustomer.com',
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
      full_name: 'Real Person',
      title: 'CTO',
      persona: 'champion',
      email_hash: 'sha256:realperson',
      phone_hash: null,
      is_suppressed: false,
      attributes: {},
      created_at: ts,
      updated_at: ts,
    };
    repo.seedAccount(account);
    repo.seedContact(contact);
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    actionId = (list.body as { actions: Array<{ id: string }> }).actions[0]!.id;
  });

  it('exports an anonymized candidate from a rejection, carrying the reason code', async () => {
    await handlers.rejectAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: { reason: { reason_code: 'wrong_target', note: 'not our segment' } },
    });
    const res = await handlers.regressionCandidate({
      tenantId: TENANT,
      role: 'viewer',
      params: { id: actionId },
    });
    expect(res.status).toBe(200);
    const candidate = (res.body as { candidate: GoldenScenario }).candidate;
    expect(candidate.source?.reason_code).toBe('wrong_target');
    expect(candidate.expect.mustNotTargetRefs).toHaveLength(1);
    // Anonymization: tenant names/domains/ids never leave.
    const json = JSON.stringify(candidate);
    expect(json).not.toContain('Very Real Customer Co');
    expect(json).not.toContain('veryrealcustomer.com');
    expect(json).not.toContain('Real Person');
    expect(json).not.toContain('acc-1');
    expect(json).not.toContain('ct-1');
    // Behavioral inputs survive (that is what the runtime ranks on).
    expect(candidate.accounts[0]!.industry).toBe('SaaS');
    expect(candidate.accounts[0]!.employeeCount).toBe(100);
  });

  it('refuses non-rejected actions (409) and unknown ids (404)', async () => {
    const notRejected = await handlers.regressionCandidate({
      tenantId: TENANT,
      params: { id: actionId },
    });
    expect(notRejected.status).toBe(409);
    const missing = await handlers.regressionCandidate({
      tenantId: TENANT,
      params: { id: 'nope' },
    });
    expect(missing.status).toBe(404);
  });
});
