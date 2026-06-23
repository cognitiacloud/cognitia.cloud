/**
 * Brain ⇆ GTM integration seam.
 *
 * Proves that existing GTM agents can call the Brain to perform GTM tasks
 * WITHOUT hardcoding a model. The caller names a *task* (`prospect.research`,
 * `gtm.routing`, `outreach.draft`); this adapter resolves a provider + model
 * from the Brain Core {@link ModelRegistry} (PR #202) and runs it through the
 * existing GTM policy gate, proof ledger, and mock-safety guards.
 *
 * This module is a thin ADAPTER over the Brain Core contracts — it introduces
 * NO new provider/router contract. Routing is the registry's job; policy is the
 * `PolicyGate`'s job; proof + PII safety reuse the gtm-os assembly guards.
 *
 * Safety invariants (mock-safe V1):
 *   - mock provider only — every real provider is disabled and never executes;
 *   - `outreach.draft` is high-risk and requires human approval. Without
 *     approval it BLOCKS and `provider.generate` is never called;
 *   - no raw prompt/output/PII is stored — ledgers carry sha256 hashes only;
 *   - no live egress — every result carries a no-live-send attestation.
 *
 * The file lives under `brain/`, so the colocated `brainSourceScan.test.ts`
 * enforces that it imports no network primitive and no vendor SDK.
 */

import {
  classifyRisk,
  contentFingerprint,
  createGtmProofEvent,
  decideApproval,
  type ActionType,
  type GtmEvidenceTag,
  type GtmProofEvent,
  type GtmProofKind,
  type RiskLevel,
  type Uuid,
} from '@cognitia/core';
import { randomUUID } from 'node:crypto';
import {
  assertNoLiveEgress,
  assertNoRawPii,
  type NoEgressAttestation,
} from '../gtm-os/assembly/guards.js';
import { createDefaultBrainRegistry, type ModelRegistry } from './modelRegistry.js';

/** The GTM tasks this seam can route to the Brain. */
export type GtmBrainTask = 'prospect.research' | 'gtm.routing' | 'outreach.draft';

/** Map each GTM brain task to the action type whose risk policy governs it. */
const TASK_ACTION_TYPE: Record<GtmBrainTask, ActionType> = {
  'prospect.research': 'crm.note.create', // low risk
  'gtm.routing': 'crm.task.create', // low risk
  'outreach.draft': 'email.draft.send', // high risk → human approval required
};

/**
 * Preferred provider per task. `outreach.draft` prefers a stronger model that
 * is DISABLED in V1, so resolution gracefully falls back to the only enabled
 * provider (mock) and records `fallbackUsed: true`. This demonstrates
 * model-agnostic routing: the GTM caller never names a model.
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

/** The policy facts an operator sees before a task runs. */
export interface BrainPolicyDecision {
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  blocked: boolean;
  reason: string;
}

/**
 * Which provider/model the registry resolved for a task. `model` is read from
 * the provider's descriptor — never passed in by the GTM caller.
 */
export interface BrainRoute {
  provider: string;
  model: string;
  /** True when the preferred provider was unavailable and a fallback was used. */
  fallbackUsed: boolean;
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
  /** Registry to route through. Defaults to the Brain Core default registry. */
  registry?: ModelRegistry;
  /** Override the per-task preferred provider id. */
  preferredProviderId?: string;
  /** Subject the proof event attaches to. Generated when omitted. */
  subjectId?: Uuid;
  /** Actor recorded on the proof event. */
  actorRef?: string;
  now?: () => Date;
  newId?: () => string;
}

/**
 * The seam's result. Always carries the four fields the lane requires —
 * `proofRef`, `policyDecision`, `provider`, `model`, `fallbackUsed` — plus the
 * hashes and the no-egress attestation.
 */
export interface GtmBrainTaskResult {
  task: GtmBrainTask;
  /** True only when the mock provider actually produced a response. */
  executed: boolean;
  /** True when policy blocked the task (suppressed, or approval missing). */
  blocked: boolean;
  policyDecision: BrainPolicyDecision;
  provider: string;
  model: string;
  fallbackUsed: boolean;
  /** Id of the append-only GTM proof event for this task. */
  proofRef: Uuid;
  /** The append-only proof event itself. Carries hashes + routing facts only. */
  proof: GtmProofEvent;
  /** sha256 of the prompt — never the raw prompt. */
  promptHash: string;
  /** sha256 of the output, or null when nothing executed. */
  outputHash: string | null;
  /** Runtime attestation that no live send/egress occurred. */
  attestation: NoEgressAttestation;
}

/**
 * Resolve a provider + model from the registry without the caller naming a
 * model. Tries the preferred provider; if it is unknown or disabled, falls back
 * to the first enabled provider and flags it. Pure: reads descriptors only and
 * never calls `generate`.
 */
export function resolveBrainRoute(
  registry: ModelRegistry,
  preferredProviderId: string,
): BrainRoute {
  const preferred = registry.get(preferredProviderId);
  if (preferred && preferred.isEnabled()) {
    return {
      provider: preferred.descriptor.id,
      model: firstModelId(preferred.descriptor.id, preferred.descriptor.models[0]?.id),
      fallbackUsed: false,
    };
  }
  const fallback = registry.listEnabled()[0];
  if (!fallback) {
    throw new Error('no enabled brain provider available to route to');
  }
  return {
    provider: fallback.descriptor.id,
    model: firstModelId(fallback.descriptor.id, fallback.descriptor.models[0]?.id),
    fallbackUsed: true,
  };
}

function firstModelId(providerId: string, modelId: string | undefined): string {
  if (!modelId) throw new Error(`brain provider "${providerId}" exposes no model`);
  return modelId;
}

/** Evaluate the GTM risk/approval policy for a task. */
export function decideBrainPolicy(task: GtmBrainTask): BrainPolicyDecision {
  const actionType = TASK_ACTION_TYPE[task];
  const riskLevel = classifyRisk(actionType);
  // Suppression is not modeled at the brain seam; the caller's GTM pipeline
  // enforces it upstream. Approval is the gate this seam owns.
  const decision = decideApproval({ actionType, riskLevel, isSuppressed: false });
  return {
    riskLevel,
    requiresApproval: decision.requiresApproval,
    blocked: decision.blocked,
    reason: decision.reason,
  };
}

/**
 * Run a GTM task through the Brain. Resolves a model-agnostic route, applies the
 * approval gate (high-risk `outreach.draft` blocks without approval and never
 * calls the provider), executes the mock provider when allowed, and records an
 * append-only proof event carrying hashes only.
 */
export async function runGtmBrainTask(input: GtmBrainTaskInput): Promise<GtmBrainTaskResult> {
  const registry = input.registry ?? createDefaultBrainRegistry();
  const now = input.now ?? (() => new Date());
  const newId = input.newId ?? (() => randomUUID());
  const preferredProviderId = input.preferredProviderId ?? TASK_PREFERRED_PROVIDER[input.task];

  const route = resolveBrainRoute(registry, preferredProviderId);
  const policyDecision = decideBrainPolicy(input.task);
  const promptHash = contentFingerprint(input.promptText);

  // The approval gate: a blocked policy, or a task that needs approval and did
  // not get it, halts BEFORE any provider call. Nothing executes.
  const gated = policyDecision.blocked || (policyDecision.requiresApproval && !input.approval);

  const subjectId: Uuid = input.subjectId ?? newId();
  const actorRef = input.actorRef ?? 'agent:gtm-brain-adapter';

  if (gated) {
    const proof = emitProof({
      kind: blockedProofKind(input.task),
      subjectId,
      actorRef,
      task: input.task,
      route,
      policyDecision,
      promptHash,
      outputHash: null,
      executed: false,
      now,
      newId,
    });
    return finalize({
      task: input.task,
      executed: false,
      blocked: true,
      policyDecision,
      route,
      proof,
      promptHash,
      outputHash: null,
    });
  }

  // Allowed: resolve the enabled provider and execute the mock. `getEnabled`
  // throws `ProviderDisabledError` for a disabled provider, so a real model can
  // never run here.
  const provider = registry.getEnabled(route.provider);
  const response = await provider.generate({
    model: route.model,
    prompt: input.promptText,
    ...(input.system ? { system: input.system } : {}),
    metadata: { task: input.task },
  });
  const outputHash = contentFingerprint(response.content);

  const proof = emitProof({
    kind: TASK_PROOF_KIND_EXECUTED[input.task],
    subjectId,
    actorRef,
    task: input.task,
    route,
    policyDecision,
    promptHash,
    outputHash,
    executed: true,
    now,
    newId,
  });

  return finalize({
    task: input.task,
    executed: true,
    blocked: false,
    policyDecision,
    route,
    proof,
    promptHash,
    outputHash,
  });
}

/** `outreach.draft` blocks into a review-required proof; others into routing review. */
function blockedProofKind(task: GtmBrainTask): GtmProofKind {
  return task === 'outreach.draft' ? 'gtm.outreach.review_required.v1' : 'gtm.source.reviewed.v1';
}

interface ProofArgs {
  kind: GtmProofKind;
  subjectId: Uuid;
  actorRef: string;
  task: GtmBrainTask;
  route: BrainRoute;
  policyDecision: BrainPolicyDecision;
  promptHash: string;
  outputHash: string | null;
  executed: boolean;
  now: () => Date;
  newId: () => string;
}

/** Build the proof event. `detailsPrivate` carries hashes + routing facts only. */
function emitProof(args: ProofArgs): GtmProofEvent {
  const evidenceTag: GtmEvidenceTag = 'likely_inference';
  return createGtmProofEvent(
    {
      kind: args.kind,
      subjectType: 'gtm_brain_task',
      subjectId: args.subjectId,
      evidenceTag,
      summaryPublic: `${args.task} ${args.executed ? 'executed' : 'blocked'} via ${args.route.provider}:${args.route.model}`,
      detailsPrivate: {
        task: args.task,
        provider: args.route.provider,
        model: args.route.model,
        fallbackUsed: args.route.fallbackUsed,
        riskLevel: args.policyDecision.riskLevel,
        requiresApproval: args.policyDecision.requiresApproval,
        blocked: args.policyDecision.blocked,
        executed: args.executed,
        promptHash: args.promptHash,
        outputHash: args.outputHash,
      },
      actorRef: args.actorRef,
    },
    { id: args.newId() as Uuid, occurredAt: args.now() },
  );
}

interface FinalizeArgs {
  task: GtmBrainTask;
  executed: boolean;
  blocked: boolean;
  policyDecision: BrainPolicyDecision;
  route: BrainRoute;
  proof: GtmProofEvent;
  promptHash: string;
  outputHash: string | null;
}

/** Assemble the result and assert the mock-safety invariants before returning. */
function finalize(args: FinalizeArgs): GtmBrainTaskResult {
  const attestation = assertNoLiveEgress('mock');
  const result: GtmBrainTaskResult = {
    task: args.task,
    executed: args.executed,
    blocked: args.blocked,
    policyDecision: args.policyDecision,
    provider: args.route.provider,
    model: args.route.model,
    fallbackUsed: args.route.fallbackUsed,
    proofRef: args.proof.id,
    proof: args.proof,
    promptHash: args.promptHash,
    outputHash: args.outputHash,
    attestation,
  };
  // Belt-and-braces: the result must never serialize a raw email address.
  assertNoRawPii(result, 'gtmBrainAdapter result');
  return result;
}
