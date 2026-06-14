import { verifyAuditChain, type Repository, type AuditEventRow } from '@cognitia/db';

/**
 * Audit-chain external anchoring (mechanism).
 *
 * SEC-1's audit chain is tamper-EVIDENT, not tamper-PROOF: a DB superuser could
 * rewrite a row AND recompute the forward hashes, leaving an internally-
 * consistent but falsified history. Anchoring closes that by periodically
 * publishing the chain's TIP HASH to an INDEPENDENT, append-only store the app
 * DB role cannot rewrite. Later, the live chain is compared to the last anchor:
 * if the anchored tip hash is no longer present in the chain, history was
 * rewritten/truncated — detectable even against a privileged tamperer.
 *
 * This module is the MECHANISM + a pluggable `AnchorSink`. The default sink is
 * IN-MEMORY (mechanism + tests only — NOT durable, NOT external). A real
 * deployment injects a durable, independent sink (e.g. WORM/object-lock storage,
 * a notary/timestamp service, or an external audit log). That custody is infra,
 * not claimed here.
 */

export interface ChainTip {
  events: number;
  /** Hash of the chain head (latest event); null for an empty chain. */
  tip_hash: string | null;
  /** Whether the chain currently verifies (SEC-1 verifyAuditChain). */
  chain_ok: boolean;
}

/** Compute the current chain tip + integrity for a tenant's audit events. */
export function chainTip(events: AuditEventRow[]): ChainTip {
  if (events.length === 0) return { events: 0, tip_hash: null, chain_ok: true };
  const chain_ok = verifyAuditChain(events).ok;
  // The head is the event whose hash is not used as any other event's prev_hash.
  const usedAsPrev = new Set(events.map((e) => e.prev_hash));
  const head = events.find((e) => e.hash != null && !usedAsPrev.has(e.hash));
  return { events: events.length, tip_hash: head?.hash ?? null, chain_ok };
}

export interface AnchorRecord {
  tenant_id: string;
  anchored_at: string;
  events: number;
  tip_hash: string | null;
  chain_ok: boolean;
}

export interface AnchorSink {
  /** Persist an anchor (append-only in a real sink). */
  publish(record: AnchorRecord): Promise<void>;
  /** The most recent anchor for a tenant, or null. */
  latest(tenantId: string): Promise<AnchorRecord | null>;
}

/**
 * In-memory sink — MECHANISM + TESTS ONLY. Not durable and not independent of
 * the process, so it provides no real tamper-proofing; a production deployment
 * injects an external, append-only sink. Kept behind the same interface so the
 * anchor/verify logic is unchanged when the real sink is wired.
 */
export class InMemoryAnchorSink implements AnchorSink {
  private readonly byTenant = new Map<string, AnchorRecord>();
  async publish(record: AnchorRecord): Promise<void> {
    this.byTenant.set(record.tenant_id, record);
  }
  async latest(tenantId: string): Promise<AnchorRecord | null> {
    return this.byTenant.get(tenantId) ?? null;
  }
}

export type AnchorComparison =
  | 'no_anchor'
  | 'empty_anchor'
  | 'append_only_growth'
  | 'current_chain_broken'
  | 'anchored_tip_absent'
  | 'history_shrank';

/** Compare a live event set to a prior anchor — the tamper-detection core. */
export function compareToAnchor(
  currentEvents: AuditEventRow[],
  anchor: AnchorRecord,
): { consistent: boolean; reason: AnchorComparison } {
  const current = chainTip(currentEvents);
  if (!current.chain_ok) return { consistent: false, reason: 'current_chain_broken' };
  if (anchor.tip_hash === null) return { consistent: true, reason: 'empty_anchor' };
  // Append-only growth keeps every prior hash. If the anchored tip hash is gone,
  // an event at/before that point was rewritten (its hash + all forward hashes
  // changed) or the chain was truncated.
  const tipStillPresent = currentEvents.some((e) => e.hash === anchor.tip_hash);
  if (!tipStillPresent) return { consistent: false, reason: 'anchored_tip_absent' };
  if (current.events < anchor.events) return { consistent: false, reason: 'history_shrank' };
  return { consistent: true, reason: 'append_only_growth' };
}

/** Anchor the tenant's current audit-chain tip to the sink. */
export async function anchorAuditChain(
  repo: Repository,
  tenantId: string,
  sink: AnchorSink,
  opts: { now?: string } = {},
): Promise<AnchorRecord> {
  const tip = chainTip(await repo.listAuditEvents(tenantId));
  const record: AnchorRecord = {
    tenant_id: tenantId,
    anchored_at: opts.now ?? new Date().toISOString(),
    ...tip,
  };
  await sink.publish(record);
  return record;
}

export interface AnchorVerification {
  checked_at: string;
  current: ChainTip;
  anchored: AnchorRecord | null;
  consistent: boolean;
  reason: AnchorComparison;
}

/** Verify the live chain against the latest anchor (read-only). */
export async function verifyAgainstLatestAnchor(
  repo: Repository,
  tenantId: string,
  sink: AnchorSink,
  opts: { now?: string } = {},
): Promise<AnchorVerification> {
  const events = await repo.listAuditEvents(tenantId);
  const current = chainTip(events);
  const anchored = await sink.latest(tenantId);
  const checked_at = opts.now ?? new Date().toISOString();
  if (!anchored) {
    return {
      checked_at,
      current,
      anchored: null,
      consistent: current.chain_ok,
      reason: 'no_anchor',
    };
  }
  const cmp = compareToAnchor(events, anchored);
  return { checked_at, current, anchored, consistent: cmp.consistent, reason: cmp.reason };
}
