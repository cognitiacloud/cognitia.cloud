import { assertLiveOutboundAllowed, type LiveSurface } from '@cognitia/core';

/**
 * CGD-001: wrap any worker job that POSTs outbound. Call this BEFORE
 * constructing a vendor client or fetch. crm-sync is inbound (HubSpot reads)
 * and does not use this helper.
 */
export async function runOutboundWorkerPost<T>(
  surface: LiveSurface,
  job: () => Promise<T>,
): Promise<T> {
  assertLiveOutboundAllowed(surface);
  return job();
}
