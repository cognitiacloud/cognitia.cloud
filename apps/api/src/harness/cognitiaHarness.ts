/**
 * CognitiaHarness — the orchestrator that wires the simulated services into the
 * end-to-end pilot flows.
 *
 * Design intent:
 *  - Humans approve; AI agents propose. Authorization is enforced by capability,
 *    so an agent literally cannot self-approve, verify a proof, or release escrow.
 *  - Money moves only on a verified release. Weak proofs are refused and leave
 *    escrow reserved. Disputes refund or split, and never award reputation.
 *  - Every step is recorded on the hash-chained Action Ledger.
 *
 * This is a dev/simulation harness. See environment.ts for the guards that make
 * "no production / no real money / no real SMS / no external calls" structural.
 */
import { DeterministicClock } from "./clock.ts";
import { ActionLedger } from "./actionLedger.ts";
import { EscrowService, type SettlementResult } from "./escrow.ts";
import { MarketplaceService } from "./marketplace.ts";
import { ReputationService } from "./reputation.ts";
import { AgentFabric } from "./agentFabric.ts";
import { TrustFeed } from "./trustFeed.ts";
import { Notifier } from "./notifier.ts";
import { evaluateProof } from "./proof.ts";
import {
  createSafeConfig,
  type HarnessConfig,
  type HarnessConfigOverrides,
} from "./environment.ts";
import type {
  Actor,
  ActionLedgerEntry,
  Capability,
  DisputeResolution,
  EscrowHold,
  Listing,
  ProofEvaluation,
  ProofReceipt,
  VerifiedFactProof,
  WorkOrder,
} from "./types.ts";

export class AuthorizationError extends Error {
  constructor(actor: Actor, capability: Capability) {
    super(`Refused: actor ${actor.id} (${actor.kind}) lacks capability "${capability}".`);
    this.name = "AuthorizationError";
  }
}

const HUMAN_OPERATOR_CAPS: ReadonlyArray<Capability> = [
  "create_work",
  "approve_work",
  "propose_action",
  "deliver_work",
  "verify_proof",
  "release_escrow",
  "resolve_dispute",
];

// AI agents are deliberately constrained: propose + deliver only.
const AI_AGENT_CAPS: ReadonlyArray<Capability> = ["propose_action", "deliver_work"];

export interface VerifyReleaseResult {
  readonly evaluation: ProofEvaluation;
  readonly released: boolean;
  readonly settlement: SettlementResult | null;
  readonly reputationAwarded: number;
  readonly ledgerEntry: ActionLedgerEntry;
}

export interface OpenWorkOrderResult {
  readonly listing: Listing;
  readonly workOrder: WorkOrder;
  readonly escrow: EscrowHold;
}

export interface FabricDeliverResult {
  readonly receipt: ProofReceipt;
  readonly proof: VerifiedFactProof;
  readonly verify: VerifyReleaseResult;
}

export class CognitiaHarness {
  readonly config: HarnessConfig;
  readonly clock: DeterministicClock;
  readonly ledger: ActionLedger;
  readonly marketplace: MarketplaceService;
  readonly escrow: EscrowService;
  readonly reputation: ReputationService;
  readonly fabric: AgentFabric;
  readonly trustFeed: TrustFeed;
  readonly notifier: Notifier;

  constructor(overrides: HarnessConfigOverrides = {}, env: NodeJS.ProcessEnv = process.env) {
    this.config = createSafeConfig(overrides, env);
    this.clock = new DeterministicClock();
    this.ledger = new ActionLedger(this.clock);
    this.marketplace = new MarketplaceService(this.clock);
    this.escrow = new EscrowService(this.config, this.clock);
    this.reputation = new ReputationService(this.clock);
    this.fabric = new AgentFabric(this.config, this.clock);
    this.trustFeed = new TrustFeed(this.config, this.clock);
    this.notifier = new Notifier(this.config, this.clock);
  }

  // --- Actor factories -----------------------------------------------------

  humanOperator(id: string, displayName: string): Actor {
    return { id, kind: "human", displayName, capabilities: HUMAN_OPERATOR_CAPS };
  }

  aiAgent(id: string, displayName: string): Actor {
    return { id, kind: "ai_agent", displayName, capabilities: AI_AGENT_CAPS };
  }

  // --- Scenario 1: human creates / approves work ---------------------------

  createListing(human: Actor, input: { title: string; priceUnits: number }): Listing {
    this.requireCapability(human, "create_work");
    const listing = this.marketplace.createListing({
      ownerId: human.id,
      title: input.title,
      priceUnits: input.priceUnits,
    });
    this.ledger.append({
      actor: human,
      verb: "create_listing",
      target: listing.id,
      status: "executed",
      metadata: { title: input.title, priceUnits: input.priceUnits },
    });
    return listing;
  }

  approveWork(human: Actor, workOrder: WorkOrder): ActionLedgerEntry {
    this.requireCapability(human, "approve_work");
    return this.ledger.append({
      actor: human,
      verb: "approve_work",
      target: workOrder.id,
      status: "approved",
    });
  }

  // --- Scenario 2: AI agent proposes; human approves via the ledger --------

  proposeAction(
    agent: Actor,
    input: { verb: string; target: string; metadata?: Record<string, unknown> },
  ): ActionLedgerEntry {
    this.requireCapability(agent, "propose_action");
    return this.ledger.append({
      actor: agent,
      verb: input.verb,
      target: input.target,
      status: "proposed",
      metadata: input.metadata ?? {},
    });
  }

  approveProposal(human: Actor, proposal: ActionLedgerEntry): ActionLedgerEntry {
    this.requireCapability(human, "approve_work");
    if (proposal.status !== "proposed") {
      throw new Error(`Cannot approve a ${proposal.status} ledger entry.`);
    }
    return this.ledger.append({
      actor: human,
      verb: `approve:${proposal.verb}`,
      target: proposal.target,
      status: "executed",
      metadata: { proposalId: proposal.id, proposalHash: proposal.hash },
    });
  }

  // --- Scenario 3: listing -> work order -> escrow reserve -----------------

  openWorkOrder(input: { listing: Listing; worker: Actor }): OpenWorkOrderResult {
    const workOrder = this.marketplace.createWorkOrder({
      listingId: input.listing.id,
      workerId: input.worker.id,
    });
    const escrow = this.escrow.reserve({
      workOrderId: workOrder.id,
      payerId: input.listing.ownerId,
      payeeId: input.worker.id,
      amountUnits: workOrder.priceUnits,
    });
    this.marketplace.attachEscrow(workOrder.id, escrow.id);
    this.ledger.append({
      actor: input.worker,
      verb: "open_work_order",
      target: workOrder.id,
      status: input.worker.kind === "human" ? "executed" : "proposed",
      metadata: { escrowId: escrow.id, amountUnits: escrow.amountUnits },
    });
    return { listing: input.listing, workOrder, escrow };
  }

  // --- Delivery (worker or agent) ------------------------------------------

  deliverWork(worker: Actor, workOrder: WorkOrder, proof: VerifiedFactProof): ActionLedgerEntry {
    this.requireCapability(worker, "deliver_work");
    this.marketplace.setStatus(workOrder.id, "delivered");
    return this.ledger.append({
      actor: worker,
      verb: "deliver_work",
      target: workOrder.id,
      // Human delivery is self-executed; agent delivery is a proposal awaiting
      // owner verification.
      status: worker.kind === "human" ? "executed" : "proposed",
      metadata: { claim: proof.claim, artifactRef: proof.artifactRef },
    });
  }

  // --- Scenarios 4 & 5: verified_fact proof -> owner verify ----------------

  verifyAndRelease(
    owner: Actor,
    workOrder: WorkOrder,
    proof: VerifiedFactProof,
  ): VerifyReleaseResult {
    this.requireCapability(owner, "verify_proof");
    this.requireCapability(owner, "release_escrow");

    const evaluation = evaluateProof(proof);

    if (evaluation.verdict !== "strong") {
      // Scenario 5: weak proof refused. Escrow stays reserved; no reputation.
      const ledgerEntry = this.ledger.append({
        actor: owner,
        verb: "refuse_release",
        target: workOrder.id,
        status: "refused",
        metadata: {
          verdict: evaluation.verdict,
          strength: evaluation.strength,
          reasons: evaluation.reasons,
        },
      });
      return {
        evaluation,
        released: false,
        settlement: null,
        reputationAwarded: 0,
        ledgerEntry,
      };
    }

    // Scenario 4: strong proof -> release escrow + award reputation.
    if (workOrder.escrowId === null) {
      throw new Error(`Work order ${workOrder.id} has no escrow to release.`);
    }
    const settlement = this.escrow.release(workOrder.escrowId);
    this.marketplace.setStatus(workOrder.id, "released");

    const reputationAwarded = 10;
    this.reputation.award(workOrder.workerId, reputationAwarded, `verified release ${workOrder.id}`);

    const ledgerEntry = this.ledger.append({
      actor: owner,
      verb: "verify_and_release",
      target: workOrder.id,
      status: "executed",
      metadata: {
        verdict: evaluation.verdict,
        strength: evaluation.strength,
        toPayee: settlement.toPayee,
        reputationAwarded,
      },
    });

    // Public, sanitized signal — only surfaces if the feed is configured on.
    this.trustFeed.publish("verified_release", "a work order completed with a verified proof");
    this.notifier.sendSms(owner.id, "Simulated: your work order was released on a verified proof.");

    return { evaluation, released: true, settlement, reputationAwarded, ledgerEntry };
  }

  // --- Scenario 6: dispute -> refund / split -------------------------------

  resolveDispute(resolver: Actor, workOrder: WorkOrder, resolution: DisputeResolution): SettlementResult {
    this.requireCapability(resolver, "resolve_dispute");
    if (workOrder.escrowId === null) {
      throw new Error(`Work order ${workOrder.id} has no escrow to dispute.`);
    }
    this.marketplace.setStatus(workOrder.id, "disputed");

    const settlement =
      resolution.outcome === "refund"
        ? this.escrow.refund(workOrder.escrowId)
        : this.escrow.split(workOrder.escrowId, resolution.workerShare);

    this.marketplace.setStatus(workOrder.id, resolution.outcome === "refund" ? "refunded" : "split");

    // Disputes never award reputation.
    this.ledger.append({
      actor: resolver,
      verb: `dispute_${resolution.outcome}`,
      target: workOrder.id,
      status: "executed",
      metadata: {
        outcome: resolution.outcome,
        toPayee: settlement.toPayee,
        toPayer: settlement.toPayer,
      },
    });

    return settlement;
  }

  // --- Scenario 7: Agent Fabric simulated route -> receipt -> deliver ------

  fabricDeliver(input: {
    agent: Actor;
    owner: Actor;
    workOrder: WorkOrder;
    claim: string;
    hops: ReadonlyArray<string>;
  }): FabricDeliverResult {
    // Simulated route returns a proof receipt (never a real network call).
    const receipt = this.fabric.route({
      workOrderId: input.workOrder.id,
      claim: input.claim,
      hops: input.hops,
    });

    // Build a verified_fact proof backed by the simulated receipt. The receipt
    // provides one independent signal; a second comes from owner-side checks.
    const proof: VerifiedFactProof = {
      workOrderId: input.workOrder.id,
      claim: input.claim,
      artifactRef: receipt.artifactRef,
      evidence: [
        { kind: "fabric_receipt", present: true, weight: 0.5, independent: true },
        { kind: "owner_spotcheck", present: true, weight: 0.3, independent: true },
        { kind: "self_attestation", present: true, weight: 0.2, independent: false },
      ],
    };

    this.deliverWork(input.agent, input.workOrder, proof);
    const verify = this.verifyAndRelease(input.owner, input.workOrder, proof);

    return { receipt, proof, verify };
  }

  // --- Authorization helper ------------------------------------------------

  private requireCapability(actor: Actor, capability: Capability): void {
    if (!actor.capabilities.includes(capability)) {
      throw new AuthorizationError(actor, capability);
    }
  }
}
