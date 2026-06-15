import { createHash } from 'node:crypto';
import { makeEvent } from '@cognitia/core';
import type { Repository, EventRow } from '@cognitia/db';

/**
 * OBS-1 — worker heartbeat. After each job cycle the worker appends a
 * `worker.heartbeat.recorded.v1` event to the tenant's immutable event stream.
 * The ops overview (`GET /ops/overview`) reads the latest heartbeat and reports
 * staleness — a worker that stops beating surfaces as an outage signal without
 * any extra infrastructure (no new table, no migration; the append-only events
 * stream is the transport).
 *
 * Heartbeats are tenant-scoped because every event row is: the worker beats
 * for the tenant whose job it just ran. Payload carries names only — no PII.
 */

/**
 * Deterministic UUID identity for a worker name (the event envelope requires a
 * uuid entity_id; a worker has no row, so its identity is derived). Stable
 * across beats so all heartbeats from one worker share one entity id.
 */
export function workerEntityId(worker: string): string {
  const h = createHash('sha256').update(`cognitia-worker:${worker}`).digest('hex');
  // Format as a v4-shaped UUID (variant bits set; derivation documented above).
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    `8${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join('-');
}

export async function recordWorkerHeartbeat(
  repo: Repository,
  input: { tenantId: string; worker: string; job: string; traceId: string },
): Promise<void> {
  // `created_at` is DB-defaulted — same cast convention as the sync service.
  const event = makeEvent({
    tenant_id: input.tenantId,
    event_name: 'worker.heartbeat.recorded.v1',
    entity_type: 'worker',
    entity_id: workerEntityId(input.worker),
    source: 'worker',
    payload: { worker: input.worker, job: input.job },
    trace_id: input.traceId,
  }) as EventRow;
  await repo.insertEvent(event);
}
