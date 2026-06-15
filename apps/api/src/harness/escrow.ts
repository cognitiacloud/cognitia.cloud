/**
 * Simulated escrow ledger.
 *
 * NO REAL PAYMENTS. Balances are abstract "units". `reserve` moves units from a
 * payer into a hold; `release`/`refund`/`split` settle the hold. Every mutating
 * call passes through the simulation guard, so even a future bug that tried to
 * flip on real payments would throw instead of moving money.
 */
import type { DeterministicClock } from "./clock.ts";
import { assertSimulationOnly, type HarnessConfig } from "./environment.ts";
import type { EscrowHold } from "./types.ts";

export class EscrowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EscrowError";
  }
}

export interface SettlementResult {
  readonly escrowId: string;
  readonly status: EscrowHold["status"];
  readonly toPayee: number;
  readonly toPayer: number;
}

export class EscrowService {
  private readonly holds = new Map<string, EscrowHold>();
  private readonly config: HarnessConfig;
  private readonly clock: DeterministicClock;

  constructor(config: HarnessConfig, clock: DeterministicClock) {
    this.config = config;
    this.clock = clock;
  }

  reserve(input: {
    workOrderId: string;
    payerId: string;
    payeeId: string;
    amountUnits: number;
  }): EscrowHold {
    assertSimulationOnly(this.config, "payments");
    if (input.amountUnits <= 0) {
      throw new EscrowError("Escrow amount must be positive.");
    }
    const hold: EscrowHold = {
      id: this.clock.id("esc"),
      workOrderId: input.workOrderId,
      payerId: input.payerId,
      payeeId: input.payeeId,
      amountUnits: input.amountUnits,
      status: "reserved",
    };
    this.holds.set(hold.id, hold);
    return hold;
  }

  get(escrowId: string): EscrowHold {
    const hold = this.holds.get(escrowId);
    if (!hold) throw new EscrowError(`Unknown escrow hold: ${escrowId}`);
    return hold;
  }

  release(escrowId: string): SettlementResult {
    assertSimulationOnly(this.config, "payments");
    const hold = this.requireReserved(escrowId);
    hold.status = "released";
    return { escrowId, status: "released", toPayee: hold.amountUnits, toPayer: 0 };
  }

  refund(escrowId: string): SettlementResult {
    assertSimulationOnly(this.config, "payments");
    const hold = this.requireReserved(escrowId);
    hold.status = "refunded";
    return { escrowId, status: "refunded", toPayee: 0, toPayer: hold.amountUnits };
  }

  /** Split the hold: `workerShare` (0..1) to the payee, the rest refunded. */
  split(escrowId: string, workerShare: number): SettlementResult {
    assertSimulationOnly(this.config, "payments");
    if (workerShare < 0 || workerShare > 1) {
      throw new EscrowError("workerShare must be between 0 and 1.");
    }
    const hold = this.requireReserved(escrowId);
    hold.status = "split";
    const toPayee = Math.round(hold.amountUnits * workerShare);
    const toPayer = hold.amountUnits - toPayee;
    return { escrowId, status: "split", toPayee, toPayer };
  }

  private requireReserved(escrowId: string): EscrowHold {
    const hold = this.get(escrowId);
    if (hold.status !== "reserved") {
      throw new EscrowError(
        `Escrow ${escrowId} is ${hold.status}; only reserved holds can be settled.`,
      );
    }
    return hold;
  }
}
