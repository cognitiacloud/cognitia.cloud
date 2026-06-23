/**
 * Brain Eval Harness — deterministic routing evals for the Cognitia "brain".
 *
 * The brain is the model-routing decision layer: given a request, it decides
 * WHICH provider (if any) a generation should be routed to, subject to policy,
 * approval, data-residency, cost, and provider-availability constraints. This
 * module ships a pure, deterministic eval suite (`gtm-routing-v1`) that pins
 * that decision logic so regressions in routing are caught in CI.
 *
 * MOCK-SAFE INVARIANTS (V1):
 *   - NO REAL MODEL/API CALLS. The only provider this harness ever *invokes*
 *     is the in-process deterministic mock ({@link invokeMockProvider}). Any
 *     attempt to invoke a non-mock provider throws — there is no live path.
 *   - NO NETWORK / VENDOR SDKs. This module imports only `@cognitia/core`
 *     (pure helpers/types) and `node:crypto` for hashing. No fetch, no SDKs.
 *   - NO RAW PII / NO RAW PROMPTS IN OUTPUT. Prompts and model outputs are
 *     referenced only by salted-free sha256 hash (ledger-style). The assembled
 *     suite result is asserted PII-free before it is returned.
 *
 * The decision engine ({@link routeBrainRequest}) is pure: same input ⇒ same
 * decision, no IO. The eval runner ({@link runBrainEvalSuite}) compares each
 * scenario's actual decision against a declared expectation and tallies
 * pass/fail.
 */

import {
  classifyRisk,
  contentFingerprint,
  decideApproval,
  type ActionType,
  type RiskLevel,
  type TenantApprovalSettings,
} from '@cognitia/core';

/** Identifier for the routing eval suite shipped by this module. */
export const GTM_ROUTING_SUITE = 'gtm-routing-v1';

/**
 * Where a provider physically runs. `local` providers keep data on-box and
 * satisfy a local-only (data-residency) requirement; `remote` ones do not.
 */
export type ProviderLocality = 'local' | 'remote';

/**
 * A routable model provider, as the brain sees it. This is config/metadata
 * only — the brain never holds credentials and never performs a live call.
 */
export interface BrainProvider {
  /** Stable provider id (e.g. `mock-primary`). */
  id: string;
  /** Disabled providers are never routed to. */
  enabled: boolean;
  /** Data-residency class used by the local-only gate. */
  locality: ProviderLocality;
  /** Estimated cost per call, in cents, used by the cost-ceiling gate. */
  costCents: number;
  /**
   * Whether this provider is the in-process deterministic mock. In V1 ONLY
   * mock providers may be invoked; routing to a non-mock provider is a config
   * error and throws at invoke time.
   */
  isMock: boolean;
}

/** Tenant/brain configuration that constrains routing. */
export interface BrainConfig {
  /**
   * Providers in PREFERENCE ORDER (most-preferred first). The brain routes to
   * the first eligible provider; skipping an earlier, ineligible one counts as
   * a fallback.
   */
  providers: BrainProvider[];
  /** If set, a request whose estimated cost exceeds this (cents) is blocked. */
  costCeilingCents?: number;
  /** If true, only `local` providers are eligible (data residency). */
  localOnly?: boolean;
  /** Tenant approval policy, consumed by the shared policy gate. */
  approvalSettings?: TenantApprovalSettings;
}

/** A request the brain must route. Carries NO raw prompt in any output. */
export interface BrainRoutingRequest {
  /** Sandbox workspace / tenant scope (e.g. `budget_wheels_demo`). */
  workspaceId: string;
  /** The generation prompt. Hashed on the way in; never stored/echoed raw. */
  prompt: string;
  /** Action being requested, used to classify risk + approval. */
  actionType: ActionType;
  /** Explicitly requested provider id; if disabled/unknown, the brain blocks. */
  requestedProvider?: string;
  /** Caller-supplied cost estimate (cents); defaults to the chosen provider's. */
  estimatedCostCents?: number;
  /** True if the target is suppressed/opted-out (hard policy block). */
  isSuppressed?: boolean;
  /** True if a human has already approved this action. */
  approved?: boolean;
}

/** The terminal outcome of a routing decision. */
export type BrainOutcome =
  | 'routed'
  | 'fallback'
  | 'blocked_policy'
  | 'needs_approval'
  | 'blocked_local_only'
  | 'blocked_cost_ceiling'
  | 'blocked_disabled_provider';

/**
 * A routing decision. `provider`/`outputHash` are populated only when the
 * request was actually routed (`routed` or `fallback`). Prompt and output are
 * present ONLY as sha256 hashes — never raw text.
 */
export interface BrainRoutingDecision {
  outcome: BrainOutcome;
  /** Chosen provider id, or null when the request was not routed. */
  provider: string | null;
  /** Human-readable reason (carries no PII). */
  reason: string;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  /** True when an earlier, more-preferred provider was skipped. */
  fallbackUsed: boolean;
  /** Cost the decision was evaluated against (cents). */
  estimatedCostCents: number;
  /** sha256 of the prompt (ledger reference; never the raw prompt). */
  promptHash: string;
  /** sha256 of the mock output, or null when nothing was generated. */
  outputHash: string | null;
}

/**
 * Deterministic in-process mock provider. Returns a stable hash derived from
 * the prompt hash + provider id. This is the ONLY generation path in V1.
 */
function invokeMockProvider(provider: BrainProvider, promptHash: string): string {
  if (!provider.isMock) {
    // Invariant guard: V1 has no live path. A non-mock provider must never be
    // reachable by the invoke step — if it is, the config is wrong, fail loud.
    throw new Error(
      `brain V1: refusing to invoke non-mock provider "${provider.id}" (no live model calls)`,
    );
  }
  return contentFingerprint(`mock-output:${provider.id}:${promptHash}`);
}

/**
 * Route a single brain request. Pure and deterministic. Gate precedence:
 *   1. disabled/unknown requested provider  → blocked_disabled_provider
 *   2. policy hard block (suppressed/opted) → blocked_policy
 *   3. risk requires approval, not approved → needs_approval
 *   4. local-only with no local provider    → blocked_local_only
 *   5. no eligible provider at all          → blocked_disabled_provider
 *   6. estimated cost over ceiling          → blocked_cost_ceiling
 *   7. otherwise route (fallback if an earlier preference was skipped)
 */
export function routeBrainRequest(
  request: BrainRoutingRequest,
  config: BrainConfig,
): BrainRoutingDecision {
  const promptHash = contentFingerprint(request.prompt);
  const riskLevel = classifyRisk(request.actionType);
  const policy = decideApproval({
    actionType: request.actionType,
    riskLevel,
    isSuppressed: request.isSuppressed ?? false,
    settings: config.approvalSettings,
  });

  const base = {
    riskLevel,
    requiresApproval: policy.requiresApproval,
    fallbackUsed: false,
    promptHash,
    outputHash: null as string | null,
    provider: null as string | null,
  };

  // 1. Explicitly requested provider that is disabled/unknown.
  if (request.requestedProvider) {
    const requested = config.providers.find((p) => p.id === request.requestedProvider);
    if (!requested || !requested.enabled) {
      return {
        ...base,
        outcome: 'blocked_disabled_provider',
        reason: `requested provider "${request.requestedProvider}" is disabled or unknown`,
        estimatedCostCents: request.estimatedCostCents ?? 0,
      };
    }
  }

  // 2. Hard policy block (e.g. suppressed target).
  if (policy.blocked) {
    return {
      ...base,
      outcome: 'blocked_policy',
      reason: `policy block: ${policy.reason}`,
      estimatedCostCents: request.estimatedCostCents ?? 0,
    };
  }

  // 3. High-risk action awaiting human approval.
  if (policy.requiresApproval && request.approved !== true) {
    return {
      ...base,
      outcome: 'needs_approval',
      reason: `human approval required (${riskLevel} risk): ${policy.reason}`,
      estimatedCostCents: request.estimatedCostCents ?? 0,
    };
  }

  // Eligible candidates in preference order.
  let candidates = request.requestedProvider
    ? config.providers.filter((p) => p.id === request.requestedProvider)
    : [...config.providers];
  candidates = candidates.filter((p) => p.enabled);

  // 4. Local-only data-residency gate.
  if (config.localOnly === true) {
    const localCandidates = candidates.filter((p) => p.locality === 'local');
    if (localCandidates.length === 0) {
      return {
        ...base,
        outcome: 'blocked_local_only',
        reason: 'local-only required but no enabled local provider is available',
        estimatedCostCents: request.estimatedCostCents ?? 0,
      };
    }
    candidates = localCandidates;
  }

  // 5. Nothing eligible to route to.
  const chosen = candidates[0];
  if (!chosen) {
    return {
      ...base,
      outcome: 'blocked_disabled_provider',
      reason: 'no enabled provider is available to route to',
      estimatedCostCents: request.estimatedCostCents ?? 0,
    };
  }

  // 6. Cost ceiling.
  const estimatedCostCents = request.estimatedCostCents ?? chosen.costCents;
  if (config.costCeilingCents != null && estimatedCostCents > config.costCeilingCents) {
    return {
      ...base,
      outcome: 'blocked_cost_ceiling',
      reason: `estimated cost ${estimatedCostCents}c exceeds ceiling ${config.costCeilingCents}c`,
      estimatedCostCents,
    };
  }

  // 7. Route. Fallback when a more-preferred provider was skipped.
  const fallbackUsed =
    !request.requestedProvider && config.providers.findIndex((p) => p.id === chosen.id) > 0;
  const outputHash = invokeMockProvider(chosen, promptHash);

  return {
    ...base,
    outcome: fallbackUsed ? 'fallback' : 'routed',
    provider: chosen.id,
    reason: fallbackUsed
      ? `routed to fallback mock provider "${chosen.id}" (preferred provider unavailable)`
      : `routed to mock provider "${chosen.id}"`,
    fallbackUsed,
    estimatedCostCents,
    outputHash,
  };
}

/** The observable, PII-free facts a scenario asserts against. */
export interface ExpectedDecision {
  outcome: BrainOutcome;
  provider?: string | null;
  requiresApproval?: boolean;
  fallbackUsed?: boolean;
}

/** One deterministic routing scenario. */
export interface EvalScenario {
  name: string;
  description: string;
  request: BrainRoutingRequest;
  config: BrainConfig;
  expected: ExpectedDecision;
}

/** The PII-free actual decision recorded for a scenario. */
export interface EvalActual {
  outcome: BrainOutcome;
  provider: string | null;
  requiresApproval: boolean;
  fallbackUsed: boolean;
  promptHash: string;
  outputHash: string | null;
}

/** Result of evaluating a single scenario. */
export interface EvalResult {
  scenario: string;
  passed: boolean;
  expected: ExpectedDecision;
  actual: EvalActual;
  /** Field-level mismatches when `passed` is false; empty otherwise. */
  mismatches: string[];
}

/** Aggregate result of running an eval suite. */
export interface EvalSuiteResult {
  suite: string;
  total: number;
  passed: number;
  failed: number;
  results: EvalResult[];
}

// --- Provider catalogs used by the built-in scenarios -----------------------

const mockPrimary: BrainProvider = {
  id: 'mock-primary',
  enabled: true,
  locality: 'local',
  costCents: 1,
  isMock: true,
};
const mockFallback: BrainProvider = {
  id: 'mock-fallback',
  enabled: true,
  locality: 'local',
  costCents: 1,
  isMock: true,
};
const remoteOnly: BrainProvider = {
  id: 'remote-primary',
  enabled: true,
  locality: 'remote',
  costCents: 5,
  isMock: false,
};

/** PII-free prompts: business context only, no contact identifiers. */
const SAFE_PROMPT = 'Draft a follow-up note for the Budget Wheels demo dealership pipeline review.';

/**
 * The canonical `gtm-routing-v1` scenarios. Each pins exactly one routing
 * outcome. All prompts are PII-free and all generation is mock-only.
 */
export const GTM_ROUTING_V1_SCENARIOS: readonly EvalScenario[] = [
  {
    name: 'routing-to-mock',
    description: 'An approved, in-budget request routes to the preferred mock provider.',
    request: {
      workspaceId: 'budget_wheels_demo',
      prompt: SAFE_PROMPT,
      actionType: 'crm.note.create',
      approved: true,
    },
    config: { providers: [mockPrimary], costCeilingCents: 100 },
    expected: { outcome: 'routed', provider: 'mock-primary', fallbackUsed: false },
  },
  {
    name: 'fallback',
    description: 'When the preferred provider is disabled, routing falls back to the next mock.',
    request: {
      workspaceId: 'budget_wheels_demo',
      prompt: SAFE_PROMPT,
      actionType: 'crm.note.create',
      approved: true,
    },
    config: {
      providers: [{ ...mockPrimary, enabled: false }, mockFallback],
      costCeilingCents: 100,
    },
    expected: { outcome: 'fallback', provider: 'mock-fallback', fallbackUsed: true },
  },
  {
    name: 'policy-block',
    description: 'A suppressed/opted-out target is hard-blocked by the policy gate.',
    request: {
      workspaceId: 'budget_wheels_demo',
      prompt: SAFE_PROMPT,
      actionType: 'crm.note.create',
      approved: true,
      isSuppressed: true,
    },
    config: { providers: [mockPrimary], costCeilingCents: 100 },
    expected: { outcome: 'blocked_policy', provider: null },
  },
  {
    name: 'high-risk-approval-required',
    description: 'A high-risk send with no human approval is held for approval, not routed.',
    request: {
      workspaceId: 'budget_wheels_demo',
      prompt: SAFE_PROMPT,
      actionType: 'email.draft.send',
      approved: false,
    },
    config: { providers: [mockPrimary], costCeilingCents: 100 },
    expected: { outcome: 'needs_approval', provider: null, requiresApproval: true },
  },
  {
    name: 'local-only-block',
    description: 'A local-only tenant with only a remote provider is blocked for data residency.',
    request: {
      workspaceId: 'budget_wheels_demo',
      prompt: SAFE_PROMPT,
      actionType: 'crm.note.create',
      approved: true,
    },
    config: { providers: [remoteOnly], localOnly: true, costCeilingCents: 100 },
    expected: { outcome: 'blocked_local_only', provider: null },
  },
  {
    name: 'cost-ceiling-block',
    description: 'A request whose estimated cost exceeds the tenant ceiling is blocked.',
    request: {
      workspaceId: 'budget_wheels_demo',
      prompt: SAFE_PROMPT,
      actionType: 'crm.note.create',
      approved: true,
      estimatedCostCents: 250,
    },
    config: { providers: [mockPrimary], costCeilingCents: 100 },
    expected: { outcome: 'blocked_cost_ceiling', provider: null },
  },
  {
    name: 'disabled-provider-block',
    description: 'Explicitly requesting a disabled provider is blocked.',
    request: {
      workspaceId: 'budget_wheels_demo',
      prompt: SAFE_PROMPT,
      actionType: 'crm.note.create',
      approved: true,
      requestedProvider: 'mock-primary',
    },
    config: { providers: [{ ...mockPrimary, enabled: false }], costCeilingCents: 100 },
    expected: { outcome: 'blocked_disabled_provider', provider: null },
  },
];

const RAW_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// Phone shapes with separators (avoids matching bare hashes/cost numbers).
const RAW_PHONE = /(?:\+?\d[\s.-]?){2,}\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/;

/**
 * Belt-and-braces: throw if a serialized eval result carries raw PII. The
 * harness only ever emits hashes + enums + reasons, so this is a regression
 * tripwire, not the primary defense.
 */
export function assertNoRawPiiInEvalOutput(result: EvalSuiteResult): void {
  const serialized = JSON.stringify(result) ?? '';
  if (RAW_EMAIL.test(serialized)) {
    throw new Error('brain eval: raw email PII detected in suite output');
  }
  if (RAW_PHONE.test(serialized)) {
    throw new Error('brain eval: raw phone PII detected in suite output');
  }
}

/** Compare a decision against a scenario expectation; collect mismatches. */
function diffExpectation(expected: ExpectedDecision, decision: BrainRoutingDecision): string[] {
  const mismatches: string[] = [];
  if (decision.outcome !== expected.outcome) {
    mismatches.push(`outcome: expected "${expected.outcome}", got "${decision.outcome}"`);
  }
  if (expected.provider !== undefined && decision.provider !== expected.provider) {
    mismatches.push(`provider: expected "${expected.provider}", got "${decision.provider}"`);
  }
  if (
    expected.requiresApproval !== undefined &&
    decision.requiresApproval !== expected.requiresApproval
  ) {
    mismatches.push(
      `requiresApproval: expected ${expected.requiresApproval}, got ${decision.requiresApproval}`,
    );
  }
  if (expected.fallbackUsed !== undefined && decision.fallbackUsed !== expected.fallbackUsed) {
    mismatches.push(
      `fallbackUsed: expected ${expected.fallbackUsed}, got ${decision.fallbackUsed}`,
    );
  }
  return mismatches;
}

/**
 * Run an eval suite. Defaults to the built-in `gtm-routing-v1` scenarios.
 * Deterministic: no IO, no model calls beyond the in-process mock. The
 * returned suite result is asserted PII-free before it is handed back.
 */
export function runBrainEvalSuite(
  scenarios: readonly EvalScenario[] = GTM_ROUTING_V1_SCENARIOS,
  suite: string = GTM_ROUTING_SUITE,
): EvalSuiteResult {
  const results: EvalResult[] = scenarios.map((scenario) => {
    const decision = routeBrainRequest(scenario.request, scenario.config);
    const mismatches = diffExpectation(scenario.expected, decision);
    return {
      scenario: scenario.name,
      passed: mismatches.length === 0,
      expected: scenario.expected,
      actual: {
        outcome: decision.outcome,
        provider: decision.provider,
        requiresApproval: decision.requiresApproval,
        fallbackUsed: decision.fallbackUsed,
        promptHash: decision.promptHash,
        outputHash: decision.outputHash,
      },
      mismatches,
    };
  });

  const passed = results.filter((r) => r.passed).length;
  const suiteResult: EvalSuiteResult = {
    suite,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
  assertNoRawPiiInEvalOutput(suiteResult);
  return suiteResult;
}
