import { createHash } from 'node:crypto';
import type { AuditEventRow } from './repository.js';

/**
 * Tamper-EVIDENT audit chain (not tamper-proof — that requires an external
 * anchor, which is documented future work). Every audit event is hash-linked
 * to its predecessor within the tenant:
 *
 *   hash = sha256( stableStringify({ ...content, prev_hash }) )
 *
 * The first event in a tenant links to the literal 'genesis'. The repository
 * computes the chain on EVERY insert (single chokepoint — all audit writers go
 * through `insertAuditEvent`), and a unique index on (tenant_id, prev_hash)
 * makes the chain linear: two events can never claim the same predecessor.
 *
 * `verifyAuditChain` fails closed: a missing hash, an unknown/duplicated link,
 * a content mutation, or a dropped row all surface as a named failure. The
 * hash covers the app-controlled content (id, tenant, actor, action, subject,
 * detail, occurred_at) — `created_at` is excluded because the DB may default
 * it server-side.
 */

export const AUDIT_CHAIN_GENESIS = 'genesis';

/** The fields a caller provides; the repository fills prev_hash + hash. */
export type AuditEventContent = Pick<
  AuditEventRow,
  'id' | 'tenant_id' | 'actor_ref' | 'action' | 'subject_ref' | 'detail' | 'occurred_at'
>;

/** Deterministic JSON: object keys sorted recursively (arrays keep order). */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Normalize a timestamp to canonical ISO-8601. Postgres `timestamptz` round-
 * trips in a driver-dependent format (Date object or '… 00:00:00+00' string);
 * the hash must be format-independent or verification would false-positive.
 */
function toIso(v: string | Date): string {
  return new Date(v).toISOString();
}

export function computeAuditHash(content: AuditEventContent, prevHash: string): string {
  const material = stableStringify({
    id: content.id,
    tenant_id: content.tenant_id,
    actor_ref: content.actor_ref,
    action: content.action,
    subject_ref: content.subject_ref,
    detail: content.detail,
    occurred_at: toIso(content.occurred_at),
    prev_hash: prevHash,
  });
  return createHash('sha256').update(material).digest('hex');
}

export interface AuditChainVerification {
  ok: boolean;
  /** Total events inspected. */
  events: number;
  /** Events successfully linked + recomputed from genesis. */
  verified: number;
  /** Why verification failed (absent when ok). */
  failure?:
    | 'unchained_row' // an event has no hash/prev_hash (pre-chain or stripped)
    | 'forked_chain' // two events claim the same predecessor
    | 'hash_mismatch' // recomputed hash differs — content was mutated
    | 'broken_link'; // chain ends before covering every event (row dropped/reordered)
  /** Event id at the failure point, when identifiable. */
  at?: string;
}

/** Walk a tenant's audit events from genesis, recomputing every link. */
export function verifyAuditChain(rows: AuditEventRow[]): AuditChainVerification {
  const fail = (
    failure: NonNullable<AuditChainVerification['failure']>,
    verified: number,
    at?: string,
  ): AuditChainVerification => ({
    ok: false,
    events: rows.length,
    verified,
    failure,
    ...(at ? { at } : {}),
  });

  const byPrev = new Map<string, AuditEventRow>();
  for (const row of rows) {
    if (!row.hash || !row.prev_hash) return fail('unchained_row', 0, row.id);
    if (byPrev.has(row.prev_hash)) return fail('forked_chain', 0, row.id);
    byPrev.set(row.prev_hash, row);
  }

  let verified = 0;
  let prev = AUDIT_CHAIN_GENESIS;
  while (verified < rows.length) {
    const row = byPrev.get(prev);
    if (!row) return fail('broken_link', verified);
    if (computeAuditHash(row, prev) !== row.hash) return fail('hash_mismatch', verified, row.id);
    verified += 1;
    prev = row.hash;
  }
  return { ok: true, events: rows.length, verified };
}
