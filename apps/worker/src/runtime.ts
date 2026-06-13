import { createPostgresRepository, type Repository } from '@cognitia/db';
import {
  ConnectionTokenProvider,
  HttpHubspotClient,
  HubspotSyncService,
  type SecretStore,
  type TokenProvider,
} from '@cognitia/integrations';
import { recordWorkerHeartbeat } from './heartbeat.js';

/**
 * Production composition root for the CRM sync path. Wires the *real* Postgres
 * Repository (KyselyRepository, RLS-enforced via withTenant) and the *real*
 * HubSpot client (HttpHubspotClient) into HubspotSyncService — the same code the
 * tests exercise via the in-memory repo + fake client.
 *
 * OAuth: a per-tenant access token is resolved from
 * `integration_connections.credential_ref` (a pointer) → the injected encrypted
 * `SecretStore`. Supply a `secrets` store and a `ConnectionTokenProvider` is
 * built automatically; or inject your own `tokenProvider`. Secrets/tokens never
 * live in this module.
 */
export interface CrmSyncRuntimeOptions {
  databaseUrl: string;
  /** Encrypted secret store backing per-tenant OAuth credentials. */
  secrets?: SecretStore;
  /** Pre-built provider (overrides `secrets`). */
  tokenProvider?: TokenProvider;
}

export async function buildCrmSyncRuntime(opts: CrmSyncRuntimeOptions): Promise<{
  repo: Repository;
  tokenProvider: TokenProvider;
  syncTenant: (tenantId: string, connectionId?: string | null) => Promise<void>;
  close: () => Promise<void>;
}> {
  const pg = await createPostgresRepository(opts.databaseUrl);

  const tokenProvider =
    opts.tokenProvider ??
    (() => {
      if (!opts.secrets) {
        throw new Error('buildCrmSyncRuntime requires either `tokenProvider` or `secrets`');
      }
      return new ConnectionTokenProvider({ repo: pg.repo, secrets: opts.secrets });
    })();

  const client = new HttpHubspotClient({ token: tokenProvider });
  const service = new HubspotSyncService(pg.repo, client);

  return {
    repo: pg.repo,
    tokenProvider,
    async syncTenant(tenantId, connectionId) {
      const traceId = crypto.randomUUID();
      try {
        await service.sync({
          tenantId,
          traceId,
          connectionId: connectionId ?? null,
        });
      } finally {
        // OBS-1: liveness signal even when the sync failed (the failure itself
        // is recorded in sync_runs; the heartbeat proves the worker runs).
        await recordWorkerHeartbeat(pg.repo, {
          tenantId,
          worker: 'crm-sync-worker',
          job: `crm-sync:${tenantId}`,
          traceId,
        });
      }
    },
    close: pg.close,
  };
}
