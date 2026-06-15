import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow, type ContactRow } from '@cognitia/db';
import { createGtmServices, InvalidDecisionError, type GtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiResponse } from './handlers.js';

/**
 * FLY-1 — decision-reason flywheel. Every approve/reject must carry a
 * structured reason; each decision is persisted as a queryable feedback label
 * (the raw material for evals, scorecards, and future autonomy policy).
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const OTHER_TENANT = '22222222-2222-2222-2222-222222222222';
const ACCOUNT = 'a1000000-0000-0000-0000-000000000001';
const CONTACT = 'a2000000-0000-0000-0000-000000000001';
const ts = '2026-06-09T00:00:00.000Z';

function seedRepo(): InMemoryRepository {
  const repo = new InMemoryRepository();
  const account: AccountRow = {
    id: ACCOUNT,
    tenant_id: TENANT,
    name: 'Target Co',
    domain: 'target.com',
    industry: 'SaaS',
    employee_count: 200,
    region: 'NA',
    fit_score: 0.9,
    timing_score: 0.8,
    attributes: {},
    created_at: ts,
    updated_at: ts,
  };
  const contact: ContactRow = {
    id: CONTACT,
    tenant_id: TENANT,
    account_id: ACCOUNT,
    full_name: 'Ada A',
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

function firstActionId(body: ApiResponse['body']): string {
  const actions = (body as { actions: Array<{ id: string }> }).actions;
  if (!actions[0]) throw new Error('no proposed actions');
  return actions[0].id;
}

describe('FLY-1 — structured decision reasons on approve/reject', () => {
  let repo: InMemoryRepository;
  let services: GtmServices;
  let handlers: ApiHandlers;
  let actionId: string;

  beforeEach(async () => {
    repo = seedRepo();
    services = createGtmServices({ repo, v1Mode: true });
    handlers = new ApiHandlers(repo, services);
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
    const list = await handlers.listAgentActions({
      tenantId: TENANT,
      query: { status: 'proposed' },
    });
    actionId = firstActionId(list.body);
  });

  it('approve without a reason is a 400 and the action stays proposed', async () => {
    const res = await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
    });
    expect(res.status).toBe(400);

    const action = await repo.getAgentAction(TENANT, actionId);
    expect(action?.approval_status).toBe('proposed');
    // And nothing was labeled.
    expect(await repo.listFeedbackLabels(TENANT)).toHaveLength(0);
    // Guardrail intact: still not executable (409).
    const exec = await handlers.executeAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
    });
    expect(exec.status).toBe(409);
  });

  it('reject without a reason is a 400 and the action stays proposed', async () => {
    const res = await handlers.rejectAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
    });
    expect(res.status).toBe(400);
    const action = await repo.getAgentAction(TENANT, actionId);
    expect(action?.approval_status).toBe('proposed');
  });

  it('rejects reason codes outside the closed enum (400)', async () => {
    const res = await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: { reason: { reason_code: 'looks_fine_i_guess' } },
    });
    expect(res.status).toBe(400);
  });

  it('"other" requires a note (400 without one)', async () => {
    const res = await handlers.rejectAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: { reason: { reason_code: 'other' } },
    });
    expect(res.status).toBe(400);
  });

  it('approve with a reason persists a queryable feedback label', async () => {
    const res = await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: { reason: { reason_code: 'high_value_target', note: 'ICP exec at target account' } },
    });
    expect(res.status).toBe(200);
    expect((res.body as { approval_status: string }).approval_status).toBe('approved');

    // Persisted with the self-contained detail snapshot evals will consume.
    const labels = await repo.listFeedbackLabels(TENANT, `agent_action:${actionId}`);
    expect(labels).toHaveLength(1);
    expect(labels[0]!.label).toBe('approved');
    expect(labels[0]!.detail).toMatchObject({
      reason_code: 'high_value_target',
      note: 'ICP exec at target account',
      approver_ref: 'user:operator',
    });
    expect(labels[0]!.detail.action_type).toBeDefined();
    expect(labels[0]!.detail.risk_level).toBeDefined();

    // Queryable over the API (per action and tenant-wide).
    const perAction = await handlers.listActionDecisions({
      tenantId: TENANT,
      params: { id: actionId },
    });
    expect(perAction.status).toBe(200);
    expect((perAction.body as { decisions: unknown[] }).decisions).toHaveLength(1);
    const all = await handlers.listActionDecisions({ tenantId: TENANT });
    expect((all.body as { decisions: unknown[] }).decisions).toHaveLength(1);
  });

  it('reject with a reason persists a rejected label with the code', async () => {
    const res = await handlers.rejectAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: { reason: { reason_code: 'wrong_target' } },
    });
    expect(res.status).toBe(200);
    const labels = await repo.listFeedbackLabels(TENANT, `agent_action:${actionId}`);
    expect(labels).toHaveLength(1);
    expect(labels[0]!.label).toBe('rejected');
    expect(labels[0]!.detail.reason_code).toBe('wrong_target');
  });

  it('decision labels are tenant-isolated', async () => {
    await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: actionId },
      body: { reason: { reason_code: 'meets_playbook' } },
    });
    const other = await handlers.listActionDecisions({ tenantId: OTHER_TENANT });
    expect((other.body as { decisions: unknown[] }).decisions).toHaveLength(0);
  });

  it('401/403 behavior is unchanged on the new and updated endpoints', async () => {
    await expect(handlers.listActionDecisions({})).rejects.toMatchObject({ status: 401 });
    await expect(
      handlers.approveAction({
        tenantId: TENANT,
        role: 'viewer',
        params: { id: actionId },
        body: { reason: { reason_code: 'meets_playbook' } },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('ledger backstop: a missing reason throws InvalidDecisionError below the API', async () => {
    await expect(
      // @ts-expect-error — exercising the runtime guard for non-API callers.
      services.ledger.approve(TENANT, actionId, 'user:operator'),
    ).rejects.toBeInstanceOf(InvalidDecisionError);
    await expect(
      services.ledger.reject(TENANT, actionId, 'user:operator', { reasonCode: '  ' }),
    ).rejects.toBeInstanceOf(InvalidDecisionError);
  });
});
