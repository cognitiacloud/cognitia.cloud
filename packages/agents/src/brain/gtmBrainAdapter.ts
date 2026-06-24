/**
 * Brain ⇆ GTM integration seam (ported onto the #206 ModelRouter).
 *
 * Proves that existing GTM agents can call the Brain to perform a GTM task
 * WITHOUT hardcoding a model. The caller names a *task* (`prospect.research`,
 * `gtm.routing`, `outreach.draft`); this adapter routes it through the canonical
 * #206 `runTask` / `ModelRouter` (which owns provider resolution, the workspace
 * policy, and the high-risk approval gate) and records an append-only GTM proof
 * event carrying hashes only.
 *
 * This is a THIN ADAPTER — it introduces NO routing/policy engine of its own
 * (the earlier #207 `resolveBrainRoute` / `decideBrainPolicy` duplicated logic
 * the #206 router already owns). Routing + policy + approval are the router's
 * job; proof + PII safety reuse the gtm-os assembly guards.
 *
 * Safety invariants (mock-safe V1):
 *   - mock provider only — the router enforces the V1 mock-only invariant, so a
 *     disabled/non-mock provider can never execute;
 *   - `outreach.draft` is high-risk: without approval the router blocks at the
 *     approval gate (`high_risk_requires_approval`) and no provider runs;
 *   - no raw prompt/output/PII is stored — the usage receipt carries sha256
 *     hashes only, surfaced here as `promptHash` / `outputHash`;
 *   - no live egress — every result carries a no-live-send attestation.
 *
 * The file lives under `brain/`, so the colocated `brainSourceScan.test.ts`
 * enforces that it imports no network primitive and no vendor SDK.
 */
import {
  createGtmProofEvent,
  type GtmEvidenceTag,
  type GtmProofEvent,
  type GtmProofKind,
  type Uuid,
} from '@cognitia/core';
import { randomUUID } from 'node:crypto';
import {
  assertNoLiveEgress,
  assertNoRawPii,
  type NoEgressAttestation,
} from '../gtm-os/assembly/guards.js';
import { runTask } from './brainApi.js';
import { createDefaultModelRegistry, ModelRegistry } from './modelRegistry.js';
import { defaultLocalOnlyPolicy, type WorkspaceModelPolicy } from './modelPolicy.js';
import type { ModelRef } from './modelRouter.js';
import { TaskRegistry } from './taskRegistry.js';

/** The GTM tasks this seam can route to the Brain. They are #206 task types. */
export type GtmBrainTask = 'prospect.research' | 'gtm.routing' | 'outreach.draft';

/** The only executable model in V1 — used as the universal fallback target. */
const MOCK_REF: ModelRef = { providerId: 'mock', modelId: 'mock-deterministic-1' };

/** Default sandbox workspace (Tenant Zero). */
const SANDBOX_WORKSPACE = 'budget_wheels_demo';

/**
 * Preferred provider per task. `outreach.draft` prefers a stronger model that is
 * DISABLED in V1, so the router walks past it and serves the mock from the
 * fallback chain (`fallbackUsed: true`). This demonstrates model-agnostic
 * routing: the GTM caller never names a model.
 */
const TASK_PREFERRED_PROVIDER: Record<GtmBrainTask, string> = {
  'prospect.research': 'mock',
  'gtm.routing': 'mock',
  'outreach.draft': 'anthropic',
};

/** Proof-event kind for a completed task. */
const TASK_PROOF_KIND_EXECUTED: Record<GtmBrainTask, GtmProofKind> = {
  'prospect.research': 'gtm.prospect.sourced.v1',
  'gtm.routing': 'gtm.source.reviewed.v1',
  'outreach.draft': 'gtm.outreach.drafted.v1',
};

/** The policy facts an operator sees, derived from the task spec + router result. */
export interface BrainPolicyDecision {
  riskLevel: 'low' | 'high';
  requiresApproval: boolean;
  blocked: boolean;
  /** The router's stable block reason, or `allowed`. */
  reason: string;
}

/** Input to {@link runGtmBrainTask}. `now`/`newId` are injectable for tests. */
export interface GtmBrainTaskInput {
  task: GtmBrainTask;
  /** The task prompt. May contain PII; it is hashed, never stored raw. */
  promptText: string;
  /** Optional system instruction for the model. */
  system?: string;
  /** Operator approval. High-risk tasks block without it. */
  approval?: boolean;
  /** Workspace scope. Defaults to the sandbox (Tenant Zero). */
  workspaceId?: string;
  /** Registry to route through. Defaults to the #206 default registry. */
  registry?: ModelRegistry;
  /** Policy to route under. Defaults to the conservative local-only policy. */
  policy?: WorkspaceModelPolicy;
  /** Override the per-task preferred provider id. */
  preferredProviderId?: string;
  /** Subject the proof event attaches to. Generated when omitted. */
  subjectId?: Uuid;
  /** Actor recorded on the proof event. */
  actorRef?: string;
  now?: () => Date;
  newId?: () => string;
}

/** The seam's result. Carries routing facts, hashes, proof, and attestation. */
export interface GtmBrainTaskResult {
  task: GtmBrainTask;
  /** True only when the mock provider actually produced a response. */
  executed: boolean;
  /** True when the router blocked the task (e.g. approval missing). */
  blocked: boolean;
  policyDecision: BrainPolicyDecision;
  /** Provider that served the task, or `none` when routing halted at a gate. */
  provider: string;
  model: string;
  fallbackUsed: boolean;
  /** Id of the append-only GTM proof event for this task. */
  proofRef: Uuid;
  /** The append-only proof event itself. Carries hashes + routing facts only. */
  proof: GtmProofEvent;
  /** sha256 of the (system + prompt) input — never the raw prompt. */
  promptHash: string;
  /** sha256 of the output, or null when nothing executed. */
  outputHash: string | null;
  /** Runtime attestation that no live send/egress occurred. */
  attestation: NoEgressAttestation;
}

/**
 * Resolve a preferred {@link ModelRef} for a provider id from the registry
 * (descriptor read only — never calls `generate`). Returns undefined when the
 * provider is not registered, so the router falls straight to the mock.
 */
function preferredModelFor(registry: ModelRegistry, providerId: string): ModelRef | undefined {
  const descriptor = registry.list().find((d) => d.providerId === providerId);
  return descriptor
    ? { providerId: descriptor.providerId, modelId: descriptor.modelId }
    : undefined;
}

/**
 * Run a GTM task through the Brain. Delegates routing, the workspace policy, and
 * the high-risk approval gate to the #206 `runTask`; builds an append-only proof
 * event (hashes only) from the resulting receipt. The mock provider is the only
 * one that can execute.
 */
export async function runGtmBrainTask(input: GtmBrainTaskInput): Promise<GtmBrainTaskResult> {
  const registry = input.registry ?? createDefaultModelRegistry();
  const now = input.now ?? (() => new Date());
  const newId = input.newId ?? (() => randomUUID());
  const preferredProviderId = input.preferredProviderId ?? TASK_PREFERRED_PROVIDER[input.task];
  const preferredModel = preferredModelFor(registry, preferredProviderId);

  const result = await runTask({
    workspaceId: input.workspaceId ?? SANDBOX_WORKSPACE,
    taskType: input.task,
    prompt: input.promptText,
    system: input.system,
    structured: input.task === 'outreach.draft',
    policy: input.policy ?? defaultLocalOnlyPolicy(),
    preferredModel,
    fallbackChain: [MOCK_REF],
    approvalGranted: input.approval,
    registry,
    now,
  });

  const spec = new TaskRegistry().get(input.task);
  const policyDecision: BrainPolicyDecision = {
    riskLevel: spec?.riskTier === 'high' ? 'high' : 'low',
    requiresApproval: spec?.riskTier === 'high',
    blocked: !result.ok,
    reason: result.blockedReason ?? 'allowed',
  };

  const executed = result.ok;
  const provider = result.selected?.providerId ?? result.receipt.provider;
  const model = result.selected?.modelId ?? result.receipt.model;
  const fallbackUsed = result.fallbackUsed;
  const promptHash = result.receipt.inputHash;
  const outputHash = result.receipt.outputHash;

  const subjectId: Uuid = input.subjectId ?? (newId() as Uuid);
  const actorRef = input.actorRef ?? 'agent:gtm-brain-adapter';
  const kind = executed ? TASK_PROOF_KIND_EXECUTED[input.task] : blockedProofKind(input.task);
  const evidenceTag: GtmEvidenceTag = 'likely_inference';

  const proof = createGtmProofEvent(
    {
      kind,
      subjectType: 'gtm_brain_task',
      subjectId,
      evidenceTag,
      summaryPublic: `${input.task} ${executed ? 'executed' : 'blocked'} via ${provider}:${model}`,
      detailsPrivate: {
        task: input.task,
        provider,
        model,
        fallbackUsed,
        riskLevel: policyDecision.riskLevel,
        requiresApproval: policyDecision.requiresApproval,
        blocked: policyDecision.blocked,
        blockedReason: result.blockedReason ?? null,
        executed,
        promptHash,
        outputHash,
      },
      actorRef,
    },
    { id: newId() as Uuid, occurredAt: now() },
  );

  const attestation = assertNoLiveEgress('mock');
  const taskResult: GtmBrainTaskResult = {
    task: input.task,
    executed,
    blocked: !result.ok,
    policyDecision,
    provider,
    model,
    fallbackUsed,
    proofRef: proof.id,
    proof,
    promptHash,
    outputHash,
    attestation,
  };
  // Belt-and-braces: the result must never serialize a raw email address.
  assertNoRawPii(taskResult, 'gtmBrainAdapter result');
  return taskResult;
}

/** `outreach.draft` blocks into a review-required proof; others into routing review. */
function blockedProofKind(task: GtmBrainTask): GtmProofKind {
  return task === 'outreach.draft' ? 'gtm.outreach.review_required.v1' : 'gtm.source.reviewed.v1';
}
