import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type AccountRow, type ContactRow } from '@cognitia/db';
import { AdapterRegistry, StubEmailAdapter, StubHubspotAdapter } from '@cognitia/integrations';
import { createGtmServices, type GtmServices } from '../services.js';
import { ExecutionError } from '../ledger/actionLedger.js';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const ACCOUNT_A = 'a1000000-0000-0000-0000-000000000001';
const CONTACT_OK = 'a2000000-0000-0000-0000-000000000001';
const CONTACT_SUPPRESSED = 'a2000000-0000-0000-0000-000000000002';
const ts = '2026-06-06T00:00:00.000Z';

function account(id: string, tenant: string): AccountRow {
  return {
    id,
    tenant_id: tenant,
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
}
function contact(id: string, tenant: string, suppressed = false): ContactRow {
  return {
    id,
    tenant_id: tenant,
    account_id: ACCOUNT_A,
    full_name: 'Ada A',
    title: 'VP Eng',
    persona: 'champion',
    email_hash: 'sha256:ada',
    phone_hash: null,
    is_suppressed: suppressed,
    attributes: {},
    created_at: ts,
    updated_at: ts,
  };
}

/** Deterministic id generator for reproducible runs. */
function counterIds(): () => string {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

describe('Mira outbound MVP — end to end', () => {
  let repo: InMemoryRepository;
  let svc: GtmServices;
  let emailAdapter: StubEmailAdapter;

  beforeEach(() => {
    repo = new InMemoryRepository();
    repo.seedAccount(account(ACCOUNT_A, TENANT_A));
    repo.seedContact(contact(CONTACT_OK, TENANT_A, false));
    repo.seedContact(contact(CONTACT_SUPPRESSED, TENANT_A, true));
    emailAdapter = new StubEmailAdapter();
    const adapters = new AdapterRegistry()
      .register(emailAdapter)
      .register(new StubHubspotAdapter());
    svc = createGtmServices({
      repo,
      adapters,
      now: () => new Date(ts),
      newId: counterIds(),
      settings: { auto_approve_low_risk: false },
    });
  });

  it('creates an agent run and proposed actions', async () => {
    const result = await svc.mira.run({
      tenantId: TENANT_A,
      objective: 'build outbound pipeline',
      traceId: 'trace-1',
      icp: { industries: ['SaaS'], minEmployees: 50 },
    });

    const run = await repo.getAgentRun(TENANT_A, result.runId);
    expect(run?.status).toBe('completed');
    expect(result.proposedActionIds.length).toBeGreaterThan(0);

    const proposed = await repo.listAgentActions(TENANT_A, { approvalStatus: 'proposed' });
    expect(proposed.length).toBe(result.proposedActionIds.length);
    // run.created + action.proposed events emitted
    const events = await repo.listEvents(TENANT_A);
    expect(events.some((e) => e.event_name === 'agent.run.created.v1')).toBe(true);
    expect(events.some((e) => e.event_name === 'agent.action.proposed.v1')).toBe(true);
  });

  it('excludes suppressed contacts from proposals', async () => {
    const result = await svc.mira.run({
      tenantId: TENANT_A,
      objective: 'outbound',
      traceId: 'trace-1',
    });
    expect(result.excludedSuppressed).toContain(`contact:${CONTACT_SUPPRESSED}`);

    const emailActions = (await repo.listAgentActions(TENANT_A)).filter(
      (a) => a.action_type === 'email.draft.send',
    );
    // The only email proposal targets the non-suppressed contact.
    expect(emailActions.every((a) => a.target_ref === `contact:${CONTACT_OK}`)).toBe(true);
    expect(emailActions.some((a) => a.target_ref === `contact:${CONTACT_SUPPRESSED}`)).toBe(false);
  });

  it('generated messages include evidence refs in metadata', async () => {
    await svc.mira.run({ tenantId: TENANT_A, objective: 'outbound', traceId: 'trace-1' });
    const emailAction = (await repo.listAgentActions(TENANT_A)).find(
      (a) => a.action_type === 'email.draft.send',
    );
    expect(emailAction).toBeDefined();
    expect(emailAction!.evidence_refs.length).toBeGreaterThan(0);
    // And the stored draft echoes the same evidence refs.
    const draft = await svc.draftStore.get(emailAction!.payload_ref!);
    expect(draft?.evidence_refs.length).toBeGreaterThan(0);
  });

  it('refuses to execute an action that is not approved', async () => {
    await svc.mira.run({ tenantId: TENANT_A, objective: 'outbound', traceId: 'trace-1' });
    const action = (await repo.listAgentActions(TENANT_A, { approvalStatus: 'proposed' })).find(
      (a) => a.action_type === 'email.draft.send',
    )!;
    await expect(svc.ledger.execute(TENANT_A, action.id)).rejects.toBeInstanceOf(ExecutionError);
    expect(emailAdapter.sentCount()).toBe(0);
  });

  it('executes only after approval, and duplicate execution is idempotent', async () => {
    await svc.mira.run({ tenantId: TENANT_A, objective: 'outbound', traceId: 'trace-1' });
    const action = (await repo.listAgentActions(TENANT_A, { approvalStatus: 'proposed' })).find(
      (a) => a.action_type === 'email.draft.send',
    )!;

    await svc.ledger.approve(TENANT_A, action.id, 'user:operator');
    const first = await svc.ledger.execute(TENANT_A, action.id);
    expect(first.execution_status).toBe('executed');

    // Execute again — must not send twice.
    const second = await svc.ledger.execute(TENANT_A, action.id);
    expect(second.execution_status).toBe('executed');
    expect(emailAdapter.sentCount()).toBe(1);
  });

  it('keeps proposals tenant-isolated', async () => {
    await svc.mira.run({ tenantId: TENANT_A, objective: 'outbound', traceId: 'trace-1' });
    const bActions = await repo.listAgentActions(TENANT_B, { approvalStatus: 'proposed' });
    expect(bActions).toHaveLength(0);
  });

  it('proposing twice is idempotent (no duplicate actions)', async () => {
    const first = await svc.mira.run({ tenantId: TENANT_A, objective: 'outbound', traceId: 't1' });
    const before = (await repo.listAgentActions(TENANT_A)).length;
    // Re-run with identical inputs => same idempotency keys => no new actions.
    await svc.mira.run({ tenantId: TENANT_A, objective: 'outbound', traceId: 't2' });
    const after = (await repo.listAgentActions(TENANT_A)).length;
    expect(after).toBe(before);
    expect(first.proposedActionIds.length).toBeGreaterThan(0);
  });
});
