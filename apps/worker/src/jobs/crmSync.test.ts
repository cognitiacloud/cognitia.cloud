import { describe, it, expect } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { FakeHubspotClient, type HubspotClient } from '@cognitia/integrations';
import { crmSyncJob } from './crmSync.js';
import { workerEntityId } from '../heartbeat.js';

/**
 * OBS-1 — the crm-sync job emits a `worker.heartbeat.v1` event after every
 * cycle, including failed ones: liveness ("the worker runs") and sync success
 * are separate signals. The sync failure itself is recorded in sync_runs.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const NOW = '2026-06-13T12:00:00.000Z';

function seedConnection(repo: InMemoryRepository): void {
  repo.seedIntegrationConnection({
    id: 'conn-1',
    tenant_id: TENANT,
    external_system: 'hubspot',
    status: 'active',
    credential_ref: 'cred-1',
    metadata: {},
    created_at: NOW,
    updated_at: NOW,
  });
}

async function heartbeats(repo: InMemoryRepository) {
  const events = await repo.listEvents(TENANT);
  return events.filter((e) => e.event_name === 'worker.heartbeat.recorded.v1');
}

describe('OBS-1 — crm-sync job heartbeat', () => {
  it('emits worker.heartbeat.recorded.v1 after a successful sync cycle', async () => {
    const repo = new InMemoryRepository();
    seedConnection(repo);
    const job = crmSyncJob({ repo, client: new FakeHubspotClient(), tenantId: TENANT });
    await job.run();

    const beats = await heartbeats(repo);
    expect(beats).toHaveLength(1);
    // Stable derived identity: all beats from one worker share one entity id.
    expect(beats[0]!.entity_id).toBe(workerEntityId('crm-sync-worker'));
    expect(beats[0]!.payload).toEqual({
      worker: 'crm-sync-worker',
      job: `crm-sync:${TENANT}`,
    });
  });

  it('still emits the heartbeat when the sync throws (liveness ≠ success)', async () => {
    const repo = new InMemoryRepository();
    seedConnection(repo);
    class BrokenHubspotClient extends FakeHubspotClient {
      override listCompanies(): ReturnType<HubspotClient['listCompanies']> {
        return Promise.reject(new Error('hubspot down'));
      }
    }

    const job = crmSyncJob({ repo, client: new BrokenHubspotClient(), tenantId: TENANT });
    await expect(job.run()).rejects.toThrow(/hubspot down/);

    const beats = await heartbeats(repo);
    expect(beats).toHaveLength(1);
  });
});
