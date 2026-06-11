import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Repository, AgentRunRow, AgentActionRow, EventRow } from './repository.js';

/**
 * Shared repository contract. Both the in-memory repo and the production
 * Kysely+PGlite repo are run against THESE expectations, so behavior can't drift
 * between the test reference and production. FK-aware: it seeds tenants and
 * parent rows via the harness before dependent inserts (the in-memory repo
 * ignores `ensureTenant`; the Postgres-backed harness honors it).
 */
export interface RepositoryHarness {
  repo: Repository;
  /** Ensure a tenant row exists (no-op for in-memory; real insert for Postgres). */
  ensureTenant(tenantId: string): Promise<void>;
  /** Seed an integration connection (ENF-1 kill-switch contract coverage). */
  seedConnection(tenantId: string, externalSystem: string, status: string): Promise<void>;
  dispose(): Promise<void>;
}

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const ts = '2026-06-06T00:00:00.000Z';

function agentRun(tenantId: string, id: string): AgentRunRow {
  return {
    id,
    tenant_id: tenantId,
    agent: 'mira',
    objective: 'outbound',
    input_refs: ['playbook:1'],
    status: 'running',
    trace_id: 'trace-1',
    created_at: ts,
    updated_at: ts,
  };
}

function agentAction(tenantId: string, runId: string, id: string, key: string): AgentActionRow {
  return {
    id,
    tenant_id: tenantId,
    agent_run_id: runId,
    action_type: 'email.draft.send',
    risk_level: 'high',
    idempotency_key: key,
    approval_status: 'proposed',
    execution_status: 'pending',
    target_ref: `contact:${randomUUID()}`,
    simulation: null,
    proof_id: null,
    evidence_refs: ['e1', 'e2'],
    payload_ref: 'draft:1',
    guardrail_results: [{ name: 'evidence', passed: true }],
    result: null,
    created_at: ts,
    updated_at: ts,
  };
}

function event(tenantId: string, entityId: string): EventRow {
  return {
    id: randomUUID(),
    tenant_id: tenantId,
    event_name: 'crm.account.created.v1',
    entity_type: 'account',
    entity_id: entityId,
    source: 'hubspot',
    occurred_at: ts,
    ingested_at: ts,
    payload: { external_id: 'co-1' },
    trace_id: 'trace-1',
    created_at: ts,
  };
}

/**
 * Register the contract against a harness factory. Call from a `*.test.ts`.
 */
export function repositoryContract(
  label: string,
  makeHarness: () => Promise<RepositoryHarness>,
): void {
  describe(`Repository contract: ${label}`, () => {
    let h: RepositoryHarness;
    let repo: Repository;

    beforeEach(async () => {
      h = await makeHarness();
      repo = h.repo;
      await h.ensureTenant(TENANT_A);
      await h.ensureTenant(TENANT_B);
    });
    afterEach(async () => {
      await h.dispose();
    });

    it('external_object_map: account ingest is idempotent', async () => {
      const input = {
        tenantId: TENANT_A,
        externalSystem: 'hubspot',
        externalId: 'co-1',
        account: { name: 'Acme', industry: 'SaaS', employeeCount: 200 },
      };
      const first = await repo.ingestExternalAccount(input);
      const second = await repo.ingestExternalAccount(input);
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.id).toBe(first.id);
      expect(await repo.listAccounts(TENANT_A)).toHaveLength(1);
    });

    it('contact ingest is idempotent and links to its account', async () => {
      const acc = await repo.ingestExternalAccount({
        tenantId: TENANT_A,
        externalSystem: 'hubspot',
        externalId: 'co-1',
        account: { name: 'Acme' },
      });
      const contactInput = {
        tenantId: TENANT_A,
        externalSystem: 'hubspot',
        externalId: 'ct-1',
        contact: { accountId: acc.id, fullName: 'Ada', emailHash: 'sha256:ada' },
      };
      const first = await repo.ingestExternalContact(contactInput);
      const second = await repo.ingestExternalContact(contactInput);
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.contactId).toBe(first.contactId);

      const linked = await repo.listContactsByAccount(TENANT_A, acc.id);
      expect(linked).toHaveLength(1);
      expect(linked[0]!.full_name).toBe('Ada');
    });

    it('opportunity ingest is idempotent and links to its account (numeric amount)', async () => {
      const acc = await repo.ingestExternalAccount({
        tenantId: TENANT_A,
        externalSystem: 'hubspot',
        externalId: 'co-1',
        account: { name: 'Acme' },
      });
      const dealInput = {
        tenantId: TENANT_A,
        externalSystem: 'hubspot',
        externalId: 'd-1',
        opportunity: {
          accountId: acc.id,
          name: 'Acme Expansion',
          stage: 'qualified',
          amount: 50000,
        },
      };
      const first = await repo.ingestExternalOpportunity(dealInput);
      const second = await repo.ingestExternalOpportunity(dealInput);
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.id).toBe(first.id);

      const opps = await repo.listOpportunitiesByAccount(TENANT_A, acc.id);
      expect(opps).toHaveLength(1);
      expect(opps[0]!.name).toBe('Acme Expansion');
      expect(Number(opps[0]!.amount)).toBe(50000);
    });

    it('tenant isolation: tenant A rows are invisible to tenant B', async () => {
      const acc = await repo.ingestExternalAccount({
        tenantId: TENANT_A,
        externalSystem: 'hubspot',
        externalId: 'co-1',
        account: { name: 'Acme' },
      });
      expect(await repo.listAccounts(TENANT_B)).toHaveLength(0);
      expect(await repo.getAccount(TENANT_B, acc.id)).toBeNull();
      expect(
        await repo.findInternalIdByExternal(TENANT_B, 'hubspot', 'company', 'co-1'),
      ).toBeNull();
      // ...and resolves correctly for the owning tenant.
      expect(await repo.findInternalIdByExternal(TENANT_A, 'hubspot', 'company', 'co-1')).toBe(
        acc.id,
      );
    });

    it('event inserts round-trip the JSONB payload', async () => {
      const acc = await repo.ingestExternalAccount({
        tenantId: TENANT_A,
        externalSystem: 'hubspot',
        externalId: 'co-1',
        account: { name: 'Acme' },
      });
      await repo.insertEvent(event(TENANT_A, acc.id));
      const events = await repo.listEvents(TENANT_A);
      expect(events).toHaveLength(1);
      expect(events[0]!.event_name).toBe('crm.account.created.v1');
      expect(events[0]!.payload).toEqual({ external_id: 'co-1' });
      expect(await repo.listEvents(TENANT_B)).toHaveLength(0);
    });

    it('kill switch: connection status updates round-trip and are tenant-scoped (ENF-1)', async () => {
      await h.seedConnection(TENANT_A, 'hubspot', 'active');
      const before = await repo.getIntegrationConnection(TENANT_A, 'hubspot');
      expect(before?.status).toBe('active');

      const paused = await repo.updateIntegrationConnectionStatus(TENANT_A, 'hubspot', 'paused');
      expect(paused?.status).toBe('paused');
      expect((await repo.getIntegrationConnection(TENANT_A, 'hubspot'))?.status).toBe('paused');

      // Tenant-scoped: updating B's (non-existent) connection touches nothing.
      expect(
        await repo.updateIntegrationConnectionStatus(TENANT_B, 'hubspot', 'active'),
      ).toBeNull();
      expect((await repo.getIntegrationConnection(TENANT_A, 'hubspot'))?.status).toBe('paused');

      const resumed = await repo.updateIntegrationConnectionStatus(TENANT_A, 'hubspot', 'active');
      expect(resumed?.status).toBe('active');
    });

    it('agent_action create is idempotent on (tenant, idempotency_key)', async () => {
      const run = agentRun(TENANT_A, randomUUID());
      await repo.createAgentRun(run);
      const a1 = agentAction(TENANT_A, run.id, randomUUID(), 'key-xyz');
      const a2 = agentAction(TENANT_A, run.id, randomUUID(), 'key-xyz');
      const first = await repo.createAgentAction(a1);
      const second = await repo.createAgentAction(a2);
      expect(second.id).toBe(first.id);
      expect(await repo.listAgentActions(TENANT_A)).toHaveLength(1);
    });

    it('listAgentRuns returns a tenant’s runs and is tenant-scoped (RUN-1)', async () => {
      await repo.createAgentRun(agentRun(TENANT_A, randomUUID()));
      await repo.createAgentRun(agentRun(TENANT_A, randomUUID()));
      await repo.createAgentRun(agentRun(TENANT_B, randomUUID()));
      expect(await repo.listAgentRuns(TENANT_A)).toHaveLength(2);
      expect(await repo.listAgentRuns(TENANT_B)).toHaveLength(1);
    });

    it('agent_action update writes JSONB result and status', async () => {
      const run = agentRun(TENANT_A, randomUUID());
      await repo.createAgentRun(run);
      const action = await repo.createAgentAction(
        agentAction(TENANT_A, run.id, randomUUID(), 'key-1'),
      );
      const updated = await repo.updateAgentAction(TENANT_A, action.id, {
        approval_status: 'approved',
        execution_status: 'executed',
        result: { ok: true, external_ref: 'email:abc' },
      });
      expect(updated.approval_status).toBe('approved');
      expect(updated.result).toEqual({ ok: true, external_ref: 'email:abc' });

      const proposed = await repo.listAgentActions(TENANT_A, { approvalStatus: 'proposed' });
      expect(proposed).toHaveLength(0);
    });

    it('feedback_labels round-trip JSONB detail and filter by subject + tenant', async () => {
      const actionId = randomUUID();
      await repo.insertFeedbackLabel({
        id: randomUUID(),
        tenant_id: TENANT_A,
        subject_ref: `agent_action:${actionId}`,
        label: 'approved',
        detail: { reason_code: 'high_value_target', note: 'ICP match', approver_ref: 'user:op' },
        created_at: ts,
        updated_at: ts,
      });
      await repo.insertFeedbackLabel({
        id: randomUUID(),
        tenant_id: TENANT_A,
        subject_ref: `agent_action:${randomUUID()}`,
        label: 'rejected',
        detail: { reason_code: 'wrong_target', note: null, approver_ref: 'user:op' },
        created_at: ts,
        updated_at: ts,
      });

      const bySubject = await repo.listFeedbackLabels(TENANT_A, `agent_action:${actionId}`);
      expect(bySubject).toHaveLength(1);
      expect(bySubject[0]!.label).toBe('approved');
      expect(bySubject[0]!.detail).toEqual({
        reason_code: 'high_value_target',
        note: 'ICP match',
        approver_ref: 'user:op',
      });

      expect(await repo.listFeedbackLabels(TENANT_A)).toHaveLength(2);
      // Tenant isolation: invisible to tenant B.
      expect(await repo.listFeedbackLabels(TENANT_B)).toHaveLength(0);
    });

    it('sync_runs lifecycle persists JSONB stats', async () => {
      const run = await repo.createSyncRun({ tenantId: TENANT_A });
      expect(run.status).toBe('running');
      const finished = await repo.updateSyncRun(TENANT_A, run.id, {
        status: 'completed',
        finished_at: ts,
        stats: { companies: { created: 1 }, contacts: { created: 2 } },
      });
      expect(finished.status).toBe('completed');
      expect(finished.stats).toEqual({ companies: { created: 1 }, contacts: { created: 2 } });
    });
  });
}
