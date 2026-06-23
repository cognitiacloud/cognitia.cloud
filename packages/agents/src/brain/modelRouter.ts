/**
 * Cognitia Brain Harness V1 — governed model router.
 *
 * STATUS: MOCK / SANDBOX. The single entry point agents use to run a task
 * through a governed model instead of hardcoding one LLM. It performs, in order:
 * task resolution → high-risk approval gate → capability matching → workspace
 * policy (allow-list, cost ceiling, latency tier, local-only, data
 * classification ↔ privacy) → preferred/fallback selection → execution on the
 * deterministic mock provider → a privacy-safe usage receipt.
 *
 * It NEVER stores the raw prompt (only a hash) and NEVER calls the network: the
 * only executable provider in V1 is the mock provider; disabled providers are
 * skipped during selection and fail closed if invoked directly.
 */
import { evaluateModelPolicy, modelKey, type WorkspaceModelPolicy } from './modelPolicy.js';
import {
  SYNTHETIC_LATENCY_MS,
  type DataClassification,
  type GenerateRequest,
  type ModelCapability,
  type ModelDescriptor,
} from './modelProvider.js';
import { ModelRegistry } from './modelRegistry.js';
import { makeUsageReceipt, ModelUsageLedger, type UsageReceipt } from './modelUsageLedger.js';
import { TaskRegistry, type TaskSpec } from './taskRegistry.js';

/** A model reference (provider + model id). */
export interface ModelRef {
  providerId: string;
  modelId: string;
}

/** Input to a single routed generation. */
export interface RouteInput {
  workspaceId: string;
  taskType: string;
  /** The generation request. Its `prompt` is hashed into the receipt, never stored. */
  request: GenerateRequest;
  policy: WorkspaceModelPolicy;
  /** First-choice model. Tried before the fallback chain. */
  preferredModel?: ModelRef;
  /** Ordered fallbacks tried after the preferred model. */
  fallbackChain?: readonly ModelRef[];
  /** Overrides the task spec's default data classification. */
  dataClassification?: DataClassification;
  /** Explicit approval for high-risk tasks (required when policy demands it). */
  approvalGranted?: boolean;
}

export interface RouterResult {
  ok: boolean;
  receipt: UsageReceipt;
  /** The model that served the task (present only when `ok`). */
  selected?: ModelRef;
  output?: string;
  structuredOutput?: unknown;
  fallbackUsed: boolean;
  /** Stable block reason when `!ok`. */
  blockedReason?: string;
}

export interface ModelRouterDeps {
  registry: ModelRegistry;
  ledger: ModelUsageLedger;
  taskRegistry?: TaskRegistry;
  /** Injectable clock for deterministic `createdAt`. */
  now?: () => Date;
}

interface Candidate {
  ref: ModelRef;
  /** Why this candidate was rejected (undefined => eligible). */
  rejection?: string;
}

/** Capabilities a request implies beyond the task spec (tools / structured). */
function requestCapabilities(request: GenerateRequest): ModelCapability[] {
  const caps: ModelCapability[] = [];
  if ((request.tools?.length ?? 0) > 0) caps.push('tool_call');
  if (request.structured) caps.push('structured_output');
  return caps;
}

function missingCapabilities(
  descriptor: ModelDescriptor,
  required: readonly ModelCapability[],
): ModelCapability[] {
  const have = new Set(descriptor.capabilities);
  return required.filter((c) => !have.has(c));
}

export class ModelRouter {
  private readonly registry: ModelRegistry;
  private readonly ledger: ModelUsageLedger;
  private readonly tasks: TaskRegistry;
  private readonly now: () => Date;

  constructor(deps: ModelRouterDeps) {
    this.registry = deps.registry;
    this.ledger = deps.ledger;
    this.tasks = deps.taskRegistry ?? new TaskRegistry();
    this.now = deps.now ?? (() => new Date());
  }

  async route(input: RouteInput): Promise<RouterResult> {
    const spec = this.tasks.getOrDefault(input.taskType);
    const dataClassification = input.dataClassification ?? spec.dataClassification;
    const inputText = `${input.request.system ?? ''} ${input.request.prompt}`;
    const createdAt = this.now().toISOString();

    // 1. High-risk approval gate (task-level; independent of model choice).
    if (
      spec.riskTier === 'high' &&
      input.policy.requireApprovalForHighRisk &&
      !input.approvalGranted
    ) {
      return this.blocked(input, spec, inputText, createdAt, 'high_risk_requires_approval');
    }

    // 2. Build the ordered candidate list.
    const candidates = this.orderedCandidates(input);
    if (candidates.length === 0) {
      return this.blocked(input, spec, inputText, createdAt, 'no_candidate_models');
    }

    const required: ModelCapability[] = [
      ...spec.requiredCapabilities,
      ...requestCapabilities(input.request),
    ];

    // 3. Walk candidates; first eligible one wins.
    const evaluated: Candidate[] = [];
    for (const ref of candidates) {
      const rejection = this.rejectionFor(ref, required, input.policy, dataClassification);
      evaluated.push({ ref, rejection });
      if (!rejection) {
        return await this.execute(input, spec, ref, inputText, createdAt, evaluated);
      }
    }

    // 4. Nothing eligible → blocked. Report the first (preferred) candidate's reason.
    const firstReason = evaluated[0]?.rejection ?? 'no_eligible_model';
    return this.blocked(input, spec, inputText, createdAt, firstReason, evaluated[0]?.ref);
  }

  /** Preferred model first, then fallback chain, then policy-allowed enabled models. */
  private orderedCandidates(input: RouteInput): ModelRef[] {
    const out: ModelRef[] = [];
    const seen = new Set<string>();
    const push = (ref: ModelRef) => {
      const key = modelKey(ref.providerId, ref.modelId);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(ref);
      }
    };
    if (input.preferredModel) push(input.preferredModel);
    for (const ref of input.fallbackChain ?? []) push(ref);
    // Implicit fallback: any enabled, policy-allowed model in registration order.
    if (out.length === 0) {
      for (const d of this.registry.listEnabled()) {
        if (input.policy.allowedProviders.includes(d.providerId)) {
          push({ providerId: d.providerId, modelId: d.modelId });
        }
      }
    }
    return out;
  }

  /** Returns a rejection reason for a candidate, or `undefined` if eligible. */
  private rejectionFor(
    ref: ModelRef,
    required: readonly ModelCapability[],
    policy: WorkspaceModelPolicy,
    dataClassification: DataClassification,
  ): string | undefined {
    const provider = this.registry.get(ref.providerId, ref.modelId);
    if (!provider) return 'model_not_registered';
    const descriptor = provider.descriptor;

    if (!descriptor.enabled) return 'provider_disabled';

    const missing = missingCapabilities(descriptor, required);
    if (missing.length > 0) return `capability_mismatch:${missing.join(',')}`;

    const decision = evaluateModelPolicy(descriptor, { policy, dataClassification });
    if (!decision.allow) return decision.reasons[0] ?? 'policy_blocked';

    return undefined;
  }

  private async execute(
    input: RouteInput,
    spec: TaskSpec,
    ref: ModelRef,
    inputText: string,
    createdAt: string,
    evaluated: readonly Candidate[],
  ): Promise<RouterResult> {
    const provider = this.registry.get(ref.providerId, ref.modelId);
    // Guaranteed present + enabled (rejectionFor passed), but stay defensive.
    if (!provider || !provider.descriptor.enabled) {
      return this.blocked(input, spec, inputText, createdAt, 'provider_disabled', ref);
    }
    const descriptor = provider.descriptor;
    const result = await provider.generate(input.request);

    const costEstimate =
      (descriptor.costPer1kTokensUsd * (result.tokensIn + result.tokensOut)) / 1000;
    const latencyMs = SYNTHETIC_LATENCY_MS[descriptor.latencyTier];
    // Fallback used if the winning candidate was not the first one tried.
    const fallbackUsed = evaluated.length > 1;

    const receipt = this.ledger.append(
      makeUsageReceipt({
        workspaceId: input.workspaceId,
        taskType: input.taskType,
        provider: descriptor.providerId,
        model: descriptor.modelId,
        mode: descriptor.mode,
        inputText,
        outputText: result.output,
        costEstimate,
        latencyMs,
        fallbackUsed,
        policyDecision: 'allow',
        createdAt,
      }),
    );

    return {
      ok: true,
      receipt,
      selected: ref,
      output: result.output,
      structuredOutput: result.structuredOutput,
      fallbackUsed,
    };
  }

  private blocked(
    input: RouteInput,
    _spec: TaskSpec,
    inputText: string,
    createdAt: string,
    blockedReason: string,
    ref?: ModelRef,
  ): RouterResult {
    const descriptor = ref ? this.registry.get(ref.providerId, ref.modelId)?.descriptor : undefined;
    const receipt = this.ledger.append(
      makeUsageReceipt({
        workspaceId: input.workspaceId,
        taskType: input.taskType,
        provider: ref?.providerId ?? 'none',
        model: ref?.modelId ?? 'none',
        mode: descriptor?.mode ?? 'mock',
        inputText,
        outputText: null,
        costEstimate: 0,
        latencyMs: 0,
        fallbackUsed: false,
        policyDecision: 'blocked',
        blockedReason,
        createdAt,
      }),
    );
    return { ok: false, receipt, fallbackUsed: false, blockedReason };
  }
}
