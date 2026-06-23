/**
 * Brain Policy Router — the deterministic decision layer that picks which
 * (mock) model handles a task under a workspace policy.
 *
 * Decision order (each step can short-circuit to a structured `blocked` /
 * `requires_approval` decision that NEVER touches a provider):
 *
 *   task → candidate models → capability match → policy eval →
 *   selection + fallback → approval gate → execute mock (or block)
 *
 * Safety invariants:
 *  - V1 is offline: no network/fetch, no vendor SDK imports, no real model
 *    calls. The only import beyond the local registry/policy is the pure
 *    `contentFingerprint` hash from @cognitia/core.
 *  - No raw PII is ever stored: prompts and (mock) outputs appear only as
 *    sha256 hashes in the `execution` record.
 *  - Every non-execute path returns a structured decision with `execution`
 *    undefined.
 */

import { contentFingerprint } from '@cognitia/core';
import {
  getTask,
  hasAllCapabilities,
  MODEL_CATALOG,
  type ModelDescriptor,
  type Provider,
} from './taskRegistry.js';
import {
  evaluateModelAgainstPolicy,
  type ModelEvaluation,
  type PolicyReasonCode,
  type WorkspaceBrainPolicy,
} from './brainPolicy.js';

export type BrainDecisionStatus = 'executed' | 'blocked' | 'requires_approval';

/** Reason codes a routing decision can carry (policy codes plus router codes). */
export type RouterReasonCode =
  | PolicyReasonCode
  | 'unknown_task'
  | 'capability_mismatch'
  | 'no_available_provider'
  | 'approval_required';

/** A compact reference to a selected/considered model. */
export interface ModelRef {
  modelId: string;
  provider: Provider;
}

/** Input to a routing request. Carries no raw PII beyond an optional prompt. */
export interface BrainRouteInput {
  task: string;
  policy: WorkspaceBrainPolicy;
  workspaceId: string;
  /** Human approval state for high-risk tasks. Defaults to 'pending'. */
  approval?: 'approved' | 'rejected' | 'pending';
  /** Optional prompt text. Only its hash is ever retained. */
  promptText?: string;
}

/** A mock execution record. Prompt + output are hashes, never raw text. */
export interface BrainExecutionRecord {
  provider: Provider;
  modelId: string;
  mock: true;
  promptHash: string;
  outputHash: string;
}

/** The structured result of a routing request. */
export interface BrainRouterDecision {
  status: BrainDecisionStatus;
  task: string;
  reasonCode: RouterReasonCode;
  reasons: string[];
  /** The chosen model, when one survived (executed or requires_approval). */
  selectedModel?: ModelRef;
  /** Remaining surviving models, in fallback order. */
  alternatives: ModelRef[];
  /** Per-candidate policy trace (capable models only). */
  evaluations: ModelEvaluation[];
  /** Present ONLY on status === 'executed'. */
  execution?: BrainExecutionRecord;
}

const ref = (m: ModelDescriptor): ModelRef => ({ modelId: m.id, provider: m.provider });

/**
 * Deterministic mock "model call". No network, no provider — just a stable
 * string derived from the task and model so output hashing is reproducible.
 */
function runMock(task: string, modelId: string): string {
  return `mock-output:${task}:${modelId}`;
}

/**
 * Order survivors for selection + fallback: preferredProvider first, then the
 * configured fallbackChain order, then cheaper models, then a stable id tiebreak.
 */
function orderSurvivors(
  survivors: ModelDescriptor[],
  policy: WorkspaceBrainPolicy,
): ModelDescriptor[] {
  const chainIndex = (p: Provider): number => {
    const i = policy.fallbackChain?.indexOf(p) ?? -1;
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...survivors].sort((a, b) => {
    const aPref = policy.preferredProvider === a.provider ? 0 : 1;
    const bPref = policy.preferredProvider === b.provider ? 0 : 1;
    if (aPref !== bPref) return aPref - bPref;
    const aChain = chainIndex(a.provider);
    const bChain = chainIndex(b.provider);
    if (aChain !== bChain) return aChain - bChain;
    if (a.costPerCallUsd !== b.costPerCallUsd) return a.costPerCallUsd - b.costPerCallUsd;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Pick the dominant blocking reason when every capable candidate was denied.
 * Uses a fixed priority so the surfaced reasonCode is deterministic.
 */
const REASON_PRIORITY: PolicyReasonCode[] = [
  'provider_blocked',
  'local_only',
  'privacy_tier_exceeded',
  'cost_ceiling_exceeded',
  'latency_tier_exceeded',
  'ok',
];

function dominantReason(evaluations: ModelEvaluation[]): PolicyReasonCode {
  for (const code of REASON_PRIORITY) {
    if (evaluations.some((e) => !e.allow && e.reasonCode === code)) return code;
  }
  return 'provider_blocked';
}

/**
 * Route a task to a (mock) model under a workspace policy. `catalog` is
 * injectable so callers/tests can supply a deterministic candidate set; it
 * defaults to {@link MODEL_CATALOG}.
 */
export function route(
  input: BrainRouteInput,
  catalog: ModelDescriptor[] = MODEL_CATALOG,
): BrainRouterDecision {
  const taskId = input.task;

  // 1. Task — unknown tasks fail closed.
  const task = getTask(taskId);
  if (!task) {
    return {
      status: 'blocked',
      task: taskId,
      reasonCode: 'unknown_task',
      reasons: [`unknown_task: "${taskId}" is not in the task registry`],
      alternatives: [],
      evaluations: [],
    };
  }

  // 2 + 3. Candidate models → capability match.
  const capable = catalog.filter((m) => hasAllCapabilities(m, task.requiredCapabilities));
  if (capable.length === 0) {
    return {
      status: 'blocked',
      task: taskId,
      reasonCode: 'capability_mismatch',
      reasons: [`capability_mismatch: no model provides [${task.requiredCapabilities.join(', ')}]`],
      alternatives: [],
      evaluations: [],
    };
  }

  // 4. Policy eval — keep only models the policy allows.
  const evaluations = capable.map((m) => evaluateModelAgainstPolicy(m, task, input.policy));
  const survivors = capable.filter((_, i) => evaluations[i]?.allow === true);
  if (survivors.length === 0) {
    const reasonCode = dominantReason(evaluations);
    return {
      status: 'blocked',
      task: taskId,
      reasonCode,
      reasons: evaluations.filter((e) => !e.allow).map((e) => e.reason),
      alternatives: [],
      evaluations,
    };
  }

  // 5. Selection + fallback — choose the first available survivor in order.
  const ordered = orderSurvivors(survivors, input.policy);
  const available = ordered.filter((m) => m.available !== false);
  if (available.length === 0) {
    return {
      status: 'blocked',
      task: taskId,
      reasonCode: 'no_available_provider',
      reasons: ['no_available_provider: every surviving model is unavailable'],
      alternatives: ordered.map(ref),
      evaluations,
    };
  }
  const [selected, ...rest] = available;
  // `available` is non-empty, so `selected` is defined.
  const chosen = selected as ModelDescriptor;
  const alternatives = rest.map(ref);

  // 6. Approval gate — high-risk tasks may require human approval first.
  if (
    task.highRisk &&
    input.policy.requireApprovalForHighRisk &&
    (input.approval ?? 'pending') !== 'approved'
  ) {
    return {
      status: 'requires_approval',
      task: taskId,
      reasonCode: 'approval_required',
      reasons: [
        `approval_required: high-risk task "${taskId}" needs approval (got "${input.approval ?? 'pending'}")`,
      ],
      selectedModel: ref(chosen),
      alternatives,
      evaluations,
    };
  }

  // 7. Execute mock — hash prompt + output, store no raw text.
  const output = runMock(taskId, chosen.id);
  const execution: BrainExecutionRecord = {
    provider: chosen.provider,
    modelId: chosen.id,
    mock: true,
    promptHash: contentFingerprint(input.promptText ?? `task:${taskId}`),
    outputHash: contentFingerprint(output),
  };

  return {
    status: 'executed',
    task: taskId,
    reasonCode: 'ok',
    reasons: [],
    selectedModel: ref(chosen),
    alternatives,
    evaluations,
    execution,
  };
}
