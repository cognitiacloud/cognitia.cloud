import { describe, it, expect } from 'vitest';
import { InMemoryRepository, type AccountRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import type {
  HubspotClient,
  HubspotWriteInput,
  HubspotWriteResult,
  HubspotPage,
} from '@cognitia/integrations';

/**
 * CRM-1: the injected HubSpot client is used by the execute path, and the
 * approve→execute of a Mira-proposed `crm.task.create` is idempotent.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-06T00:00:00.000Z';

/** Counting fake so we can assert the execute path calls the injected client. */
class CountingHubspotClient implements HubspotClient {
  taskCalls = 0;
  private readonly byKey = new Map<string, HubspotWriteResult>();
  async createTask(input: HubspotWriteInput): Promise<HubspotWriteResult> {
    const prior = this.byKey.get(input.idempotencyKey);
    if (prior) return { ...prior, idempotentReplay: true };
    this.taskCalls++;
    const res: HubspotWriteResult = {
      externalRef: `hubspot:task:${input.idempotencyKey.slice(0, 8)}`,
      idempotentReplay: false,
    };
    this.byKey.set(input.idempotencyKey, res);
    return res;
  }
  async createNote(input: HubspotWriteInput): Promise<HubspotWriteResult> {
    return this.createTask(input);
  }
  async listObjectProperties(): Promise<string[]> {
    return [];
  }
  async archiveEngagement(): Promise<void> {
    /* not exercised in this suite */
  }
  async listCompanies(): Promise<HubspotPage<never>> {
    return { items: [] };
  }
  async listContacts(): Promise<HubspotPage<never>> {
    return { items: [] };
  }
  async listDeals(): Promise<HubspotPage<never>> {
    return { items: [] };
  }
}

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
  repo.seedAccount(account);
  return repo;
}

describe('CRM-1 — execute path uses the injected HubSpot client (idempotent)', () => {
  it('approve → execute a crm.task.create hits the client exactly once', async () => {
    const repo = seededRepo();
    const client = new CountingHubspotClient();
    const services = createGtmServices({ repo, v1Mode: true, hubspotClient: client });

    // Mira (v1) proposes a crm.task.create for the account.
    await services.mira.run({ tenantId: TENANT, objective: 'x', traceId: 't' });
    const proposed = await repo.listAgentActions(TENANT, { approvalStatus: 'proposed' });
    const task = proposed.find((a) => a.action_type === 'crm.task.create');
    expect(task).toBeDefined();

    await services.ledger.approve(TENANT, task!.id, 'user:operator', {
      reasonCode: 'accurate_and_relevant',
    });
    const first = await services.ledger.execute(TENANT, task!.id);
    expect(first.execution_status).toBe('executed');
    expect(client.taskCalls).toBe(1);

    // Idempotent: re-execute does not call the client again.
    const second = await services.ledger.execute(TENANT, task!.id);
    expect(second.execution_status).toBe('executed');
    expect(client.taskCalls).toBe(1);
  });
});
