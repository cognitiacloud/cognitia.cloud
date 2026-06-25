/**
 * SERVER-ONLY adapter for `/brain-console`.
 *
 * Builds the Operator Brain Panel snapshot from the REAL #206 brain harness in
 * `@cognitia/agents`: it lists the registered models and routes one deterministic
 * demo task through the governed `runTask` / `ModelRouter`, then maps the result
 * onto the pure `BrainHarnessSnapshot` shape the view-model renders. There is no
 * hand-authored mirror — the provider list, the selected provider, the policy
 * decision, and the ledger hash are all real #206 outputs.
 *
 * Server-only because `@cognitia/agents` is a server/runtime package (and
 * `runTask` is async). It must never be imported by a client component; the
 * route (`page.tsx`) is a server component that awaits this.
 *
 * MOCK ONLY: the only executable model is the deterministic mock; every real
 * provider is disabled; `runTask` records hashes only (no raw prompt/output).
 * Tenant is the `budget_wheels_demo` / Tenant Zero sandbox.
 */
import { listModels, runTask } from '@cognitia/agents';
import type {
  BrainHarnessSnapshot,
  PolicySnapshot,
  ProviderKind,
  ProviderSnapshot,
} from '../brainConsoleViewModel';

const SANDBOX_WORKSPACE = 'budget_wheels_demo';
const DEMO_TASK = 'prospect.research';
const DEMO_PROMPT = 'Summarize the Budget Wheels demo dealership pipeline for the weekly review.';
/** Fixed clock so the rendered snapshot is deterministic. */
const FIXED_NOW = () => new Date('2026-01-01T00:00:00.000Z');

function providerKind(location: 'local' | 'external'): ProviderKind {
  return location === 'local' ? 'local' : 'remote';
}

function providerReason(enabled: boolean, kind: ProviderKind): string {
  if (enabled) return 'Deterministic local mock — no network, no key, mock output only.';
  return kind === 'local'
    ? 'Local provider registered as metadata only — disabled in V1 (no egress).'
    : 'Real provider disabled in V1 — no live model calls.';
}

function mapPolicy(ok: boolean, blockedReason: string | undefined): PolicySnapshot {
  if (ok) {
    return {
      decision: 'allow',
      riskLevel: 'low',
      blocked: false,
      reason: 'Low-risk research task allowed under the local-only policy.',
    };
  }
  if (blockedReason === 'high_risk_requires_approval') {
    return {
      decision: 'requires_approval',
      riskLevel: 'high',
      blocked: true,
      reason: 'High-risk task requires human approval before any (mock) run.',
    };
  }
  return {
    decision: 'deny',
    riskLevel: 'unknown',
    blocked: true,
    reason: `Blocked by policy: ${blockedReason ?? 'no eligible model'}.`,
  };
}

/**
 * Build the real Operator Brain Panel snapshot from the #206 harness. Pure aside
 * from constructing the registry/ledger internally; deterministic via FIXED_NOW.
 */
export async function loadBrainHarnessSnapshot(): Promise<BrainHarnessSnapshot> {
  const models = listModels();
  const providers: ProviderSnapshot[] = models.map((d) => {
    const kind = providerKind(d.location);
    return {
      id: d.providerId,
      model: d.modelId,
      kind,
      enabled: d.enabled,
      reason: providerReason(d.enabled, kind),
    };
  });

  const result = await runTask({
    workspaceId: SANDBOX_WORKSPACE,
    taskType: DEMO_TASK,
    prompt: DEMO_PROMPT,
    now: FIXED_NOW,
  });

  const selectedProvider = result.selected ?? {
    providerId: 'mock',
    modelId: 'mock-deterministic-1',
  };

  return {
    mode: 'mock',
    workspace: { workspaceId: SANDBOX_WORKSPACE, sandbox: true },
    task: {
      id: DEMO_TASK,
      label: 'Prospect research',
      objective: 'Summarize a sandbox prospect for the weekly review (mock, never sent).',
    },
    selectedProvider: { id: selectedProvider.providerId, model: selectedProvider.modelId },
    providers,
    policy: mapPolicy(result.ok, result.blockedReason),
    fallback: { used: result.fallbackUsed },
    ledger: {
      // Hashes only — the prompt/output content is never stored or rendered raw.
      hash: `sha256:${result.receipt.inputHash}`,
      proofRef: `proof:brain.decision.v1/${selectedProvider.providerId}`,
    },
    localOnly: {
      ready: true,
      statement: 'Runs fully local — no network egress, no vendor SDK, no API key required.',
    },
    noRealModelCalls: {
      occurred: false,
      statement: 'MOCK/SANDBOX: no real model API call occurred. Output is a deterministic stub.',
    },
  };
}
