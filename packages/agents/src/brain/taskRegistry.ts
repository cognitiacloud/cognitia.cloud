/**
 * Cognitia Brain Harness V1 — task registry.
 *
 * STATUS: MOCK / SANDBOX. Pure, deterministic. Maps a logical `taskType` to the
 * model capabilities it requires, its risk tier (high-risk tasks need explicit
 * approval), and a default data classification. The router uses this for
 * capability matching and high-risk gating.
 */
import type { DataClassification, ModelCapability } from './modelProvider.js';

export type RiskTier = 'low' | 'high';

export interface TaskSpec {
  taskType: string;
  /** Capabilities a model MUST advertise to serve this task. */
  requiredCapabilities: readonly ModelCapability[];
  riskTier: RiskTier;
  /** Default sensitivity of this task's inputs (overridable per-call). */
  dataClassification: DataClassification;
}

/**
 * Built-in task specs. Intentionally small and illustrative; a workspace can
 * supply its own registry. `prospect.research` is the canonical V1 example.
 */
export const DEFAULT_TASK_SPECS: readonly TaskSpec[] = [
  {
    taskType: 'prospect.research',
    requiredCapabilities: ['text', 'reasoning'],
    riskTier: 'low',
    dataClassification: 'internal',
  },
  {
    taskType: 'prospect.summarize',
    requiredCapabilities: ['text'],
    riskTier: 'low',
    dataClassification: 'internal',
  },
  {
    taskType: 'outreach.draft',
    requiredCapabilities: ['text', 'structured_output'],
    riskTier: 'high',
    dataClassification: 'confidential',
  },
  {
    taskType: 'crm.field_extract',
    requiredCapabilities: ['text', 'structured_output'],
    riskTier: 'low',
    dataClassification: 'confidential',
  },
];

/** A read-only, deterministic registry of task specs. */
export class TaskRegistry {
  private readonly specs = new Map<string, TaskSpec>();

  constructor(specs: readonly TaskSpec[] = DEFAULT_TASK_SPECS) {
    for (const spec of specs) this.specs.set(spec.taskType, spec);
  }

  /**
   * Returns the registered spec, or `undefined` if the task is unknown.
   *
   * There is intentionally NO permissive `getOrDefault`: unknown task types must
   * fail closed (the router blocks them) rather than silently degrade to a
   * low-risk/internal default.
   */
  get(taskType: string): TaskSpec | undefined {
    return this.specs.get(taskType);
  }

  list(): readonly TaskSpec[] {
    return [...this.specs.values()];
  }
}
