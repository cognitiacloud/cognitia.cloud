/**
 * Reputation ledger.
 *
 * Reputation is *earned*, never granted on assertion. The only path that calls
 * `award()` in the harness is a verified escrow release. Disputes and weak
 * proofs never bump reputation.
 */
import type { DeterministicClock } from "./clock.ts";
import type { ReputationEntry } from "./types.ts";

export class ReputationService {
  private readonly entries: ReputationEntry[] = [];
  private readonly totals = new Map<string, number>();
  private readonly clock: DeterministicClock;

  constructor(clock: DeterministicClock) {
    this.clock = clock;
  }

  award(actorId: string, delta: number, reason: string): ReputationEntry {
    const entry: ReputationEntry = {
      actorId,
      delta,
      reason,
      at: this.clock.now(),
    };
    this.entries.push(entry);
    this.totals.set(actorId, (this.totals.get(actorId) ?? 0) + delta);
    return entry;
  }

  score(actorId: string): number {
    return this.totals.get(actorId) ?? 0;
  }

  history(actorId: string): ReadonlyArray<ReputationEntry> {
    return this.entries.filter((e) => e.actorId === actorId);
  }
}
