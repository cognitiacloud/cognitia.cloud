/**
 * Cognitia Brain Harness — Task Registry.
 *
 * The task registry is the catalogue of *what* the brain can be asked to do and
 * the *requirements* each task places on a model: which capabilities it needs,
 * how sensitive its data is (privacy level), how fast it must answer (latency
 * tier), how risky it is, and whether a human must approve before it runs.
 *
 * It is the model-agnostic half of routing: a task says "I need reasoning +
 * web_research, confidential data, standard latency" and the router/policy
 * (see brainPolicy.ts) decides which provider/model may serve it. This module
 * has NO provider knowledge and NO IO — it is pure data + lookups, so it stays
 * portable and deterministic.
 */

/** Capabilities a model can offer; a task requires a subset of these. */
export type TaskCapability =
  | 'reasoning'
  | 'long_context'
  | 'code'
  | 'json_mode'
  | 'classification'
  | 'summarization'
  | 'web_research'
  | 'extraction';

/** Data-sensitivity classification. Ordered least → most sensitive below. */
export type BrainPrivacyLevel = 'public' | 'internal' | 'confidential' | 'restricted';

/** How quickly a task must be served. Ordered most → least demanding below. */
export type BrainLatencyTier = 'realtime' | 'standard' | 'batch';

/** Coarse task risk; high-risk tasks default to requiring human approval. */
export type BrainRiskLevel = 'low' | 'medium' | 'high';

/** Stable string id for a registered task (e.g. `prospect.research`). */
export type BrainTaskType = string;

/** A task definition: model-agnostic requirements the router enforces. */
export interface BrainTask {
  /** Stable id, dot-namespaced by domain (e.g. `gtm.routing`). */
  id: BrainTaskType;
  /** One-line human description for CLI / docs. */
  description: string;
  /** Model must offer *every* capability listed here (superset match). */
  requiredCapabilities: TaskCapability[];
  /** Default sensitivity of this task's data. */
  defaultPrivacy: BrainPrivacyLevel;
  /** Default latency expectation. */
  defaultLatencyTier: BrainLatencyTier;
  /** Coarse risk level. */
  riskLevel: BrainRiskLevel;
  /** When true, a human approval is required before the task may execute. */
  requiresHumanApproval: boolean;
  /**
   * Per-task hard cost ceiling in USD for a single run. A candidate model whose
   * estimated cost exceeds this is blocked. Mock/local models cost 0, so they
   * always pass.
   */
  costCeilingUsd: number;
}

/**
 * The V1 task catalogue. Deliberately small and GTM-shaped; new tasks are added
 * here, never inferred. Keep ids stable — they are persisted in the run ledger.
 */
export const TASK_REGISTRY: Record<BrainTaskType, BrainTask> = {
  'prospect.research': {
    id: 'prospect.research',
    description: 'Research a prospect/account from public signals and summarise fit.',
    requiredCapabilities: ['web_research', 'reasoning', 'summarization'],
    defaultPrivacy: 'internal',
    defaultLatencyTier: 'standard',
    riskLevel: 'medium',
    requiresHumanApproval: false,
    costCeilingUsd: 0.05,
  },
  'gtm.routing': {
    id: 'gtm.routing',
    description: 'Classify an inbound signal and route it to the right GTM lane.',
    requiredCapabilities: ['classification'],
    defaultPrivacy: 'internal',
    defaultLatencyTier: 'realtime',
    riskLevel: 'low',
    requiresHumanApproval: false,
    costCeilingUsd: 0.01,
  },
  'closer.summarize': {
    id: 'closer.summarize',
    description: 'Summarise a deal/closer thread into an operator-ready brief.',
    requiredCapabilities: ['summarization', 'long_context'],
    defaultPrivacy: 'confidential',
    defaultLatencyTier: 'standard',
    riskLevel: 'low',
    requiresHumanApproval: false,
    costCeilingUsd: 0.03,
  },
  'pii.redact': {
    id: 'pii.redact',
    description: 'Extract and redact PII from free text before storage/egress.',
    requiredCapabilities: ['extraction'],
    // Touches raw PII: only a model that can handle confidential data may serve
    // it, and (see policy) external providers are blocked from restricted data.
    defaultPrivacy: 'confidential',
    defaultLatencyTier: 'standard',
    riskLevel: 'medium',
    requiresHumanApproval: false,
    costCeilingUsd: 0.02,
  },
  'outreach.draft': {
    id: 'outreach.draft',
    description: 'Draft an outbound outreach message (NEVER sent by the brain).',
    requiredCapabilities: ['reasoning', 'summarization'],
    defaultPrivacy: 'confidential',
    defaultLatencyTier: 'standard',
    // Outbound content is the highest-risk task: a human must approve the draft
    // before anything downstream may act on it. The brain never sends.
    riskLevel: 'high',
    requiresHumanApproval: true,
    costCeilingUsd: 0.05,
  },
};

/** Look up a task by id, or `undefined` if it is not registered. */
export function getTask(id: BrainTaskType): BrainTask | undefined {
  return TASK_REGISTRY[id];
}

/** All registered tasks, in stable id order. */
export function listTasks(): BrainTask[] {
  return Object.values(TASK_REGISTRY).sort((a, b) => a.id.localeCompare(b.id));
}

/** Numeric ordering for privacy (higher = more sensitive). */
export const PRIVACY_RANK: Record<BrainPrivacyLevel, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

/** Numeric ordering for latency tiers (higher = more demanding / stricter). */
export const LATENCY_RANK: Record<BrainLatencyTier, number> = {
  batch: 0,
  standard: 1,
  realtime: 2,
};
