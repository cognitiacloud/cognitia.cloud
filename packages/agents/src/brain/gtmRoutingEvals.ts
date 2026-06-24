/**
 * Brain Eval Harness — deterministic `gtm-routing-v1` suite over the #206 router.
 *
 * STATUS: MOCK / SANDBOX. This suite pins the governed model-routing decisions of
 * the canonical {@link ModelRouter} (PR #206) so routing regressions are caught
 * in CI. It introduces NO parallel decision engine: every scenario is an
 * {@link EvalCase} executed through the real `brainApi.runTask` / `ModelRouter`
 * and scored by {@link evalModelRouterSuite}. (This replaces the earlier #203
 * `routeBrainRequest` engine, which duplicated routing logic the #206 router
 * already owns.)
 *
 * MOCK-SAFE INVARIANTS (V1):
 *   - NO REAL MODEL/API CALLS. The only executable provider is the deterministic
 *     mock. Some scenarios register an *extra mock variant* (with a tuned
 *     descriptor) to exercise a policy gate or the V1 mock-only invariant — these
 *     are still in-process mocks; there is no live path.
 *   - NO NETWORK / VENDOR SDKs / SECRETS. This module imports only sibling brain
 *     modules; the colocated `brainSourceScan.test.ts` enforces it.
 *   - NO RAW PII / NO RAW PROMPTS. The router records hashes only; the assembled
 *     report is asserted PII-free before it is returned.
 *
 * Note on suppression: contact suppression / opt-out is a GTM PolicyGate concern
 * (handled by the Brain⇆GTM seam), NOT a model-routing decision — so the legacy
 * #203 "policy-block (suppressed)" scenario is re-expressed here as a model-level
 * `provider_not_allowed` policy block, which is what the model router actually
 * governs.
 */
import { evalModelRouterSuite, type EvalCase, type EvalReport } from './brainApi.js';
import { defaultLocalOnlyPolicy } from './modelPolicy.js';
import { MOCK_MODEL_DESCRIPTOR, createMockProvider } from './providers/mockProvider.js';
import { createDefaultModelRegistry, ModelRegistry } from './modelRegistry.js';
import type { ModelDescriptor } from './modelProvider.js';

/** Identifier for the routing eval suite shipped by this module. */
export const GTM_ROUTING_SUITE = 'gtm-routing-v1';

/** Canonical mock model reference (the only executable model in V1). */
const MOCK_REF = { providerId: 'mock', modelId: 'mock-deterministic-1' } as const;

/** PII-free prompt: business context only, no contact identifiers. */
const SAFE_PROMPT = 'Draft a follow-up note for the Budget Wheels demo dealership pipeline review.';

/**
 * Build a registry that augments the default (mock enabled + disabled
 * descriptors) with one extra EXECUTABLE mock whose descriptor is tuned to a
 * specific gate. Still mock-safe: `createMockProvider` is the deterministic
 * in-process mock regardless of the descriptor's labels.
 */
function registryWithVariant(overrides: Partial<ModelDescriptor>): ModelRegistry {
  return createDefaultModelRegistry().register(
    createMockProvider({ ...MOCK_MODEL_DESCRIPTOR, ...overrides }),
  );
}

/** A `mock`-provider variant that runs "external" — to exercise the local-only gate. */
const REMOTE_VARIANT: Partial<ModelDescriptor> = {
  modelId: 'mock-remote',
  location: 'external',
  privacyTier: 'public',
};

/** A `mock`-provider variant priced above a zero cost ceiling. */
const PRICEY_VARIANT: Partial<ModelDescriptor> = {
  modelId: 'mock-pricey',
  costPer1kTokensUsd: 5,
};

/** An ENABLED non-mock executable variant — to prove the V1 mock-only invariant. */
const NON_MOCK_VARIANT: Partial<ModelDescriptor> = {
  providerId: 'rogue',
  modelId: 'rogue-1',
};

/**
 * The canonical `gtm-routing-v1` scenarios, each pinning exactly one routing
 * outcome of the #206 router. Ported from #203 and extended with two
 * #206-specific invariants (`unknown_task_type`, `v1_mock_only`).
 */
export const GTM_ROUTING_V1_CASES: readonly EvalCase[] = [
  {
    name: 'routing-to-mock',
    workspaceId: 'budget_wheels_demo',
    taskType: 'prospect.research',
    prompt: SAFE_PROMPT,
    policy: defaultLocalOnlyPolicy(),
    preferredModel: MOCK_REF,
    expect: { ok: true },
  },
  {
    name: 'fallback-to-mock',
    workspaceId: 'budget_wheels_demo',
    taskType: 'prospect.research',
    prompt: SAFE_PROMPT,
    // Prefer a disabled external provider; the router walks past it (provider_disabled)
    // and serves the mock from the fallback chain → fallbackUsed === true.
    policy: defaultLocalOnlyPolicy(),
    preferredModel: { providerId: 'openai', modelId: 'gpt-mini' },
    fallbackChain: [MOCK_REF],
    expect: { ok: true },
  },
  {
    name: 'provider-not-allowed-block',
    workspaceId: 'budget_wheels_demo',
    taskType: 'prospect.research',
    prompt: SAFE_PROMPT,
    // Allow-list excludes mock → model-level policy block (suppression is a GTM
    // PolicyGate concern handled by the Brain⇆GTM seam, not the model router).
    policy: { ...defaultLocalOnlyPolicy(), allowedProviders: ['openai'] },
    preferredModel: MOCK_REF,
    expect: { ok: false, blockedReason: 'provider_not_allowed' },
  },
  {
    name: 'high-risk-approval-required',
    workspaceId: 'budget_wheels_demo',
    taskType: 'outreach.draft',
    prompt: SAFE_PROMPT,
    structured: true,
    policy: { ...defaultLocalOnlyPolicy(), allowedDataClassifications: ['confidential'] },
    preferredModel: MOCK_REF,
    expect: { ok: false, blockedReason: 'high_risk_requires_approval' },
  },
  {
    name: 'local-only-block',
    workspaceId: 'budget_wheels_demo',
    taskType: 'prospect.research',
    prompt: SAFE_PROMPT,
    policy: defaultLocalOnlyPolicy(),
    registry: registryWithVariant(REMOTE_VARIANT),
    preferredModel: { providerId: 'mock', modelId: 'mock-remote' },
    expect: { ok: false, blockedReason: 'local_only_policy' },
  },
  {
    name: 'cost-ceiling-block',
    workspaceId: 'budget_wheels_demo',
    taskType: 'prospect.research',
    prompt: SAFE_PROMPT,
    policy: defaultLocalOnlyPolicy(), // costCeilingPer1kUsd: 0
    registry: registryWithVariant(PRICEY_VARIANT),
    preferredModel: { providerId: 'mock', modelId: 'mock-pricey' },
    expect: { ok: false, blockedReason: 'cost_ceiling_exceeded' },
  },
  {
    name: 'disabled-provider-block',
    workspaceId: 'budget_wheels_demo',
    taskType: 'prospect.research',
    prompt: SAFE_PROMPT,
    policy: { ...defaultLocalOnlyPolicy(), allowedProviders: ['mock', 'openai'] },
    preferredModel: { providerId: 'openai', modelId: 'gpt-mini' },
    expect: { ok: false, blockedReason: 'provider_disabled' },
  },
  {
    name: 'unknown-task-fail-closed',
    workspaceId: 'budget_wheels_demo',
    taskType: 'totally.unregistered.task',
    prompt: SAFE_PROMPT,
    policy: defaultLocalOnlyPolicy(),
    preferredModel: MOCK_REF,
    expect: { ok: false, blockedReason: 'unknown_task_type' },
  },
  {
    name: 'v1-mock-only-invariant',
    workspaceId: 'budget_wheels_demo',
    taskType: 'prospect.research',
    prompt: SAFE_PROMPT,
    // An ENABLED non-mock provider that policy would allow is still blocked by
    // the V1 mock-only runtime invariant — it can never execute.
    policy: { ...defaultLocalOnlyPolicy(), allowedProviders: ['rogue'] },
    registry: registryWithVariant(NON_MOCK_VARIANT),
    preferredModel: { providerId: 'rogue', modelId: 'rogue-1' },
    expect: { ok: false, blockedReason: 'v1_mock_only' },
  },
];

const RAW_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// Phone shapes with separators (avoids matching bare hashes/cost numbers).
const RAW_PHONE = /(?:\+?\d[\s.-]?){2,}\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/;

/**
 * Belt-and-braces: throw if a serialized eval report carries raw PII. The router
 * only ever emits hashes + enums + reasons, so this is a regression tripwire, not
 * the primary defense.
 */
export function assertNoRawPiiInEvalReport(report: EvalReport): void {
  const serialized = JSON.stringify(report) ?? '';
  if (RAW_EMAIL.test(serialized)) {
    throw new Error('brain eval: raw email PII detected in suite output');
  }
  if (RAW_PHONE.test(serialized)) {
    throw new Error('brain eval: raw phone PII detected in suite output');
  }
}

/**
 * Run the deterministic `gtm-routing-v1` suite against the #206 router. Returns
 * the scored {@link EvalReport}, asserted PII-free before it is handed back.
 */
export async function runGtmRoutingV1Suite(
  cases: readonly EvalCase[] = GTM_ROUTING_V1_CASES,
): Promise<EvalReport> {
  const report = await evalModelRouterSuite(cases, GTM_ROUTING_SUITE);
  assertNoRawPiiInEvalReport(report);
  return report;
}
