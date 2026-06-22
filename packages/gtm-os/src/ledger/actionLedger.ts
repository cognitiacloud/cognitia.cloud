import { hashOf } from '../hashing.js';
import { scanForRawPii, PiiViolationError } from '../pii/piiSafety.js';
import type { LedgerEvent, LedgerKind, RuntimeEnv, TenantId } from '../types.js';

/**
 * Append-only, hash-chained action ledger — the single source of truth for
 * everything that happens in a run. There is no update or delete: the only
 * mutation is {@link AppendOnlyLedger.append}, and every payload is scanned for
 * raw PII before it is accepted (fail-closed). Each event's `hash` covers its
 * own fields plus the previous event's `hash`, so tampering breaks the chain
 * (see {@link verifyLedger}).
 */

export interface AppendInput {
  runId: string;
  tenantId: TenantId;
  kind: LedgerKind;
  summary: string;
  detail: Record<string, unknown>;
}

export class AppendOnlyLedger {
  private readonly events: LedgerEvent[] = [];

  constructor(private readonly env: RuntimeEnv) {}

  /**
   * Append an immutable, hash-chained event. Throws {@link PiiViolationError}
   * if the summary or detail contains anything resembling raw PII.
   */
  append(input: AppendInput): LedgerEvent {
    const violations = scanForRawPii({ summary: input.summary, detail: input.detail });
    if (violations.length > 0) throw new PiiViolationError(violations);

    const previous = this.events.length > 0 ? this.events[this.events.length - 1] : undefined;
    const prevHash = previous ? previous.hash : null;
    const core = {
      seq: this.events.length,
      at: this.env.now(),
      runId: input.runId,
      tenantId: input.tenantId,
      kind: input.kind,
      summary: input.summary,
      detail: input.detail,
      prevHash,
    };
    const event: LedgerEvent = { ...core, hash: hashOf(core) };
    this.events.push(Object.freeze(event));
    return event;
  }

  /** A defensive copy of the full log, in order. */
  all(): LedgerEvent[] {
    return this.events.slice();
  }

  /** Events for a single run, in order. */
  forRun(runId: string): LedgerEvent[] {
    return this.events.filter((e) => e.runId === runId);
  }

  head(): LedgerEvent | null {
    return this.events.length > 0 ? (this.events[this.events.length - 1] ?? null) : null;
  }

  size(): number {
    return this.events.length;
  }
}

export interface LedgerVerification {
  valid: boolean;
  /** Index of the first event that fails verification, if any. */
  brokenAt: number | null;
  reason: string | null;
}

/** Recompute the whole chain and confirm hashes + linkage are intact. */
export function verifyLedger(events: readonly LedgerEvent[]): LedgerVerification {
  let prevHash: string | null = null;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event === undefined) {
      return { valid: false, brokenAt: i, reason: 'missing event' };
    }
    if (event.seq !== i) {
      return { valid: false, brokenAt: i, reason: 'non-monotonic seq' };
    }
    if (event.prevHash !== prevHash) {
      return { valid: false, brokenAt: i, reason: 'prevHash mismatch' };
    }
    const recomputed = hashOf({
      seq: event.seq,
      at: event.at,
      runId: event.runId,
      tenantId: event.tenantId,
      kind: event.kind,
      summary: event.summary,
      detail: event.detail,
      prevHash: event.prevHash,
    });
    if (recomputed !== event.hash) {
      return { valid: false, brokenAt: i, reason: 'hash mismatch' };
    }
    prevHash = event.hash;
  }
  return { valid: true, brokenAt: null, reason: null };
}
