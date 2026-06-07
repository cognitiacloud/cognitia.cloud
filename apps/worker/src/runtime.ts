import { createPostgresRepository, type Repository } from '@cognitia/db';
import { HttpHubspotClient, HubspotSyncService, type TokenProvider } from '@cognitia/integrations';

/**
 * Production composition root for the CRM sync path. Wires the *real* Postgres
 * Repository (KyselyRepository, RLS-enforced via withTenant) and the *real*
 * HubSpot client (HttpHubspotClient) into HubspotSyncService — the same code the
 * tests exercise via the in-memory repo + fake client.
 *
 * OAuth: the TokenProvider resolves a fresh access token per tenant from the
 * tenant's `integration_connections.credential_ref` (encrypted at rest). The
 * concrete token store is injected so secrets never live in this module.
 */
export interface CrmSyncRuntimeOptions {
  databaseUrl: string;
  tokenProvider: TokenProvider;
}

export async function buildCrmSyncRuntime(opts: CrmSyncRuntimeOptions): Promise<{
  repo: Repository;
  syncTenant: (tenantId: string, connectionId?: string | null) => Promise<void>;
  close: () => Promise<void>;
}> {
  const pg = await createPostgresRepository(opts.databaseUrl);
  const client = new HttpHubspotClient({ token: opts.tokenProvider });
  const service = new HubspotSyncService(pg.repo, client);

  return {
    repo: pg.repo,
    async syncTenant(tenantId, connectionId) {
      await service.sync({
        tenantId,
        traceId: crypto.randomUUID(),
        connectionId: connectionId ?? null,
      });
    },
    close: pg.close,
  };
}
