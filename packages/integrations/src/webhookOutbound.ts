import { assertLiveOutboundAllowed, type LiveSurface } from '@cognitia/core';

/**
 * CGD-001: the only path for a webhook handler to POST back to a vendor.
 * Local ingest (HubSpot contact upsert into our DB) is inbound and does not
 * use this. Call BEFORE constructing a client or fetch.
 */
export async function executeWebhookOutboundSideEffect(surface: LiveSurface): Promise<never> {
  assertLiveOutboundAllowed(surface);
  throw new Error(`${surface} webhook outbound write is not implemented`);
}
