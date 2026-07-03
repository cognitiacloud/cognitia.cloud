import { createHash } from 'node:crypto';

/**
 * Local hashing helpers shared by the action ledger, approval registry, and
 * proof receipts. Only `node:crypto` is used — no new dependency, no network.
 */

/** Deterministic JSON: object keys sorted recursively so hashes are stable. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, sortValue(v)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Hash any JSON-safe value deterministically. */
export function hashValue(value: unknown): string {
  return sha256Hex(stableStringify(value));
}
