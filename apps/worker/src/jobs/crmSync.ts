import { randomUUID } from 'node:crypto';
import type { Repository } from '@cognitia/db';
import { HubspotSyncService, type HubspotClient } from '@cognitia/integrations';
import type { Job } from '../index.js';
import { recordWorkerHeartbeat } from '../heartbeat.js';

/**
 * crm-sync job: run a HubSpot sync for a tenant connection. Idempotent and
 * tenant-scoped via the Repository + external_object_maps. The real HubspotClient
 * (OAuth, REST) is injected; the worker resolves it per `integration_connections`
 * row in a follow-up. Scheduling is driven by n8n (`crm-sync-schedule`).
 *
 * OBS-1: every completed cycle emits a `worker.heartbeat.v1` event — including
 * cycles whose sync FAILED (the failure is recorded separately in sync_runs;
 * the heartbeat proves the worker itself is alive and processing).
 */
export function crmSyncJob(opts: {
  repo: Repository;
  client: HubspotClient;
  tenantId: string;
  connectionId?: string | null;
}): Job {
  return {
    name: `crm-sync:${opts.tenantId}`,
    async run() {
      const traceId = randomUUID();
      const service = new HubspotSyncService(opts.repo, opts.client);
      try {
        await service.sync({
          tenantId: opts.tenantId,
          traceId,
          connectionId: opts.connectionId ?? null,
        });
      } finally {
        await recordWorkerHeartbeat(opts.repo, {
          tenantId: opts.tenantId,
          worker: 'crm-sync-worker',
          job: `crm-sync:${opts.tenantId}`,
          traceId,
        });
      }
    },
  };
}
