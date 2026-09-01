import { randomUUID } from 'node:crypto';
import type { Repository } from '@cognitia/db';
import { HubspotSyncService, type HubspotClient } from '@cognitia/integrations';
import type { Job } from '../index.js';

/**
 * crm-sync job: run a HubSpot sync for a tenant connection. Idempotent and
 * tenant-scoped via the Repository + external_object_maps. The real HubspotClient
 * (OAuth, REST) is injected; the worker resolves it per `integration_connections`
 * row in a follow-up. Scheduling is driven by n8n (`crm-sync-schedule`).
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
      // CGD-001: this job is inbound CRM sync (reads). Outbound vendor POSTs
      // must use runOutboundWorkerPost (deny-by-default) BEFORE client/fetch.
      const service = new HubspotSyncService(opts.repo, opts.client);
      await service.sync({
        tenantId: opts.tenantId,
        traceId: randomUUID(),
        connectionId: opts.connectionId ?? null,
      });
    },
  };
}
