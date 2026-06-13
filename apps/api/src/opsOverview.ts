import type { Repository, EventRow, SyncRunRow } from '@cognitia/db';

/**
 * OBS-1 — operations overview read-model. One read-only, viewer-allowed view
 * answering "is the system healthy for this tenant?":
 *
 *   - failures: every `*.failed.v1` / `execution_denied` event, counted by
 *     name, with the most recent occurrences (refs only — event payloads carry
 *     refs/hashes by design, never raw PII);
 *   - sync: sync_run health — counts by status, failure rate, last completed,
 *     last failure;
 *   - actions: the action ledger's execution/approval status mix;
 *   - worker: liveness from the latest `worker.heartbeat.v1` event, with an
 *     explicit staleness verdict (no heartbeat within the threshold ⇒ stale).
 *
 * Pure derivation over existing repo reads: no new table, no migration, no
 * shared-contract change — zero conflict surface with other lanes.
 */

/** A worker silent for longer than this is reported stale (outage signal). */
export const DEFAULT_HEARTBEAT_STALE_MINUTES = 15;

const isFailureEvent = (name: string): boolean =>
  name.endsWith('.failed.v1') || name === 'agent.action.execution_denied.v1';

export interface OpsOverview {
  generated_at: string;
  failures: {
    total: number;
    by_event: Record<string, number>;
    recent: Array<{
      event_name: string;
      entity_type: string;
      entity_id: string;
      occurred_at: string;
      trace_id: string;
    }>;
  };
  sync: {
    total_runs: number;
    by_status: Record<string, number>;
    failure_rate: number;
    last_completed_at: string | null;
    last_failed_at: string | null;
  };
  actions: {
    total: number;
    by_execution_status: Record<string, number>;
    by_approval_status: Record<string, number>;
  };
  worker: {
    last_heartbeat_at: string | null;
    worker: string | null;
    stale_after_minutes: number;
    /** True when no heartbeat exists or the latest one is older than the threshold. */
    stale: boolean;
  };
}

const tally = <T>(rows: T[], key: (row: T) => string): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const row of rows) out[key(row)] = (out[key(row)] ?? 0) + 1;
  return out;
};

const newestFirst = (a: EventRow, b: EventRow): number =>
  a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0;

function syncHealth(runs: SyncRunRow[]): OpsOverview['sync'] {
  const finished = (status: string) =>
    runs
      .filter((r) => r.status === status)
      .map((r) => r.finished_at ?? r.updated_at)
      .sort()
      .at(-1) ?? null;
  const failed = runs.filter((r) => r.status === 'failed').length;
  const completed = runs.filter((r) => r.status === 'completed').length;
  const settled = failed + completed;
  return {
    total_runs: runs.length,
    by_status: tally(runs, (r) => r.status),
    failure_rate: settled === 0 ? 0 : failed / settled,
    last_completed_at: finished('completed'),
    last_failed_at: finished('failed'),
  };
}

export async function buildOpsOverview(
  repo: Repository,
  tenantId: string,
  opts: { now?: string; staleAfterMinutes?: number; recentLimit?: number } = {},
): Promise<OpsOverview> {
  const now = opts.now ?? new Date().toISOString();
  const staleAfterMinutes = opts.staleAfterMinutes ?? DEFAULT_HEARTBEAT_STALE_MINUTES;
  const recentLimit = opts.recentLimit ?? 20;

  const [events, syncRuns, actions] = await Promise.all([
    repo.listEvents(tenantId),
    repo.listSyncRuns(tenantId),
    repo.listAgentActions(tenantId),
  ]);

  const failures = events.filter((e) => isFailureEvent(e.event_name)).sort(newestFirst);
  const heartbeats = events
    .filter((e) => e.event_name === 'worker.heartbeat.recorded.v1')
    .sort(newestFirst);
  const latestBeat = heartbeats[0] ?? null;
  const workerName =
    latestBeat && typeof latestBeat.payload.worker === 'string' ? latestBeat.payload.worker : null;
  const stale =
    !latestBeat ||
    new Date(now).getTime() - new Date(latestBeat.occurred_at).getTime() >
      staleAfterMinutes * 60_000;

  return {
    generated_at: now,
    failures: {
      total: failures.length,
      by_event: tally(failures, (e) => e.event_name),
      recent: failures.slice(0, recentLimit).map((e) => ({
        event_name: e.event_name,
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        occurred_at: e.occurred_at,
        trace_id: e.trace_id,
      })),
    },
    sync: syncHealth(syncRuns),
    actions: {
      total: actions.length,
      by_execution_status: tally(actions, (a) => a.execution_status),
      by_approval_status: tally(actions, (a) => a.approval_status),
    },
    worker: {
      last_heartbeat_at: latestBeat?.occurred_at ?? null,
      worker: workerName,
      stale_after_minutes: staleAfterMinutes,
      stale,
    },
  };
}
