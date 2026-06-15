/**
 * Agent Fabric — simulated routing layer.
 *
 * In production this would dispatch a request across a mesh of agents/services.
 * In the harness it returns a deterministic, clearly-labelled *simulated* proof
 * receipt. It never opens a socket; the `external_api` guard is asserted on
 * every route so a future regression that tried to make a real call would throw.
 */
import type { DeterministicClock } from "./clock.ts";
import { assertSimulationOnly, type HarnessConfig } from "./environment.ts";
import type { ProofReceipt } from "./types.ts";

export interface FabricRouteRequest {
  readonly workOrderId: string;
  readonly claim: string;
  readonly hops: ReadonlyArray<string>;
}

export class AgentFabric {
  private readonly config: HarnessConfig;
  private readonly clock: DeterministicClock;

  constructor(config: HarnessConfig, clock: DeterministicClock) {
    this.config = config;
    this.clock = clock;
  }

  /**
   * "Route" the request through a simulated mesh and return a proof receipt.
   * The receipt is always `simulated: true` and carries a synthetic artifact
   * reference derived from the route — never a real external resource.
   */
  route(request: FabricRouteRequest): ProofReceipt {
    assertSimulationOnly(this.config, "external_api");
    const route = ["origin", ...request.hops, "proof-sink"];
    const receiptId = this.clock.id("rcpt");
    return {
      receiptId,
      route,
      simulated: true,
      latencyMs: route.length * 12,
      claim: request.claim,
      artifactRef: `sim://fabric/${receiptId}/${request.workOrderId}`,
    };
  }
}
