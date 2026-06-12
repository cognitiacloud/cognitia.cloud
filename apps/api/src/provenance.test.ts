import { describe, it, expect } from 'vitest';
import { InMemoryRepository, type AccountRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { grantMiraExecution } from './passportTestKit.js';

/**
 * PROV-1 — every executed CRM write carries execution lineage (agent / run /
 * action / evidence / risk / approver) into HubSpot, without breaking
 * idempotency or the approval requirement.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

async function seededRepo(): Promise<InMemoryRepository> {
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
  repo.seedAccount(account);
  await grantMiraExecution(repo, TENANT);
  return repo;
}

async function proposeTask(repo: InMemoryRepository, client: FakeHubspotClient) {
  const services = createGtmServices({ repo, v1Mode: true, hubspotClient: client });
  await services.mira.run({ tenantId: TENANT, objective: 'x', traceId: 't' });
  const proposed = await repo.listAgentActions(TENANT, { approvalStatus: 'proposed' });
  const task = proposed.find((a) => a.action_type === 'crm.task.create');
  if (!task) throw new Error('no crm.task.create proposed');
  return { services, task };
}

describe('PROV-1 — provenance stamped on CRM writes', () => {
  it('approve(reason) → execute stamps full lineage incl. approver on the write', async () => {
    const repo = await seededRepo();
    const client = new FakeHubspotClient();
    const { services, task } = await proposeTask(repo, client);

    await services.ledger.approve(TENANT, task.id, 'user:operator', {
      reasonCode: 'accurate_and_relevant',
    });
    const executed = await services.ledger.execute(TENANT, task.id);
    expect(executed.execution_status).toBe('executed');

    // The HubSpot write carried the lineage the customer can audit in their CRM.
    expect(client.writeLog).toHaveLength(1);
    const prov = client.writeLog[0]!.input.provenance;
    expect(prov).toBeDefined();
    expect(prov).toMatchObject({
      agent: 'mira',
      agent_run_id: task.agent_run_id,
      agent_action_id: task.id,
      risk_level: task.risk_level,
      approved_by: 'user:operator',
    });
    expect(prov!.evidence_count).toBe(task.evidence_refs.length);
  });

  it('idempotent re-execute does not write or re-stamp a second time', async () => {
    const repo = await seededRepo();
    const client = new FakeHubspotClient();
    const { services, task } = await proposeTask(repo, client);

    await services.ledger.approve(TENANT, task.id, 'user:operator', {
      reasonCode: 'meets_playbook',
    });
    await services.ledger.execute(TENANT, task.id);
    await services.ledger.execute(TENANT, task.id);

    // Approval requirement + idempotency intact: exactly one write recorded.
    expect(client.writeLog).toHaveLength(1);
  });

  it('refuses to execute (and never writes) without approval', async () => {
    const repo = await seededRepo();
    const client = new FakeHubspotClient();
    const { services, task } = await proposeTask(repo, client);

    await expect(services.ledger.execute(TENANT, task.id)).rejects.toThrow();
    expect(client.writeLog).toHaveLength(0);
  });

  it('omits approver when there is no approval label (degrades gracefully)', async () => {
    // Directly approve via the repo (no FLY-1 label), then execute: provenance
    // still attaches, just without approved_by — execution is never blocked.
    const repo = await seededRepo();
    const client = new FakeHubspotClient();
    const { services, task } = await proposeTask(repo, client);

    await repo.updateAgentAction(TENANT, task.id, { approval_status: 'approved' });
    const executed = await services.ledger.execute(TENANT, task.id);
    expect(executed.execution_status).toBe('executed');

    const prov = client.writeLog[0]!.input.provenance;
    expect(prov).toBeDefined();
    expect(prov!.agent_action_id).toBe(task.id);
    expect(prov!.approved_by).toBeUndefined();
  });
});
