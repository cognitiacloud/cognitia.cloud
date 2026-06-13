import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type {
  Repository,
  AgentRunRow,
  AgentActionRow,
  EventRow,
  ProofRow,
  AgentRow,
  AtcRow,
} from './repository.js';

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

    it('proofs: insert, tenant-scoped list with filters, publish-state mutation (COG-003)', async () => {
      const mkProof = (tenantId: string, id: string, tag: ProofRow['evidence_tag']): ProofRow => ({
        id,
        tenant_id: tenantId,
        kind: 'system',
        subject_type: 'agent',
        subject_id: randomUUID(),
        evidence_tag: tag,
        evidence_ref: tag === 'verified_fact' ? 'log:contract' : null,
        verifier_ref: tag === 'verified_fact' ? 'user:contract' : null,
        summary_public: 'synthetic contract proof',
        details_private: { note: 'never public' },
        public_safe: false,
        redaction_check_passed_at: null,
        supersedes_proof_id: null,
        external_attestation_ref: null,
        created_at: ts,
      });

      const verified = await repo.insertProof(mkProof(TENANT_A, randomUUID(), 'verified_fact'));
      await repo.insertProof(mkProof(TENANT_A, randomUUID(), 'unknown'));
      await repo.insertProof(mkProof(TENANT_B, randomUUID(), 'verified_fact'));

      // Tenant scoping + filters.
      expect(await repo.listProofs(TENANT_A)).toHaveLength(2);
      expect(await repo.listProofs(TENANT_A, { evidenceTag: 'verified_fact' })).toHaveLength(1);
      expect(await repo.listProofs(TENANT_B)).toHaveLength(1);
      expect(await repo.getProof(TENANT_B, verified.id)).toBeNull();

      // public_safe defaults false; the publish-state pair is the only mutation.
      expect((await repo.getProof(TENANT_A, verified.id))?.public_safe).toBe(false);
      const published = await repo.setProofPublishState(TENANT_A, verified.id, true, ts);
      expect(published?.public_safe).toBe(true);
      // Drivers may return timestamptz as Date or string; compare instants.
      expect(new Date(published!.redaction_check_passed_at!).toISOString()).toBe(ts);
      expect(await repo.listProofs(TENANT_A, { publicSafe: true })).toHaveLength(1);

      // Tenant-scoped mutation: tenant B cannot publish A's proof.
      expect(await repo.setProofPublishState(TENANT_B, verified.id, false, null)).toBeNull();
    });

    it('agents/ATC/permissions: tenant-scoped CRUD, revoked-terminal, permission upsert (COG-004)', async () => {
      const agent: AgentRow = {
        id: randomUUID(),
        tenant_id: TENANT_A,
        name: 'Contract Agent',
        slug: `contract-agent-${randomUUID().slice(0, 8)}`,
        runtime_key: null,
        kind: 'front_desk',
        status: 'draft',
        description: null,
        created_at: ts,
        updated_at: ts,
      };
      await repo.createAgent(agent);
      expect((await repo.getAgent(TENANT_A, agent.id))?.name).toBe('Contract Agent');
      expect(await repo.getAgent(TENANT_B, agent.id)).toBeNull();

      const atc: AtcRow = {
        id: randomUUID(),
        tenant_id: TENANT_A,
        agent_id: agent.id,
        issuer: 'cognitia.internal',
        subject_ref: `agent:${agent.id}`,
        claims: { scope: ['lead.read'], policy_refs: [] },
        status: 'active',
        issued_at: ts,
        expires_at: null,
        external_ref: null,
        version: 1,
        created_at: ts,
        updated_at: ts,
      };
      await repo.createAtc(atc);
      expect((await repo.listAtcsByAgent(TENANT_A, agent.id))[0]?.status).toBe('active');

      const suspended = await repo.updateAtcStatus(TENANT_A, atc.id, 'suspended');
      expect(suspended?.status).toBe('suspended');
      // Tenant-scoped: B cannot touch A's credential.
      expect(await repo.updateAtcStatus(TENANT_B, atc.id, 'revoked')).toBeNull();
      await repo.updateAtcStatus(TENANT_A, atc.id, 'revoked');
      // Revoked is terminal in BOTH implementations (trigger in PG, mirror in memory).
      await expect(repo.updateAtcStatus(TENANT_A, atc.id, 'active')).rejects.toThrow(/revoked/i);

      // Permission upsert on (tenant, agent, action_key).
      const perm = {
        id: randomUUID(),
        tenant_id: TENANT_A,
        agent_id: agent.id,
        action_key: 'sms.send_real',
        effect: 'deny',
        constraints: {},
        created_at: ts,
        updated_at: ts,
      };
      await repo.upsertAgentPermission(perm);
      const updated = await repo.upsertAgentPermission({
        ...perm,
        id: randomUUID(),
        effect: 'allow',
        constraints: { approval_required: true },
      });
      expect(updated.effect).toBe('allow');
      expect(await repo.listAgentPermissions(TENANT_A, agent.id)).toHaveLength(1);
      expect(await repo.listAgentPermissions(TENANT_B, agent.id)).toHaveLength(0);
    });

    it('lead intakes: tenant-scoped insert/list and PII purge invariant (COG-006)', async () => {
      const intake = {
        id: randomUUID(),
        tenant_id: TENANT_A,
        lead_id: null,
        source: 'sms_sim',
        channel_ref: null,
        contact_name_enc: 'enc:v1:fixture-name',
        contact_phone_enc: 'enc:v1:fixture-phone',
        contact_phone_hash: 'sha256:fixture',
        message_body_enc: 'enc:v1:fixture-body',
        received_at: ts,
        consent_captured: true,
        pii_status: 'raw',
        status: 'new',
        created_at: ts,
        updated_at: ts,
      };
      await repo.insertLeadIntake(intake);
      expect(await repo.listLeadIntakes(TENANT_A)).toHaveLength(1);
      expect(await repo.listLeadIntakes(TENANT_B)).toHaveLength(0);
      expect(await repo.getLeadIntake(TENANT_B, intake.id)).toBeNull();

      // Purge: PII columns blank + status flip together (0011 check constraint).
      expect(await repo.purgeLeadIntakePii(TENANT_B, intake.id)).toBeNull();
      const purged = await repo.purgeLeadIntakePii(TENANT_A, intake.id);
      expect(purged?.pii_status).toBe('purged');
      expect(purged?.contact_name_enc).toBeNull();
      expect(purged?.contact_phone_enc).toBeNull();
      expect(purged?.message_body_enc).toBeNull();
    });

    it('credits + wallet: atomic balanced pair, idempotency uniqueness, placeholder-only bindings (COG-009)', async () => {
      const account = (owner_type: string, owner_id: string) => ({
        id: randomUUID(),
        tenant_id: TENANT_A,
        owner_type,
        owner_id,
        status: 'active',
        created_at: ts,
        updated_at: ts,
      });
      const treasury = await repo.upsertCreditsAccount(account('system', randomUUID()));
      const agentAcct = await repo.upsertCreditsAccount(account('agent', randomUUID()));
      // Upsert is idempotent on (tenant, owner_type, owner_id).
      const again = await repo.upsertCreditsAccount({ ...treasury, id: randomUUID() });
      expect(again.id).toBe(treasury.id);

      const entry = (
        direction: 'debit' | 'credit',
        accountId: string,
        counterId: string,
        key: string,
      ) => ({
        id: randomUUID(),
        tenant_id: TENANT_A,
        account_id: accountId,
        counter_account_id: counterId,
        amount: 100,
        direction,
        rail: 'internal_credits',
        reason_code: 'grant',
        idempotency_key: key,
        created_at: ts,
      });
      await repo.insertCreditsLedgerPair(
        entry('debit', treasury.id, agentAcct.id, 'contract-xfer-1'),
        entry('credit', agentAcct.id, treasury.id, 'contract-xfer-1'),
      );
      expect(await repo.listCreditsLedgerEntries(TENANT_A)).toHaveLength(2);
      expect(
        await repo.findCreditsLedgerByIdempotencyKey(TENANT_A, 'contract-xfer-1'),
      ).toHaveLength(2);
      // Replays violate the unique (tenant, key, direction) in BOTH impls.
      await expect(
        repo.insertCreditsLedgerPair(
          entry('debit', treasury.id, agentAcct.id, 'contract-xfer-1'),
          entry('credit', agentAcct.id, treasury.id, 'contract-xfer-1'),
        ),
      ).rejects.toThrow(/duplicate key/i);
      expect(await repo.listCreditsLedgerEntries(TENANT_B)).toHaveLength(0);

      // Wallet bindings: placeholder is the only legal status in v1.1.
      await repo.insertWalletBinding({
        id: randomUUID(),
        tenant_id: TENANT_A,
        owner_type: 'agent',
        owner_id: agentAcct.owner_id,
        chain: 'none',
        address: null,
        status: 'placeholder',
        created_at: ts,
        updated_at: ts,
      });
      await expect(
        repo.insertWalletBinding({
          id: randomUUID(),
          tenant_id: TENANT_A,
          owner_type: 'agent',
          owner_id: randomUUID(),
          chain: 'none',
          address: null,
          status: 'active',
          created_at: ts,
          updated_at: ts,
        }),
      ).rejects.toThrow(/placeholder|check/i);
      expect(await repo.listWalletBindings(TENANT_A)).toHaveLength(1);
      expect(await repo.listWalletBindings(TENANT_B)).toHaveLength(0);

      // Deactivation (0014): placeholder → deactivated, tenant-scoped; no
      // activation path exists on the interface at all.
      const binding = (await repo.listWalletBindings(TENANT_A))[0]!;
      expect(await repo.deactivateWalletBinding(TENANT_B, binding.id)).toBeNull();
      const deactivated = await repo.deactivateWalletBinding(TENANT_A, binding.id);
      expect(deactivated?.status).toBe('deactivated');
      expect((await repo.getWalletBinding(TENANT_A, binding.id))?.status).toBe('deactivated');
    });

    it('work orders: terminal states + verified_fact-only release; executions are simulation-locked (AGENT-ECONOMY-001)', async () => {
      const requester = await repo.createAgent({
        id: randomUUID(),
        tenant_id: TENANT_A,
        name: 'Requester',
        slug: `req-${randomUUID().slice(0, 8)}`,
        runtime_key: null,
        kind: 'internal_ops',
        status: 'active',
        description: null,
        created_at: ts,
        updated_at: ts,
      });
      const workOrder = () => ({
        id: randomUUID(),
        tenant_id: TENANT_A,
        requester_agent_id: requester.id,
        worker_agent_id: null,
        skill_version_id: null,
        title: 'Summarize the contract suite',
        description: null,
        status: 'proposed',
        requested_credits: 50,
        escrow_status: 'none',
        escrow_account_id: null,
        proof_required: true,
        proof_id: null,
        outcome_type: null,
        evidence_tag: null,
        resolution_proof_id: null,
        created_at: ts,
        updated_at: ts,
      });

      const wo = await repo.insertWorkOrder(workOrder());
      expect((await repo.getWorkOrder(TENANT_A, wo.id))?.status).toBe('proposed');
      expect(await repo.listWorkOrders(TENANT_A, { status: 'proposed' })).toHaveLength(1);
      // Tenant isolation.
      expect(await repo.getWorkOrder(TENANT_B, wo.id)).toBeNull();
      expect(await repo.listWorkOrders(TENANT_B)).toHaveLength(0);

      // Verification without a verified_fact proof is refused by BOTH impls.
      await expect(repo.updateWorkOrder(TENANT_A, wo.id, { status: 'verified' })).rejects.toThrow(
        /proof/i,
      );
      const inference = await repo.insertProof({
        id: randomUUID(),
        tenant_id: TENANT_A,
        kind: 'skill_demo',
        subject_type: 'work_order',
        subject_id: wo.id,
        evidence_tag: 'likely_inference',
        evidence_ref: null,
        verifier_ref: null,
        summary_public: null,
        details_private: {},
        public_safe: false,
        redaction_check_passed_at: null,
        supersedes_proof_id: null,
        external_attestation_ref: null,
        created_at: ts,
      });
      await expect(
        repo.updateWorkOrder(TENANT_A, wo.id, { status: 'verified', proof_id: inference.id }),
      ).rejects.toThrow(/verified_fact/i);

      // With a verified_fact proof the transition succeeds — then is terminal.
      const verified = await repo.insertProof({
        ...inference,
        id: randomUUID(),
        evidence_tag: 'verified_fact',
        evidence_ref: `execution:${randomUUID()}`,
        verifier_ref: 'verifier:economy-lab',
      });
      const done = await repo.updateWorkOrder(TENANT_A, wo.id, {
        status: 'verified',
        escrow_status: 'released',
        proof_id: verified.id,
        evidence_tag: 'verified_fact',
      });
      expect(done?.status).toBe('verified');
      await expect(repo.updateWorkOrder(TENANT_A, wo.id, { status: 'canceled' })).rejects.toThrow(
        /terminal/i,
      );

      // Execution orders are simulation-locked in both impls.
      const skill = await repo.upsertSkill({
        id: randomUUID(),
        tenant_id: TENANT_A,
        name: 'Contract Skill',
        slug: `contract-skill-${randomUUID().slice(0, 8)}`,
        category: 'analysis',
        description: null,
        visibility: 'internal',
        namespace: 'cognitia.core',
        source_path: null,
        owner_agent_id: null,
        created_at: ts,
        updated_at: ts,
      });
      const version = await repo.insertSkillVersion({
        id: randomUUID(),
        tenant_id: TENANT_A,
        skill_id: skill.id,
        version: '1.0.0',
        spec: {},
        status: 'active',
        manifest_hash: null,
        content_hash: null,
        metadata: {},
        proof_tier: 0,
        yanked: false,
        yank_reason: null,
        created_at: ts,
        updated_at: ts,
      });
      const versionId = version.id;
      const execution = (simulation: boolean) => ({
        id: randomUUID(),
        tenant_id: TENANT_A,
        work_order_id: wo.id,
        worker_agent_id: requester.id,
        skill_version_id: versionId,
        status: 'ordered',
        simulation,
        result: {},
        proof_id: null,
        started_at: null,
        finished_at: null,
        created_at: ts,
        updated_at: ts,
      });
      await expect(repo.insertSkillExecutionOrder(execution(false))).rejects.toThrow(
        /simulation|check/i,
      );
    });

    it('dispute resolutions: disputed-origin, conserved split, one per order, verified_fact-gated resolve (AGENT-ECONOMY-002)', async () => {
      const agent = await repo.createAgent({
        id: randomUUID(),
        tenant_id: TENANT_A,
        name: 'Disputant',
        slug: `disputant-${randomUUID().slice(0, 8)}`,
        runtime_key: null,
        kind: 'internal_ops',
        status: 'active',
        description: null,
        created_at: ts,
        updated_at: ts,
      });
      const wo = await repo.insertWorkOrder({
        id: randomUUID(),
        tenant_id: TENANT_A,
        requester_agent_id: agent.id,
        worker_agent_id: agent.id,
        skill_version_id: null,
        title: 'Disputed work',
        description: null,
        status: 'proposed',
        requested_credits: 100,
        escrow_status: 'none',
        escrow_account_id: null,
        proof_required: true,
        proof_id: null,
        outcome_type: null,
        evidence_tag: null,
        resolution_proof_id: null,
        created_at: ts,
        updated_at: ts,
      });
      const resolution = (over: Record<string, unknown> = {}) => ({
        id: randomUUID(),
        tenant_id: TENANT_A,
        work_order_id: wo.id,
        decision: 'split',
        reason_code: 'partial_delivery',
        note: null,
        worker_credits: 60,
        requester_credits: 40,
        resolved_by: 'user:owner',
        proof_id: proofId,
        created_at: ts,
        ...over,
      });
      const proofRow = await repo.insertProof({
        id: randomUUID(),
        tenant_id: TENANT_A,
        kind: 'system',
        subject_type: 'work_order',
        subject_id: wo.id,
        evidence_tag: 'verified_fact',
        evidence_ref: 'dispute_resolution:contract',
        verifier_ref: 'user:owner',
        summary_public: null,
        details_private: {},
        public_safe: false,
        redaction_check_passed_at: null,
        supersedes_proof_id: null,
        external_attestation_ref: null,
        created_at: ts,
      });
      const proofId = proofRow.id;

      // Not disputed yet → refused by trigger + mirror.
      await expect(repo.insertDisputeResolution(resolution({ proof_id: proofId }))).rejects.toThrow(
        /not disputed/i,
      );
      await repo.updateWorkOrder(TENANT_A, wo.id, {
        status: 'disputed',
        escrow_status: 'disputed',
      });
      // Non-conserved math → refused.
      await expect(
        repo.insertDisputeResolution(
          resolution({ proof_id: proofId, worker_credits: 60, requester_credits: 50 }),
        ),
      ).rejects.toThrow(/conserve/i);
      // Valid split lands; second resolution for the same order is refused.
      const stored = await repo.insertDisputeResolution(resolution({ proof_id: proofId }));
      expect((await repo.getDisputeResolutionByWorkOrder(TENANT_A, wo.id))?.id).toBe(stored.id);
      await expect(repo.insertDisputeResolution(resolution({ proof_id: proofId }))).rejects.toThrow(
        /duplicate|unique/i,
      );
      // Tenant isolation.
      expect(await repo.getDisputeResolutionByWorkOrder(TENANT_B, wo.id)).toBeNull();
      expect(await repo.listDisputeResolutions(TENANT_B)).toHaveLength(0);

      // Resolve transition: refused without the proof, allowed with it, terminal after.
      await expect(repo.updateWorkOrder(TENANT_A, wo.id, { status: 'resolved' })).rejects.toThrow(
        /resolution/i,
      );
      const resolved = await repo.updateWorkOrder(TENANT_A, wo.id, {
        status: 'resolved',
        escrow_status: 'resolved',
        resolution_proof_id: proofId,
      });
      expect(resolved?.status).toBe('resolved');
      await expect(repo.updateWorkOrder(TENANT_A, wo.id, { status: 'disputed' })).rejects.toThrow(
        /terminal/i,
      );
    });
  });
}
