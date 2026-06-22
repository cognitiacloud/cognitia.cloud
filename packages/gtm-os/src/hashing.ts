import { createHash } from 'node:crypto';

/**
 * Deterministic, dependency-free hashing helpers used to build the tamper-
 * evident ledger and proof-receipt chains. `node:crypto` is a local primitive;
 * nothing here opens a socket or touches the network.
 */

/** SHA-256 of a UTF-8 string, hex-encoded. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Stable JSON serialization with recursively sorted object keys, so two
 * logically-equal values always hash identically regardless of key order.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortValue(source[key]);
    }
    return sorted;
  }
  return value;
}

/** Hash an arbitrary structured value via its canonical form. */
export function hashOf(value: unknown): string {
  return sha256Hex(canonicalize(value));
}
