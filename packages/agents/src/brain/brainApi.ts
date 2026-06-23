/**
 * Cognitia Brain Harness V1 — programmatic surface for the (documented) CLI.
 *
 * STATUS: MOCK / SANDBOX. The repo has no TypeScript script runner (no tsx /
 * ts-node / vite-node), so the `brain …` CLI is documented in
 * `docs/architecture/cognitia-brain-harness.md` and backed by these pure,
 * testable functions rather than a non-functional shell stub. They wrap the
 * router/registry/ledger and make NO network call.
 *
 * MOCK-ONLY PUBLIC PATH: the default surface uses `createDefaultModelRegistry()`
 * (the deterministic `mock` provider only). Callers MAY inject a custom registry
 * for testing, but this cannot enable real model egress: the router enforces a
 * V1 mock-only runtime invariant, so an injected `enabled` non-mock provider is
 * blocked (`v1_mock_only`) and never executed. Real model egress is a separate,
 * out-of-band concern gated behind the `controlled_live` release gate — see
 * `docs/architecture/cognitia-brain-harness.md` §9.
 *
 *   brain models:list                 → {@link listModels}
 *   brain run --task … --provider …   → {@link runTask}
 *   brain eval --suite model-router   → {@link evalModelRouterSuite}
 *   brain providers:test --provider … → {@link testProvider}
 */
import { defaultLocalOnlyPolicy, type WorkspaceModelPolicy } from './modelPolicy.js';
import type { DataClassification, ModelDescriptor } from './modelProvider.js';
import { createDefaultModelRegistry, ModelRegistry } from './modelRegistry.js';
import { ModelRouter, type ModelRef, type RouterResult } from './modelRouter.js';
import { ModelUsageLedger } from './modelUsageLedger.js';
import { TaskRegistry } from './taskRegistry.js';

/** `brain models:list` — all registered models with their metadata. */
export function listModels(
  registry: ModelRegistry = createDefaultModelRegistry(),
): readonly ModelDescriptor[] {
  return registry.list();
}

export interface RunTaskOptions {
  workspaceId: string;
  taskType: string;
  prompt: string;
  system?: string;
  preferredModel?: ModelRef;
  fallbackChain?: readonly ModelRef[];
  policy?: WorkspaceModelPolicy;
  dataClassification?: DataClassification;
  approvalGranted?: boolean;
  tools?: readonly string[];
  structured?: boolean;
  registry?: ModelRegistry;
  ledger?: ModelUsageLedger;
  now?: () => Date;
}

/**
 * `brain run --task <taskType> --provider <providerId>` — route one task through
 * the governed router. Defaults to the deterministic mock provider under a
 * conservative local-only policy.
 */
export async function runTask(opts: RunTaskOptions): Promise<RouterResult> {
  const registry = opts.registry ?? createDefaultModelRegistry();
  const ledger = opts.ledger ?? new ModelUsageLedger();
  const router = new ModelRouter({ registry, ledger, now: opts.now });
  return router.route({
    workspaceId: opts.workspaceId,
    taskType: opts.taskType,
    request: {
      prompt: opts.prompt,
      system: opts.system,
      taskType: opts.taskType,
      tools: opts.tools,
      structured: opts.structured,
    },
    policy: opts.policy ?? defaultLocalOnlyPolicy(),
    preferredModel: opts.preferredModel ?? { providerId: 'mock', modelId: 'mock-deterministic-1' },
    fallbackChain: opts.fallbackChain,
    dataClassification: opts.dataClassification,
    approvalGranted: opts.approvalGranted,
  });
}

/**
 * `brain providers:test --provider <id>` — confirm a provider's registration
 * state without executing it. Disabled providers report `executable:false`.
 */
export function testProvider(
  providerId: string,
  registry: ModelRegistry = createDefaultModelRegistry(),
): {
  providerId: string;
  registered: boolean;
  executable: boolean;
  models: readonly ModelDescriptor[];
} {
  const models = registry.list().filter((d) => d.providerId === providerId);
  return {
    providerId,
    registered: models.length > 0,
    executable: models.some((d) => d.enabled),
    models,
  };
}

export interface EvalCase {
  name: string;
  workspaceId: string;
  taskType: string;
  prompt: string;
  policy: WorkspaceModelPolicy;
  preferredModel?: ModelRef;
  fallbackChain?: readonly ModelRef[];
  dataClassification?: DataClassification;
  approvalGranted?: boolean;
  tools?: readonly string[];
  structured?: boolean;
  /** Expected routing outcome. */
  expect: { ok: boolean; blockedReason?: string };
}

export interface EvalCaseResult {
  name: string;
  passed: boolean;
  expectedOk: boolean;
  actualOk: boolean;
  blockedReason?: string;
  /** Determinism: identical re-run produced an identical output hash. */
  deterministic: boolean;
}

export interface EvalReport {
  suite: string;
  total: number;
  passed: number;
  score: number;
  cases: readonly EvalCaseResult[];
}

/**
 * `brain eval --suite model-router` — run a set of routing cases against the
 * mock harness and score correctness + determinism. With only the mock provider
 * executable, "comparing outputs" is a determinism proof per case; the shape
 * generalizes to cross-model comparison once real providers are enabled.
 */
export async function evalModelRouterSuite(
  cases: readonly EvalCase[] = DEFAULT_EVAL_CASES,
  suite = 'model-router',
): Promise<EvalReport> {
  const results: EvalCaseResult[] = [];
  const fixedNow = () => new Date('2026-01-01T00:00:00.000Z');

  for (const c of cases) {
    const run = () =>
      runTask({
        workspaceId: c.workspaceId,
        taskType: c.taskType,
        prompt: c.prompt,
        policy: c.policy,
        preferredModel: c.preferredModel,
        fallbackChain: c.fallbackChain,
        dataClassification: c.dataClassification,
        approvalGranted: c.approvalGranted,
        tools: c.tools,
        structured: c.structured,
        now: fixedNow,
      });

    const first = await run();
    const second = await run();
    const deterministic =
      first.receipt.inputHash === second.receipt.inputHash &&
      first.receipt.outputHash === second.receipt.outputHash;

    const okMatches = first.ok === c.expect.ok;
    const reasonMatches =
      c.expect.blockedReason === undefined || first.blockedReason === c.expect.blockedReason;
    const passed = okMatches && reasonMatches && deterministic;

    results.push({
      name: c.name,
      passed,
      expectedOk: c.expect.ok,
      actualOk: first.ok,
      blockedReason: first.blockedReason,
      deterministic,
    });
  }

  const passed = results.filter((r) => r.passed).length;
  return {
    suite,
    total: results.length,
    passed,
    score: results.length === 0 ? 0 : Math.round((passed / results.length) * 100),
    cases: results,
  };
}

const MOCK_REF: ModelRef = { providerId: 'mock', modelId: 'mock-deterministic-1' };

/** A small built-in suite covering the core router behaviors. */
export const DEFAULT_EVAL_CASES: readonly EvalCase[] = [
  {
    name: 'mock serves a low-risk research task',
    workspaceId: 'ws_demo',
    taskType: 'prospect.research',
    prompt: 'summarize the public profile',
    policy: defaultLocalOnlyPolicy(),
    preferredModel: MOCK_REF,
    expect: { ok: true },
  },
  {
    name: 'disallowed external provider is blocked under local-only policy',
    workspaceId: 'ws_demo',
    taskType: 'prospect.research',
    prompt: 'summarize the public profile',
    policy: defaultLocalOnlyPolicy(),
    preferredModel: { providerId: 'openai', modelId: 'gpt-mini' },
    expect: { ok: false },
  },
  {
    name: 'high-risk task without approval is blocked',
    workspaceId: 'ws_demo',
    taskType: 'outreach.draft',
    prompt: 'draft outreach',
    structured: true,
    policy: { ...defaultLocalOnlyPolicy(), allowedDataClassifications: ['confidential'] },
    preferredModel: MOCK_REF,
    expect: { ok: false, blockedReason: 'high_risk_requires_approval' },
  },
];
