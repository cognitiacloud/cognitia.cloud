/**
 * PILOT-001 — Tenant Zero / Demandara proof harness tests.
 *
 * These tests exercise human and AI-agent operation paths through a fully
 * simulated Cognitia. They prove the *shape* of the flows (ledger, escrow,
 * proof, reputation, dispute, fabric, trust feed) without touching production,
 * real money, real SMS, or any external API.
 *
 * Run: `pnpm --filter @cognitia/api test`  (or `pnpm check` from the repo root)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { CognitiaHarness, AuthorizationError } from "./harness/cognitiaHarness.ts";
import { ProductionGuardError, RealChannelError, createSafeConfig } from "./harness/environment.ts";
import { evaluateProof } from "./harness/proof.ts";
import type { VerifiedFactProof, DisputeResolution } from "./harness/types.ts";

function strongProof(workOrderId: string): VerifiedFactProof {
  return {
    workOrderId,
    claim: "delivered the agreed artifact",
    artifactRef: "sim://artifact/abc123",
    evidence: [
      { kind: "signed_receipt", present: true, weight: 0.4, independent: true },
      { kind: "owner_spotcheck", present: true, weight: 0.4, independent: true },
      { kind: "self_attestation", present: true, weight: 0.2, independent: false },
    ],
  };
}

function weakProof(workOrderId: string): VerifiedFactProof {
  return {
    workOrderId,
    claim: "trust me, it is done",
    artifactRef: null, // no verifiable artifact
    evidence: [
      { kind: "self_attestation", present: true, weight: 0.6, independent: false },
      { kind: "owner_spotcheck", present: false, weight: 0.4, independent: true },
    ],
  };
}

// --- Scenario 1: human operator creates / approves work --------------------

test("human path: operator creates a listing and approves work on the ledger", () => {
  const h = new CognitiaHarness();
  const owner = h.humanOperator("op_alice", "Alice (operator)");
  const worker = h.humanOperator("wk_bob", "Bob (worker)");

  const listing = h.createListing(owner, { title: "Annotate dataset", priceUnits: 100 });
  const { workOrder, escrow } = h.openWorkOrder({ listing, worker });
  const approval = h.approveWork(owner, workOrder);

  assert.equal(listing.ownerId, "op_alice");
  assert.equal(workOrder.status, "reserved");
  assert.equal(escrow.status, "reserved");
  assert.equal(approval.status, "approved");
  assert.equal(approval.actorKind, "human");

  // Deliver + verify + release with a strong proof.
  h.deliverWork(worker, workOrder, strongProof(workOrder.id));
  const result = h.verifyAndRelease(owner, workOrder, strongProof(workOrder.id));

  assert.equal(result.released, true);
  assert.equal(result.settlement?.toPayee, 100);
  assert.equal(h.escrow.get(escrow.id).status, "released");
  assert.equal(h.reputation.score("wk_bob"), 10);
  assert.ok(h.ledger.verifyChain(), "ledger hash chain must be intact");
});

// --- Scenario 2: AI agent proposes; human approves through the ledger ------

test("AI-agent path: agent proposes accept/deliver, human approves via the ledger", () => {
  const h = new CognitiaHarness();
  const owner = h.humanOperator("op_alice", "Alice (operator)");
  const agent = h.aiAgent("ag_atlas", "Atlas (AI agent)");

  const proposal = h.proposeAction(agent, {
    verb: "accept_and_deliver",
    target: "wo_pending",
    metadata: { plan: "accept listing, deliver annotated batch" },
  });
  assert.equal(proposal.status, "proposed");
  assert.equal(proposal.actorKind, "ai_agent");

  const approval = h.approveProposal(owner, proposal);
  assert.equal(approval.status, "executed");
  assert.equal(approval.actorKind, "human");
  assert.equal(approval.metadata.proposalId, proposal.id);

  // The agent cannot self-approve: capability is structurally withheld.
  assert.throws(() => h.approveProposal(agent, proposal), AuthorizationError);
  // The agent cannot verify a proof or release escrow either.
  const listing = h.createListing(owner, { title: "x", priceUnits: 10 });
  const { workOrder } = h.openWorkOrder({ listing, worker: agent });
  assert.throws(
    () => h.verifyAndRelease(agent, workOrder, strongProof(workOrder.id)),
    AuthorizationError,
  );
  assert.ok(h.ledger.verifyChain());
});

// --- Scenario 3: marketplace listing -> work order -> escrow reserve -------

test("marketplace: listing -> work order -> escrow reserve", () => {
  const h = new CognitiaHarness();
  const owner = h.humanOperator("op_alice", "Alice");
  const worker = h.humanOperator("wk_bob", "Bob");

  const listing = h.createListing(owner, { title: "Translate doc", priceUnits: 250 });
  const { workOrder, escrow } = h.openWorkOrder({ listing, worker });

  assert.equal(workOrder.listingId, listing.id);
  assert.equal(workOrder.escrowId, escrow.id);
  assert.equal(escrow.amountUnits, 250);
  assert.equal(escrow.payerId, "op_alice");
  assert.equal(escrow.payeeId, "wk_bob");
  assert.equal(escrow.status, "reserved");
});

// --- Scenario 4: verified_fact proof -> owner verify -> release + reputation

test("verified release: strong proof releases escrow and awards reputation", () => {
  const h = new CognitiaHarness();
  const owner = h.humanOperator("op_alice", "Alice");
  const worker = h.humanOperator("wk_bob", "Bob");
  const listing = h.createListing(owner, { title: "QA pass", priceUnits: 80 });
  const { workOrder } = h.openWorkOrder({ listing, worker });

  h.deliverWork(worker, workOrder, strongProof(workOrder.id));
  const result = h.verifyAndRelease(owner, workOrder, strongProof(workOrder.id));

  assert.equal(result.evaluation.verdict, "strong");
  assert.equal(result.released, true);
  assert.equal(result.reputationAwarded, 10);
  assert.equal(h.reputation.score("wk_bob"), 10);
  assert.equal(h.marketplace.getWorkOrder(workOrder.id).status, "released");
});

// --- Scenario 5: weak proof path refused -----------------------------------

test("weak proof refused: escrow stays reserved, no reputation, refusal logged", () => {
  const h = new CognitiaHarness();
  const owner = h.humanOperator("op_alice", "Alice");
  const worker = h.humanOperator("wk_bob", "Bob");
  const listing = h.createListing(owner, { title: "Risky claim", priceUnits: 500 });
  const { workOrder, escrow } = h.openWorkOrder({ listing, worker });

  h.deliverWork(worker, workOrder, weakProof(workOrder.id));
  const result = h.verifyAndRelease(owner, workOrder, weakProof(workOrder.id));

  assert.equal(result.evaluation.verdict, "weak");
  assert.equal(result.released, false);
  assert.equal(result.settlement, null);
  assert.equal(result.reputationAwarded, 0);
  assert.equal(h.escrow.get(escrow.id).status, "reserved", "money must NOT move on a weak proof");
  assert.equal(h.reputation.score("wk_bob"), 0);
  assert.equal(result.ledgerEntry.status, "refused");
  assert.ok(result.evaluation.reasons.some((r) => r.includes("artifact")));
});

// --- Scenario 6: dispute -> refund / split ---------------------------------

test("dispute refund: escrow returns fully to the payer", () => {
  const h = new CognitiaHarness();
  const owner = h.humanOperator("op_alice", "Alice");
  const worker = h.humanOperator("wk_bob", "Bob");
  const listing = h.createListing(owner, { title: "Disputed job", priceUnits: 200 });
  const { workOrder, escrow } = h.openWorkOrder({ listing, worker });

  const resolution: DisputeResolution = { workOrderId: workOrder.id, outcome: "refund", workerShare: 0 };
  const settlement = h.resolveDispute(owner, workOrder, resolution);

  assert.equal(settlement.status, "refunded");
  assert.equal(settlement.toPayer, 200);
  assert.equal(settlement.toPayee, 0);
  assert.equal(h.escrow.get(escrow.id).status, "refunded");
  assert.equal(h.reputation.score("wk_bob"), 0, "disputes never award reputation");
});

test("dispute split: escrow splits between payer and payee", () => {
  const h = new CognitiaHarness();
  const owner = h.humanOperator("op_alice", "Alice");
  const worker = h.humanOperator("wk_bob", "Bob");
  const listing = h.createListing(owner, { title: "Partial job", priceUnits: 200 });
  const { workOrder } = h.openWorkOrder({ listing, worker });

  const resolution: DisputeResolution = { workOrderId: workOrder.id, outcome: "split", workerShare: 0.25 };
  const settlement = h.resolveDispute(owner, workOrder, resolution);

  assert.equal(settlement.status, "split");
  assert.equal(settlement.toPayee, 50);
  assert.equal(settlement.toPayer, 150);
  assert.equal(h.marketplace.getWorkOrder(workOrder.id).status, "split");
});

// --- Scenario 7: Agent Fabric simulated route -> receipt -> deliver --------

test("fabric simulation path: simulated route yields a simulated receipt then delivers", () => {
  const h = new CognitiaHarness();
  const owner = h.humanOperator("op_alice", "Alice");
  const agent = h.aiAgent("ag_atlas", "Atlas");
  const listing = h.createListing(owner, { title: "Routed task", priceUnits: 120 });
  const { workOrder } = h.openWorkOrder({ listing, worker: agent });

  const result = h.fabricDeliver({
    agent,
    owner,
    workOrder,
    claim: "routed and completed via fabric",
    hops: ["router-a", "worker-pool-3"],
  });

  assert.equal(result.receipt.simulated, true);
  assert.match(result.receipt.artifactRef, /^sim:\/\/fabric\//);
  assert.deepEqual(result.receipt.route, ["origin", "router-a", "worker-pool-3", "proof-sink"]);
  assert.equal(result.verify.released, true);
  assert.equal(result.verify.evaluation.verdict, "strong");
  assert.equal(h.reputation.score("ag_atlas"), 10);
});

// --- Scenario 8: public trust feed is safe-empty unless configured ---------

test("trust feed: safe-empty by default, populated only when explicitly configured", () => {
  const off = new CognitiaHarness();
  const owner = off.humanOperator("op_alice", "Alice");
  const worker = off.humanOperator("wk_bob", "Bob");
  const listing = off.createListing(owner, { title: "Feed test", priceUnits: 10 });
  const { workOrder } = off.openWorkOrder({ listing, worker });
  off.deliverWork(worker, workOrder, strongProof(workOrder.id));
  off.verifyAndRelease(owner, workOrder, strongProof(workOrder.id));
  assert.equal(off.trustFeed.enabled, false);
  assert.deepEqual(off.trustFeed.feed(), [], "trust feed must be empty unless configured on");

  const on = new CognitiaHarness({ publicTrustFeedEnabled: true });
  const o2 = on.humanOperator("op_alice", "Alice");
  const w2 = on.humanOperator("wk_bob", "Bob");
  const l2 = on.createListing(o2, { title: "Feed test", priceUnits: 10 });
  const { workOrder: wo2 } = on.openWorkOrder({ listing: l2, worker: w2 });
  on.deliverWork(w2, wo2, strongProof(wo2.id));
  on.verifyAndRelease(o2, wo2, strongProof(wo2.id));
  assert.equal(on.trustFeed.enabled, true);
  assert.equal(on.trustFeed.feed().length, 1);
  // Sanitized: no actor ids, no amounts in the public summary.
  const event = on.trustFeed.feed()[0];
  assert.ok(event);
  assert.doesNotMatch(event.summary, /op_alice|wk_bob|\d+/);
});

// --- Guard: no production creds needed (and production refused) ------------

test("guards: harness constructs with no env, and refuses production", () => {
  // No production credentials required — empty env is fine.
  const cfg = createSafeConfig({}, {});
  assert.equal(cfg.mode, "simulation");
  assert.equal(cfg.realSms, false);
  assert.equal(cfg.realPayments, false);
  assert.equal(cfg.realExternalApis, false);
  assert.equal(cfg.authTokenRequired, false);
  assert.equal(cfg.publicTrustFeedEnabled, false);

  // Dev/test placeholders are allowed.
  assert.doesNotThrow(() => createSafeConfig({}, { STRIPE_SECRET_KEY: "sk_test_placeholder" }));

  // Real-looking production creds abort construction.
  assert.throws(() => createSafeConfig({}, { NODE_ENV: "production" }), ProductionGuardError);
  assert.throws(
    () => createSafeConfig({}, { DATABASE_URL: "postgres://prod-host/db" }),
    ProductionGuardError,
  );
  assert.throws(
    () => createSafeConfig({}, { TWILIO_AUTH_TOKEN: "AC_real_live_token" }),
    ProductionGuardError,
  );
});

// --- Guard: no real external calls -----------------------------------------

test("guards: every external touchpoint is simulation-only", () => {
  const h = new CognitiaHarness();

  // SMS is recorded to an in-memory outbox marked "simulated".
  const msg = h.notifier.sendSms("op_alice", "hello");
  assert.equal(msg.delivered, "simulated");
  assert.equal(h.notifier.messages().length, 1);

  // Fabric routing returns a simulated receipt, never a real network result.
  const receipt = h.fabric.route({ workOrderId: "wo_x", claim: "c", hops: [] });
  assert.equal(receipt.simulated, true);

  // The real-channel guards exist and would throw if a real flag were ever set.
  assert.ok(RealChannelError.prototype instanceof Error);

  // Escrow only ever moves simulated units; no payment rail is reachable.
  const owner = h.humanOperator("op_alice", "Alice");
  const worker = h.humanOperator("wk_bob", "Bob");
  const listing = h.createListing(owner, { title: "t", priceUnits: 5 });
  const { escrow } = h.openWorkOrder({ listing, worker });
  assert.equal(h.escrow.get(escrow.id).status, "reserved");
});

// --- Unit: proof evaluation rules ------------------------------------------

test("proof evaluation: strong requires artifact + 2 independent signals + threshold", () => {
  const strong = evaluateProof(strongProof("wo_1"));
  assert.equal(strong.verdict, "strong");
  assert.ok(strong.strength >= 0.6);
  assert.ok(strong.independentSignals >= 2);

  const weak = evaluateProof(weakProof("wo_1"));
  assert.equal(weak.verdict, "weak");
  assert.ok(weak.reasons.length > 0);
});

// --- Determinism: identical runs produce identical ledger hashes -----------

test("determinism: two identical runs produce the same final ledger hash", () => {
  function run(): string {
    const h = new CognitiaHarness();
    const owner = h.humanOperator("op_alice", "Alice");
    const worker = h.humanOperator("wk_bob", "Bob");
    const listing = h.createListing(owner, { title: "Repro", priceUnits: 42 });
    const { workOrder } = h.openWorkOrder({ listing, worker });
    h.deliverWork(worker, workOrder, strongProof(workOrder.id));
    h.verifyAndRelease(owner, workOrder, strongProof(workOrder.id));
    return h.ledger.last()?.hash ?? "";
  }
  assert.equal(run(), run());
});
