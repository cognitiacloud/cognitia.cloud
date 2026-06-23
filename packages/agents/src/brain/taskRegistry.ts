/**
 * Brain task registry + mock model catalog.
 *
 * This is the static "what tasks exist and what (mock) models could serve them"
 * half of the Brain Policy Router. It is pure data + tiny pure helpers: NO
 * network, NO vendor SDKs, NO real model calls. The catalog entries are mock
 * descriptors used only for routing decisions; execution itself is mocked in
 * `brainRouter.ts`.
 */

/** The tasks the brain knows how to route. Anything else fails closed. */
export type BrainTaskId =
  | 'prospect.research'
  | 'gtm.routing'
  | 'closer.summarize'
  | 'pii.redact'
  | 'outreach.draft';

/** Capability tags a model declares and a task requires. */
export type Capability =
  | 'reasoning'
  | 'research'
  | 'routing'
  | 'summarization'
  | 'redaction'
  | 'drafting';

/**
 * Data sensitivity tiers, ordered least → most sensitive. A task carries the
 * sensitivity of the data it handles; a model carries the most sensitive tier
 * it is permitted to handle; the workspace policy carries a ceiling for what
 * may leave to *external* providers.
 */
export type PrivacyTier = 'public' | 'internal' | 'confidential' | 'restricted';

/** Latency expectations, ordered fastest → slowest acceptable. */
export type LatencyTier = 'realtime' | 'standard' | 'batch';

/** Providers a (mock) model can belong to. No real provider is ever called. */
export type Provider = 'openai' | 'anthropic' | 'local' | 'mock';

const PRIVACY_ORDER: readonly PrivacyTier[] = [
  'public',
  'internal',
  'confidential',
  'restricted',
] as const;

const LATENCY_ORDER: readonly LatencyTier[] = ['realtime', 'standard', 'batch'] as const;

/** Numeric rank for a privacy tier (higher = more sensitive). */
export function privacyRank(tier: PrivacyTier): number {
  return PRIVACY_ORDER.indexOf(tier);
}

/** Numeric rank for a latency tier (higher = slower/looser). */
export function latencyRank(tier: LatencyTier): number {
  return LATENCY_ORDER.indexOf(tier);
}

/** A registered task and the constraints routing must honour for it. */
export interface BrainTask {
  id: BrainTaskId;
  /** All of these must be present on a candidate model. */
  requiredCapabilities: Capability[];
  /** Sensitivity of the data this task handles. */
  dataTier: PrivacyTier;
  /** Latency the task expects. */
  latencyTier: LatencyTier;
  /** High-risk tasks can require human approval before any (mock) execution. */
  highRisk: boolean;
}

/**
 * The five V1 brain tasks. `pii.redact` is the most sensitive (restricted,
 * needs a redaction-capable model); `outreach.draft` is the high-risk one that
 * can be gated behind human approval.
 */
export const TASK_REGISTRY: Record<BrainTaskId, BrainTask> = {
  'prospect.research': {
    id: 'prospect.research',
    requiredCapabilities: ['research', 'reasoning'],
    dataTier: 'internal',
    latencyTier: 'batch',
    highRisk: false,
  },
  'gtm.routing': {
    id: 'gtm.routing',
    requiredCapabilities: ['routing'],
    dataTier: 'internal',
    latencyTier: 'realtime',
    highRisk: false,
  },
  'closer.summarize': {
    id: 'closer.summarize',
    requiredCapabilities: ['summarization'],
    dataTier: 'confidential',
    latencyTier: 'standard',
    highRisk: false,
  },
  'pii.redact': {
    id: 'pii.redact',
    requiredCapabilities: ['redaction'],
    dataTier: 'restricted',
    latencyTier: 'standard',
    highRisk: false,
  },
  'outreach.draft': {
    id: 'outreach.draft',
    requiredCapabilities: ['drafting', 'reasoning'],
    dataTier: 'confidential',
    latencyTier: 'standard',
    highRisk: true,
  },
};

/** A mock model the router may select. Carries only routing metadata. */
export interface ModelDescriptor {
  id: string;
  provider: Provider;
  capabilities: Capability[];
  /** Flat per-call cost used by the cost-ceiling policy check. */
  costPerCallUsd: number;
  latencyTier: LatencyTier;
  /** Most sensitive data tier this model is permitted to handle. */
  maxDataTier: PrivacyTier;
  /** Where the model runs. `local` data never leaves the workspace boundary. */
  residency: 'local' | 'external';
  /** Mock health flag. `false` simulates an unavailable model for fallback. */
  available?: boolean;
}

/**
 * Default mock catalog. A deliberately small spread: capable external models
 * for general tasks, plus a local model that can handle restricted data and
 * redaction. Tests usually pass a crafted catalog instead of this one.
 */
export const MODEL_CATALOG: ModelDescriptor[] = [
  {
    id: 'mock-openai-reasoner',
    provider: 'openai',
    capabilities: ['reasoning', 'research', 'routing', 'summarization', 'drafting'],
    costPerCallUsd: 0.03,
    latencyTier: 'standard',
    maxDataTier: 'confidential',
    residency: 'external',
    available: true,
  },
  {
    id: 'mock-anthropic-reasoner',
    provider: 'anthropic',
    capabilities: ['reasoning', 'research', 'routing', 'summarization', 'drafting'],
    costPerCallUsd: 0.025,
    latencyTier: 'standard',
    maxDataTier: 'confidential',
    residency: 'external',
    available: true,
  },
  {
    id: 'mock-local-redactor',
    provider: 'local',
    capabilities: ['redaction', 'routing', 'summarization'],
    costPerCallUsd: 0,
    latencyTier: 'realtime',
    maxDataTier: 'restricted',
    residency: 'local',
    available: true,
  },
];

/** Look up a task by id; returns undefined for unknown ids (caller fails closed). */
export function getTask(id: string): BrainTask | undefined {
  return Object.prototype.hasOwnProperty.call(TASK_REGISTRY, id)
    ? TASK_REGISTRY[id as BrainTaskId]
    : undefined;
}

/** True when a model declares every capability a task requires. */
export function hasAllCapabilities(model: ModelDescriptor, required: Capability[]): boolean {
  return required.every((cap) => model.capabilities.includes(cap));
}
