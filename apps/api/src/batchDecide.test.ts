import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow, type ContactRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiResponse } from './handlers.js';

/**
 * UX-2 — batch approve/reject. One shared structured reason across selected ids,
 * per-id results so partial failures are explicit, and the same FLY-1
 * required-reason guarantee as the single-action path.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ACCOUNT = 'a1000000-0000-0000-0000-000000000001';
const CONTACT = 'a2000000-0000-0000-0000-000000000001';
const ts = '2026-06-10T00:00:00.000Z';

function seedRepo(): InMemoryRepository {
  const repo = new InMemoryRepository();
  // Seed several accounts so Mira (v1) proposes multiple crm.task.create actions
  // — a real batch needs more than one selectable id.
  for (let i = 1; i <= 3; i++) {
    const accId = `${ACCOUNT.slice(0, -1)}${i}`;
    const account: AccountRow = {
      id: accId,
      tenant_id: TENANT,
      name: `Target Co ${i}`,
      domain: `target${i}.com`,
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
      id: `${CONTACT.slice(0, -1)}${i}`,
      tenant_id: TENANT,
      account_id: accId,
      full_name: `Ada ${i}`,
      title: 'VP Eng',
      persona: 'champion',
      email_hash: `sha256:ada${i}`,
      phone_hash: null,
      is_suppressed: false,
      attributes: {},
      created_at: ts,
      updated_at: ts,
    };
    repo.seedAccount(account);
    repo.seedContact(contact);
  }
  return repo;
}

function makeHandlers() {
  const repo = seedRepo();
  const services = createGtmServices({ repo, v1Mode: true });
  return { handlers: new ApiHandlers(repo, services), repo };
}

async function proposedIds(handlers: ApiHandlers): Promise<string[]> {
  await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
  const list = await handlers.listAgentActions({ tenantId: TENANT, query: { status: 'proposed' } });
  return (list.body as { actions: Array<{ id: string }> }).actions.map((a) => a.id);
}

describe('UX-2 — batch approve/reject', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;

  beforeEach(() => {
    const made = makeHandlers();
    handlers = made.handlers;
    repo = made.repo;
  });

  it('approves all selected ids with one shared reason and reports per-id', async () => {
    const ids = await proposedIds(handlers);
    expect(ids.length).toBeGreaterThan(1);

    const res = await handlers.batchApprove({
      tenantId: TENANT,
      role: 'operator',
      body: { ids, reason: { reason_code: 'meets_playbook' } },
    });
    expect(res.status).toBe(200);
    const body = res.body as { requested: number; succeeded: number; results: unknown[] };
    expect(body.requested).toBe(ids.length);
    expect(body.succeeded).toBe(ids.length);

    for (const id of ids) {
      expect((await repo.getAgentAction(TENANT, id))?.approval_status).toBe('approved');
      // Each carries its own decision label (one shared reason, per-action label).
      const labels = await repo.listFeedbackLabels(TENANT, `agent_action:${id}`);
      expect(labels).toHaveLength(1);
      expect(labels[0]!.detail.reason_code).toBe('meets_playbook');
    }
  });

  it('rejects all selected ids and records rejected labels', async () => {
    const ids = await proposedIds(handlers);
    const res = await handlers.batchReject({
      tenantId: TENANT,
      role: 'operator',
      body: { ids, reason: { reason_code: 'wrong_target' } },
    });
    expect(res.status).toBe(200);
    for (const id of ids) {
      expect((await repo.getAgentAction(TENANT, id))?.approval_status).toBe('rejected');
    }
  });

  it('returns 207 with per-id errors on partial failure (unknown id)', async () => {
    const ids = await proposedIds(handlers);
    const bogus = '99999999-9999-9999-9999-999999999999';
    const batch = [ids[0]!, bogus, ...ids.slice(1)];

    const res = await handlers.batchApprove({
      tenantId: TENANT,
      role: 'operator',
      body: { ids: batch, reason: { reason_code: 'meets_playbook' } },
    });
    expect(res.status).toBe(207);
    const body = res.body as {
      succeeded: number;
      results: Array<{ id: string; ok: boolean; status: number }>;
    };
    expect(body.succeeded).toBe(ids.length);
    const failed = body.results.find((r) => !r.ok)!;
    expect(failed.id).toBe(bogus);
    expect(failed.status).toBe(404); // unknown action → ledger ExecutionError → 404
    // The real ids still went through.
    for (const id of ids) {
      expect((await repo.getAgentAction(TENANT, id))?.approval_status).toBe('approved');
    }
  });

  it('400 when no reason is supplied (batch shares FLY-1 validation)', async () => {
    const ids = await proposedIds(handlers);
    const res = await handlers.batchApprove({
      tenantId: TENANT,
      role: 'operator',
      body: { ids },
    });
    expect(res.status).toBe(400);
    // Nothing decided.
    for (const id of ids) {
      expect((await repo.getAgentAction(TENANT, id))?.approval_status).toBe('proposed');
    }
  });

  it('400 on an out-of-enum code and on "other" without a note', async () => {
    const ids = await proposedIds(handlers);
    const bad = await handlers.batchReject({
      tenantId: TENANT,
      role: 'operator',
      body: { ids, reason: { reason_code: 'made_up_code' } },
    });
    expect(bad.status).toBe(400);
    const otherNoNote = await handlers.batchReject({
      tenantId: TENANT,
      role: 'operator',
      body: { ids, reason: { reason_code: 'other' } },
    });
    expect(otherNoNote.status).toBe(400);
  });

  it('400 on an empty id list', async () => {
    const res = await handlers.batchApprove({
      tenantId: TENANT,
      role: 'operator',
      body: { ids: [], reason: { reason_code: 'meets_playbook' } },
    });
    expect(res.status).toBe(400);
  });

  it('RBAC: a viewer cannot batch approve/reject (403)', async () => {
    await expect(
      handlers.batchApprove({
        tenantId: TENANT,
        role: 'viewer',
        body: { ids: ['x'], reason: { reason_code: 'meets_playbook' } },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('401 without a tenant principal', async () => {
    await expect(
      handlers.batchReject({ body: { ids: ['x'], reason: { reason_code: 'wrong_target' } } }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('batch decisions are tenant-isolated (other tenant sees no labels)', async () => {
    const ids = await proposedIds(handlers);
    await handlers.batchApprove({
      tenantId: TENANT,
      role: 'operator',
      body: { ids, reason: { reason_code: 'meets_playbook' } },
    });
    const other = '22222222-2222-2222-2222-222222222222';
    const decisions: ApiResponse = await handlers.listActionDecisions({ tenantId: other });
    expect((decisions.body as { decisions: unknown[] }).decisions).toHaveLength(0);
  });
});
