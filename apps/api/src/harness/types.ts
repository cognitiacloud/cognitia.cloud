/**
 * Shared domain types for the Cognitia pilot proof harness.
 *
 * Everything in this harness is dev/simulation only. No type here implies a
 * production data store, real money, real messaging, or any external network
 * call. Amounts are denominated in abstract "units" (never a real currency),
 * and every external touchpoint is replaced by a deterministic simulation.
 */

/** Who is acting. Humans approve; AI agents propose. */
export type ActorKind = "human" | "ai_agent";

export interface Actor {
  readonly id: string;
  readonly kind: ActorKind;
  readonly displayName: string;
  /**
   * Capabilities the actor is authorized to use. AI agents are intentionally
   * constrained: they can propose and deliver, but not self-approve or release
   * escrow without a verified proof + owner verification.
   */
  readonly capabilities: ReadonlyArray<Capability>;
}

export type Capability =
  | "create_work"
  | "approve_work"
  | "propose_action"
  | "deliver_work"
  | "verify_proof"
  | "release_escrow"
  | "resolve_dispute";

/** Status of a single Action Ledger entry. */
export type ActionStatus =
  | "proposed"
  | "approved"
  | "executed"
  | "refused";

export interface ActionLedgerEntry {
  readonly id: string;
  readonly seq: number;
  readonly at: string; // ISO timestamp (deterministic clock in the harness)
  readonly actorId: string;
  readonly actorKind: ActorKind;
  readonly verb: string;
  readonly target: string;
  readonly status: ActionStatus;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly prevHash: string;
  readonly hash: string;
}

/** Marketplace + work order lifecycle. */
export type WorkOrderStatus =
  | "created"
  | "reserved"
  | "delivered"
  | "verified"
  | "released"
  | "disputed"
  | "refunded"
  | "split";

export interface Listing {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly priceUnits: number;
}

export interface WorkOrder {
  readonly id: string;
  readonly listingId: string;
  readonly ownerId: string;
  readonly workerId: string;
  readonly priceUnits: number;
  status: WorkOrderStatus;
  escrowId: string | null;
}

/** Escrow lifecycle (fully simulated — no real payment rails). */
export type EscrowStatus =
  | "reserved"
  | "released"
  | "refunded"
  | "split";

export interface EscrowHold {
  readonly id: string;
  readonly workOrderId: string;
  readonly payerId: string;
  readonly payeeId: string;
  readonly amountUnits: number;
  status: EscrowStatus;
}

/**
 * A verified_fact proof. Strength is derived from independent evidence signals,
 * not asserted. A claim with no verifiable artifact is always weak.
 */
export interface EvidenceSignal {
  readonly kind: string;
  readonly present: boolean;
  /** Relative weight of this signal toward proof strength (0..1). */
  readonly weight: number;
  /** Whether this signal is independently checkable (vs. self-asserted). */
  readonly independent: boolean;
}

export interface VerifiedFactProof {
  readonly workOrderId: string;
  readonly claim: string;
  /** Reference to a verifiable artifact (hash, URL stub, receipt id, ...). */
  readonly artifactRef: string | null;
  readonly evidence: ReadonlyArray<EvidenceSignal>;
}

export type ProofVerdict = "strong" | "weak";

export interface ProofEvaluation {
  readonly verdict: ProofVerdict;
  readonly strength: number; // 0..1
  readonly independentSignals: number;
  readonly reasons: ReadonlyArray<string>;
}

/** Reputation ledger entries (only ever awarded on a verified release). */
export interface ReputationEntry {
  readonly actorId: string;
  readonly delta: number;
  readonly reason: string;
  readonly at: string;
}

/** Agent Fabric simulated routing receipt. Always `simulated: true`. */
export interface ProofReceipt {
  readonly receiptId: string;
  readonly route: ReadonlyArray<string>;
  readonly simulated: true;
  readonly latencyMs: number;
  readonly claim: string;
  readonly artifactRef: string;
}

/** Public trust feed event (sanitized, no PII). */
export interface TrustFeedEvent {
  readonly id: string;
  readonly kind: string;
  readonly at: string;
  readonly summary: string;
}

/** Dispute resolution outcomes. */
export type DisputeOutcome = "refund" | "split";

export interface DisputeResolution {
  readonly workOrderId: string;
  readonly outcome: DisputeOutcome;
  /** Share to the worker when split (0..1). Ignored for full refund. */
  readonly workerShare: number;
}
