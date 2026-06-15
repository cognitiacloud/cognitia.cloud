/**
 * Deterministic clock + id sequence for reproducible harness runs.
 *
 * Reproducibility matters for a proof harness: two runs with the same inputs
 * must produce the same ledger hashes and the same ids. We therefore avoid
 * `Date.now()` and `crypto.randomUUID()` in favour of a monotonic counter
 * seeded at a fixed epoch.
 */
export class DeterministicClock {
  private ticks = 0;
  private readonly epochMs: number;
  private readonly counters = new Map<string, number>();

  constructor(epochIso = "2026-01-01T00:00:00.000Z") {
    this.epochMs = Date.parse(epochIso);
  }

  /** Advance the clock by one second and return an ISO timestamp. */
  now(): string {
    this.ticks += 1;
    return new Date(this.epochMs + this.ticks * 1000).toISOString();
  }

  /** Stable, human-readable id with a per-prefix monotonic counter. */
  id(prefix: string): string {
    const next = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, next);
    return `${prefix}_${String(next).padStart(4, "0")}`;
  }
}
