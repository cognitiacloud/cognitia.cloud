/**
 * Action Ledger: an append-only, hash-chained log of who proposed/approved/
 * executed/refused what. This is the spine of the harness — every scenario
 * leaves an auditable trail here.
 *
 * The chaining (each entry hashes the previous entry's hash) makes tampering
 * detectable: `verifyChain()` recomputes the chain and fails if any entry was
 * mutated or reordered. This is a simulation of Cognitia's real ledger, not a
 * production implementation.
 */
import { createHash } from "node:crypto";
import type { DeterministicClock } from "./clock.ts";
import type {
  Actor,
  ActionLedgerEntry,
  ActionStatus,
} from "./types.ts";

const GENESIS_HASH = "0".repeat(64);

export interface AppendActionInput {
  readonly actor: Actor;
  readonly verb: string;
  readonly target: string;
  readonly status: ActionStatus;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export class ActionLedger {
  private readonly entries: ActionLedgerEntry[] = [];
  private seq = 0;
  private readonly clock: DeterministicClock;

  constructor(clock: DeterministicClock) {
    this.clock = clock;
  }

  append(input: AppendActionInput): ActionLedgerEntry {
    const prevHash = this.entries.at(-1)?.hash ?? GENESIS_HASH;
    this.seq += 1;
    const base = {
      id: this.clock.id("act"),
      seq: this.seq,
      at: this.clock.now(),
      actorId: input.actor.id,
      actorKind: input.actor.kind,
      verb: input.verb,
      target: input.target,
      status: input.status,
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
      prevHash,
    };
    const hash = hashEntry(base);
    const entry: ActionLedgerEntry = Object.freeze({ ...base, hash });
    this.entries.push(entry);
    return entry;
  }

  all(): ReadonlyArray<ActionLedgerEntry> {
    return this.entries.slice();
  }

  byActor(actorId: string): ReadonlyArray<ActionLedgerEntry> {
    return this.entries.filter((e) => e.actorId === actorId);
  }

  byStatus(status: ActionStatus): ReadonlyArray<ActionLedgerEntry> {
    return this.entries.filter((e) => e.status === status);
  }

  last(): ActionLedgerEntry | undefined {
    return this.entries.at(-1);
  }

  size(): number {
    return this.entries.length;
  }

  /** Recompute the hash chain; returns true iff the ledger is intact. */
  verifyChain(): boolean {
    let prevHash = GENESIS_HASH;
    for (const entry of this.entries) {
      if (entry.prevHash !== prevHash) return false;
      const { hash, ...base } = entry;
      if (hashEntry(base) !== hash) return false;
      prevHash = entry.hash;
    }
    return true;
  }
}

function hashEntry(base: Omit<ActionLedgerEntry, "hash">): string {
  const canonical = JSON.stringify([
    base.seq,
    base.at,
    base.actorId,
    base.actorKind,
    base.verb,
    base.target,
    base.status,
    base.metadata,
    base.prevHash,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}
