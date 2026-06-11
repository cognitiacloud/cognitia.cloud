import { createHash, randomUUID } from 'node:crypto';
import type { Repository, ReputationEventRow, ReputationSnapshotRow } from '@cognitia/db';

/**
 * Reputation v0 (COG-008). Doctrine (Architecture Lock §7):
 *   - reputation_events are append-only and only ever created by services
 *     acting on proofs (there is NO public POST endpoint for them);
 *   - a positive delta requires a verified_fact proof (0010 trigger +
 *     in-memory mirror — already enforced below this layer);
 *   - snapshots are reproducible: `inputs_hash` is a deterministic digest of
 *     the exact events that produced the score, so any session can recompute
 *     and verify. Recompute APPENDS a snapshot; history is never rewritten.
 *
 * Scoring v0 is deliberately simple: score = Σ delta. No decay, no weights,
 * no leaderboards — sophistication comes after real pilot data exists.
 */

export interface ReputationView {
  agent_id: string;
  score: number;
  event_count: number;
  /** Events backed by verified_fact proofs are the only positive inputs. */
  events: Array<{
    id: string;
    delta: number;
    reason_code: string;
    proof_id: string;
    created_at: string;
  }>;
  latest_snapshot: ReputationSnapshotRow | null;
  /** True when the latest snapshot matches the current event set. */
  snapshot_current: boolean;
}

function score(events: ReputationEventRow[]): number {
  return events.reduce((total, e) => total + Number(e.delta), 0);
}

/**
 * Deterministic digest over the event set (order-independent): sorted
 * `id:delta` pairs. Recomputing over the same events always yields the same
 * hash — that is the reproducibility guarantee the snapshot records.
 */
export function computeInputsHash(events: ReputationEventRow[]): string {
  const canonical = events
    .map((e) => `${e.id}:${e.delta}`)
    .sort()
    .join('|');
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

export async function getAgentReputation(
  repo: Repository,
  tenantId: string,
  agentId: string,
): Promise<ReputationView> {
  const [events, snapshots] = await Promise.all([
    repo.listReputationEvents(tenantId, agentId),
    repo.listReputationSnapshots(tenantId, agentId),
  ]);
  const latest = snapshots[0] ?? null;
  return {
    agent_id: agentId,
    score: score(events),
    event_count: events.length,
    events: events.map((e) => ({
      id: e.id,
      delta: Number(e.delta),
      reason_code: e.reason_code,
      proof_id: e.proof_id,
      created_at: e.created_at,
    })),
    latest_snapshot: latest,
    snapshot_current: latest !== null && latest.inputs_hash === computeInputsHash(events),
  };
}

/**
 * Append a fresh snapshot for an agent. Idempotent in effect: recomputing
 * over an unchanged event set produces an identical (score, inputs_hash)
 * pair — callers can skip persisting when `snapshot_current` is already true.
 */
export async function recomputeSnapshot(
  repo: Repository,
  tenantId: string,
  agentId: string,
  actorRef: string,
): Promise<{ snapshot: ReputationSnapshotRow; was_current: boolean }> {
  const events = await repo.listReputationEvents(tenantId, agentId);
  const inputsHash = computeInputsHash(events);
  const existing = (await repo.listReputationSnapshots(tenantId, agentId))[0] ?? null;
  if (existing && existing.inputs_hash === inputsHash) {
    return { snapshot: existing, was_current: true };
  }
  const ts = new Date().toISOString();
  const snapshot = await repo.insertReputationSnapshot({
    id: randomUUID(),
    tenant_id: tenantId,
    agent_id: agentId,
    score: score(events),
    computed_at: ts,
    inputs_hash: inputsHash,
    created_at: ts,
  });
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'reputation.snapshot.computed.v1',
    subject_ref: `agent:${agentId}`,
    detail: { score: snapshot.score, event_count: events.length, inputs_hash: inputsHash },
    occurred_at: ts,
    created_at: ts,
  });
  return { snapshot, was_current: false };
}
