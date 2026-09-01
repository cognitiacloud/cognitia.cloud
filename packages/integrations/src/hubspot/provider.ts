import { assertLiveOutboundAllowed } from '@cognitia/core';
import type { ProviderAdapter, ProviderConnection, SyncResult } from '../provider.js';

/**
 * Signature-only HubSpot provider stub. Method bodies are intentionally
 * unimplemented; a follow-up (Codex/human) wires the real HubSpot REST/webhook
 * calls. Reads pull CRM facts (companies/contacts/deals); writes are idempotent.
 */
export class HubspotProvider implements ProviderAdapter {
  readonly system = 'hubspot';
  readonly kind = 'crm' as const;

  async connect(input: { tenantId: string; credentialRef: string }): Promise<ProviderConnection> {
    // TODO(codex): exchange/refresh OAuth token via credentialRef.
    throw new Error('HubspotProvider.connect not implemented');
  }

  async sync(_conn: ProviderConnection, _opts?: { since?: string }): Promise<SyncResult> {
    // TODO(codex): page companies/contacts/deals; upsert via external_object_maps.
    throw new Error('HubspotProvider.sync not implemented');
  }

  async read(_conn: ProviderConnection, _query: Record<string, unknown>): Promise<unknown> {
    // TODO(codex): GET object(s) by id/query.
    throw new Error('HubspotProvider.read not implemented');
  }

  async write(
    _conn: ProviderConnection,
    _op: { type: string; idempotencyKey: string; payload: Record<string, unknown> },
  ): Promise<{ externalRef: string }> {
    // CGD-001: deny BEFORE any client/fetch. Unimplemented writes stay denied.
    assertLiveOutboundAllowed('hubspot');
    throw new Error('HubspotProvider.write not implemented');
  }
}
