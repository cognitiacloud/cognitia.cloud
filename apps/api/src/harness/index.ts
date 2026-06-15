/**
 * Public surface of the Cognitia pilot proof harness (dev/simulation only).
 */
export * from "./types.ts";
export * from "./environment.ts";
export { DeterministicClock } from "./clock.ts";
export { ActionLedger } from "./actionLedger.ts";
export { EscrowService, EscrowError } from "./escrow.ts";
export { MarketplaceService, MarketplaceError } from "./marketplace.ts";
export { ReputationService } from "./reputation.ts";
export { AgentFabric } from "./agentFabric.ts";
export { TrustFeed } from "./trustFeed.ts";
export { Notifier } from "./notifier.ts";
export { evaluateProof, STRENGTH_THRESHOLD, MIN_INDEPENDENT_SIGNALS } from "./proof.ts";
export { CognitiaHarness, AuthorizationError } from "./cognitiaHarness.ts";
