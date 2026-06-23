/**
 * Cognitia Brain Harness — Router.
 *
 * The router is the orchestrator: given a task, a workspace policy and an input,
 * it walks a candidate chain (preferred → fallback → mock), asks the policy
 * engine to clear each candidate, and runs the FIRST cleared+enabled provider.
 * It records exactly one ledger entry per call (hashes only), including for
 * blocked/approval-required outcomes where nothing executed.
 *
 * Mock-safe by construction: only providers passed into the constructor can run,
 * and the default set is `{ mock }`. A disabled provider that slips into the
 * chain cannot execute — its `generate()` throws — and the router simply
 * advances to the next candidate (recording that a fallback was used).
 */

import {
  PROVIDER_REGISTRY,
  defaultWorkspacePolicy,
  evaluateBrainPolicy,
  type BrainMode,
  type BrainPolicyDecision,
  type WorkspaceBrainPolicy,
} from './brainPolicy.js';
import { BrainRunLedger, hashInput, hashOutput, type BrainRunRecord } from './brainRunLedger.js';
import { getTask, type BrainTaskType } from './taskRegistry.js';
import { mockBrainProvider } from './providers/mockProvider.js';
import {
  ProviderDisabledError,
  type BrainProvider,
  type BrainResponse,
} from './providers/brainProvider.js';

export interface BrainRouteInput {
  taskType: BrainTaskType;
  /** Prompt/content to run. Hashed for the ledger; never stored raw. */
  input: string;
  workspacePolicy: WorkspaceBrainPolicy;
  /** Override the policy's preferred provider for this call. */
  preferredProvider?: string;
  /** Optional explicit model id. */
  model?: string;
  /** Set when a human approval has been recorded for this run. */
  approvalGranted?: boolean;
}

export interface BrainRouteResult {
  /** Whether a provider actually executed. */
  executed: boolean;
  /** Provider id that served (or the last candidate considered). */
  provider: string;
  model: string;
  mode: BrainMode;
  /** Terminal policy decision for the served (or final) candidate. */
  policyDecision: BrainPolicyDecision;
  fallbackUsed: boolean;
  requiresApproval: boolean;
  /** The model response, when one executed. */
  response?: BrainResponse;
  /** The ledger record written for this call. */
  ledgerRecord: BrainRunRecord;
  /** Per-candidate decisions, in the order they were tried (for debugging). */
  attempts: Array<{ provider: string; model: string; decision: BrainPolicyDecision }>;
}

export interface BrainRouterDeps {
  /** Enabled providers the router may execute. Default: `{ mock }`. */
  providers?: Record<string, BrainProvider>;
  ledger?: BrainRunLedger;
  /** Descriptor registry used for policy (default: the shared registry). */
  registry?: typeof PROVIDER_REGISTRY;
}

export class BrainRouter {
  private readonly providers: Record<string, BrainProvider>;
  private readonly ledger: BrainRunLedger;
  private readonly registry: typeof PROVIDER_REGISTRY;

  constructor(deps: BrainRouterDeps = {}) {
    this.providers = deps.providers ?? { mock: mockBrainProvider };
    this.ledger = deps.ledger ?? new BrainRunLedger();
    this.registry = deps.registry ?? PROVIDER_REGISTRY;
  }

  get runLedger(): BrainRunLedger {
    return this.ledger;
  }

  /** Build the ordered candidate provider-id chain (deduplicated). */
  private candidateChain(input: BrainRouteInput): string[] {
    const wp = input.workspacePolicy;
    const chain = [
      input.preferredProvider,
      wp.preferredProvider,
      ...(wp.fallbackChain ?? []),
      'mock',
    ].filter((x): x is string => typeof x === 'string' && x.length > 0);
    return [...new Set(chain)];
  }

  /**
   * Pick the model id to evaluate/run for a provider. Prefers an explicitly
   * requested model; otherwise the cheapest model that offers every capability
   * the task requires; otherwise the first model (so the policy engine reports a
   * truthful `capability_mismatch` rather than the router hiding it).
   */
  private resolveModel(
    providerId: string,
    requiredCapabilities: readonly string[],
    requested?: string,
  ): string | undefined {
    const desc = this.registry[providerId];
    if (!desc || desc.models.length === 0) return undefined;
    if (requested && desc.models.some((m) => m.id === requested)) return requested;
    const capable = desc.models
      .filter((m) => requiredCapabilities.every((c) => m.capabilities.includes(c as never)))
      .sort((a, b) => a.costPer1kTokensUsd - b.costPer1kTokensUsd);
    return (capable[0] ?? desc.models[0]!).id;
  }

  async route(input: BrainRouteInput): Promise<BrainRouteResult> {
    const wp = input.workspacePolicy;
    const task = getTask(input.taskType);
    const inHash = hashInput(input.input);

    // Unknown task: fail closed, record, do not execute.
    if (!task) {
      const decision: BrainPolicyDecision = {
        allowed: false,
        blocked: true,
        requiresApproval: false,
        decisionCode: 'unknown_task',
        reasons: [`task "${input.taskType}" is not registered`],
      };
      const ledgerRecord = this.ledger.record({
        workspaceId: wp.workspaceId,
        taskType: input.taskType,
        provider: 'none',
        model: 'none',
        mode: wp.mode,
        inputHash: inHash,
        outputHash: '',
        costEstimate: 0,
        latencyMs: 0,
        fallbackUsed: false,
        policyDecision: 'unknown_task',
      });
      return {
        executed: false,
        provider: 'none',
        model: 'none',
        mode: wp.mode,
        policyDecision: decision,
        fallbackUsed: false,
        requiresApproval: false,
        ledgerRecord,
        attempts: [],
      };
    }

    const chain = this.candidateChain(input);
    const attempts: BrainRouteResult['attempts'] = [];
    let lastDecision: BrainPolicyDecision | undefined;
    let lastProvider = 'none';
    let lastModel = 'none';

    for (let i = 0; i < chain.length; i++) {
      const providerId = chain[i]!;
      const descriptor = this.registry[providerId];
      const modelId = this.resolveModel(providerId, task.requiredCapabilities, input.model);
      if (!descriptor || !modelId) continue;
      const model = descriptor.models.find((m) => m.id === modelId)!;

      const decision = evaluateBrainPolicy({
        task,
        provider: descriptor,
        model,
        workspacePolicy: wp,
        approvalGranted: input.approvalGranted,
      });
      attempts.push({ provider: providerId, model: modelId, decision });
      lastDecision = decision;
      lastProvider = providerId;
      lastModel = modelId;

      // Approval-required is terminal: never silently fall back to a cheaper
      // candidate to dodge the human gate.
      if (decision.requiresApproval) {
        const ledgerRecord = this.ledger.record({
          workspaceId: wp.workspaceId,
          taskType: task.id,
          provider: providerId,
          model: modelId,
          mode: wp.mode,
          inputHash: inHash,
          outputHash: '',
          costEstimate: 0,
          latencyMs: 0,
          fallbackUsed: i > 0,
          policyDecision: 'requires_approval',
        });
        return {
          executed: false,
          provider: providerId,
          model: modelId,
          mode: wp.mode,
          policyDecision: decision,
          fallbackUsed: i > 0,
          requiresApproval: true,
          ledgerRecord,
          attempts,
        };
      }

      if (!decision.allowed) continue; // blocked → try next candidate.

      // Cleared by policy. Execute, but guard against a disabled provider that
      // is not in the executable set or whose generate() throws.
      const provider = this.providers[providerId];
      if (!provider || !descriptor.enabled) continue;

      try {
        const response = await provider.generate({
          taskType: task.id,
          input: input.input,
          model: modelId,
          metadata: { workspaceId: wp.workspaceId },
        });
        const fallbackUsed = i > 0;
        const ledgerRecord = this.ledger.record({
          workspaceId: wp.workspaceId,
          taskType: task.id,
          provider: response.provider,
          model: response.model,
          mode: wp.mode,
          inputHash: inHash,
          outputHash: hashOutput(response.output),
          costEstimate: response.costEstimateUsd,
          latencyMs: response.latencyMs,
          fallbackUsed,
          policyDecision: 'allow',
        });
        return {
          executed: true,
          provider: response.provider,
          model: response.model,
          mode: wp.mode,
          policyDecision: decision,
          fallbackUsed,
          requiresApproval: false,
          response,
          ledgerRecord,
          attempts,
        };
      } catch (err) {
        if (err instanceof ProviderDisabledError) continue; // advance the chain.
        throw err;
      }
    }

    // Nothing executed: record the final (blocked) decision.
    const decision: BrainPolicyDecision = lastDecision ?? {
      allowed: false,
      blocked: true,
      requiresApproval: false,
      decisionCode: 'provider_disabled',
      reasons: ['no eligible provider in the candidate chain'],
    };
    const ledgerRecord = this.ledger.record({
      workspaceId: wp.workspaceId,
      taskType: task.id,
      provider: lastProvider,
      model: lastModel,
      mode: wp.mode,
      inputHash: inHash,
      outputHash: '',
      costEstimate: 0,
      latencyMs: 0,
      fallbackUsed: chain.length > 1,
      policyDecision: decision.decisionCode,
    });
    return {
      executed: false,
      provider: lastProvider,
      model: lastModel,
      mode: wp.mode,
      policyDecision: decision,
      fallbackUsed: chain.length > 1,
      requiresApproval: false,
      ledgerRecord,
      attempts,
    };
  }
}

/** Convenience: a mock-only router with a default workspace policy. */
export function createMockBrainRouter(deps: BrainRouterDeps = {}): BrainRouter {
  return new BrainRouter(deps);
}

export { defaultWorkspacePolicy };
