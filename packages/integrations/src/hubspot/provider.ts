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
    // CGD-003: deny BEFORE any OAuth authorization-code exchange / token HTTP.
    assertLiveOutboundAllowed('hubspotOAuthConnect');
    throw new Error('HubspotProvider.connect not implemented');
  }

  async sync(_conn: ProviderConnection, _opts?: { since?: string }): Promise<SyncResult> {
    // CGD-002: deny BEFORE any client/fetch. Unimplemented sync stays denied.
    assertLiveOutboundAllowed('hubspotRead');
    throw new Error('HubspotProvider.sync not implemented');
  }

  async read(_conn: ProviderConnection, _query: Record<string, unknown>): Promise<unknown> {
    // CGD-002: deny BEFORE any client/fetch. Unimplemented reads stay denied.
    assertLiveOutboundAllowed('hubspotRead');
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
