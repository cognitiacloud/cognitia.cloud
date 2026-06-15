import { describe, it, expect } from 'vitest';
import { InMemoryRepository } from './memory.js';
import type { AccountRow, ContactRow } from './repository.js';
import { repositoryContract } from './repository.contract.js';
import { verifyAuditChain } from './auditChain.js';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const now = new Date().toISOString();

// The in-memory repo runs against the SAME contract as the Kysely/PGlite repo.
repositoryContract('InMemoryRepository', async () => {
  const repo = new InMemoryRepository();
  return {
    repo,
    ensureTenant: async () => {}, // no tenants table in-memory
    seedConnection: async (tenantId, externalSystem, status) => {
      repo.seedIntegrationConnection({
        id: `conn-${tenantId.slice(0, 8)}-${externalSystem}`,
        tenant_id: tenantId,
        external_system: externalSystem,
        status,
        credential_ref: null,
        metadata: {},
        created_at: now,
        updated_at: now,
      });
    },
    dispose: async () => {},
  };
});

function account(id: string, tenant: string, name: string): AccountRow {
  return {
    id,
    tenant_id: tenant,
    name,
    domain: null,
    industry: null,
    employee_count: null,
    region: null,
    fit_score: 0.5,
    timing_score: 0.5,
    attributes: {},
    created_at: now,
    updated_at: now,
  };
}

function contact(id: string, tenant: string, accountId: string): ContactRow {
  return {
    id,
    tenant_id: tenant,
    account_id: accountId,
    full_name: 'X',
    title: null,
    persona: null,
    email_hash: null,
    phone_hash: null,
    is_suppressed: false,
    attributes: {},
    created_at: now,
    updated_at: now,
  };
}

describe('tenant isolation (in-memory repo emulating RLS)', () => {
  it('Tenant A cannot read Tenant B accounts', async () => {
    const repo = new InMemoryRepository();
    repo.seedAccount(account('a1', TENANT_A, 'A Co'));
    repo.seedAccount(account('b1', TENANT_B, 'B Co'));

    const aAccounts = await repo.listAccounts(TENANT_A);
    expect(aAccounts.map((a) => a.id)).toEqual(['a1']);

    // Direct id lookup across tenants returns null.
    expect(await repo.getAccount(TENANT_A, 'b1')).toBeNull();
    expect(await repo.getContact(TENANT_A, 'bc1')).toBeNull();
  });

  it('contacts are tenant-scoped', async () => {
    const repo = new InMemoryRepository();
    repo.seedAccount(account('a1', TENANT_A, 'A Co'));
    repo.seedContact(contact('ac1', TENANT_A, 'a1'));
    repo.seedContact(contact('bc1', TENANT_B, 'a1'));

    const aContacts = await repo.listContactsByAccount(TENANT_A, 'a1');
    expect(aContacts.map((c) => c.id)).toEqual(['ac1']);
  });
});

describe('agent_action idempotency at the store layer', () => {
  it('createAgentAction collapses duplicate idempotency keys', async () => {
    const repo = new InMemoryRepository();
    const base = {
      id: 'act-1',
      tenant_id: TENANT_A,
      agent_run_id: 'run-1',
      action_type: 'email.draft.send',
      risk_level: 'high',
      idempotency_key: 'key-xyz',
      approval_status: 'proposed',
      execution_status: 'pending',
      target_ref: 'contact:ac1',
      evidence_refs: ['e1'],
      payload_ref: null,
      guardrail_results: [],
      result: null,
      created_at: now,
      updated_at: now,
    };
    const first = await repo.createAgentAction({ ...base });
    const second = await repo.createAgentAction({ ...base, id: 'act-2' });
    expect(second.id).toBe(first.id); // same key => same row
    const all = await repo.listAgentActions(TENANT_A);
    expect(all).toHaveLength(1);
  });
});

/**
 * SEC-1 — tamper evidence on the in-memory engine: an in-process mutation of a
 * stored audit row (or a dropped row) is detected by chain verification. The
 * same property is proven against real Postgres in kysely.pglite.test.ts.
 */
describe('audit chain tamper evidence (in-memory mutation)', () => {
  async function seeded() {
    const repo = new InMemoryRepository();
    for (let n = 1; n <= 3; n++) {
      await repo.insertAuditEvent({
        id: `audit-${n}`,
        tenant_id: TENANT_A,
        actor_ref: 'user:sec',
        action: `step-${n}`,
        subject_ref: 'agent_action:a1',
        detail: { n },
        occurred_at: now,
        created_at: now,
      });
    }
    return repo;
  }

  it('a valid chain verifies; a mutated row is detected', async () => {
    const repo = await seeded();
    const rows = await repo.listAuditEvents(TENANT_A);
    expect(verifyAuditChain(rows)).toMatchObject({ ok: true, verified: 3 });
    rows[1]!.action = 'approved'; // in-process tamper with stored history
    expect(verifyAuditChain(await repo.listAuditEvents(TENANT_A))).toMatchObject({
      ok: false,
      failure: 'hash_mismatch',
      at: 'audit-2',
    });
  });

  it('a stripped chain field fails closed as unchained_row', async () => {
    const repo = await seeded();
    const rows = await repo.listAuditEvents(TENANT_A);
    rows[2]!.hash = null;
    expect(verifyAuditChain(await repo.listAuditEvents(TENANT_A))).toMatchObject({
      ok: false,
      failure: 'unchained_row',
    });
  });
});
