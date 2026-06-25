/**
 * View-model for the Operator Brain Panel (`/brain-console`).
 *
 * Pure transforms over a "brain harness snapshot" — the record of how the #206
 * brain selected a provider/model and decided an action, rendered so an operator
 * can audit the safety posture. Presentation only: no React, no IO, no
 * `@cognitia/agents` import (the same decoupled pattern as
 * `gtmOsAssemblyViewModel.ts`). The real snapshot is built server-side from the
 * #206 registry/router by `lib/server/brainConsoleData.ts`; this file declares
 * the shape and the transform so no client-side provider/SDK import can sneak in.
 *
 * MOCK ONLY / NO REAL MODEL CALLS / NO LIVE OUTREACH / NO RAW PII — the panel
 * surfaces this attestation to the operator on every render.
 */

/** The persistent operator banner. Shown on every render, never conditional. */
export const BRAIN_CONSOLE_BANNER =
  'MOCK ONLY / NO REAL MODEL CALLS / NO LIVE OUTREACH / NO RAW PII';

/** Badge tone for status pills. */
export type Tone = 'success' | 'warning' | 'danger' | 'neutral';

/** How a provider runs — on-device/self-hosted (`local`) or external API (`remote`). */
export type ProviderKind = 'local' | 'remote';

/** A provider/model candidate the brain could route to. */
export interface ProviderSnapshot {
  /** Stable provider id, e.g. `mock` or `anthropic`. No secrets, no keys. */
  id: string;
  /** Model identifier label only — never a key value. */
  model: string;
  kind: ProviderKind;
  /** False for every real provider in V1, by construction. */
  enabled: boolean;
  /** Why it is enabled/disabled (e.g. "real provider disabled in V1"). */
  reason: string;
}

/** A policy gate decision over the selected task (mapped from the #206 router). */
export interface PolicySnapshot {
  decision: 'allow' | 'requires_approval' | 'deny';
  riskLevel: string;
  blocked: boolean;
  reason: string;
}

/** Fallback routing record — whether the brain fell back, and why. */
export interface FallbackSnapshot {
  used: boolean;
  from?: string;
  to?: string;
  reason?: string;
}

/**
 * Structural view of a brain harness snapshot. PII-safe by construction:
 * task/prompt content is referenced by hash, never stored raw.
 */
export interface BrainHarnessSnapshot {
  mode: 'mock';
  workspace: { workspaceId: string; sandbox: boolean };
  /** The selected task the brain is reasoning about. */
  task: { id: string; label: string; objective: string };
  /** The provider/model the brain selected for this task. */
  selectedProvider: { id: string; model: string };
  /** Every candidate provider, with enabled/disabled state. */
  providers: ReadonlyArray<ProviderSnapshot>;
  policy: PolicySnapshot;
  fallback: FallbackSnapshot;
  /** Append-only ledger proof for this decision — hashes only, no raw content. */
  ledger: { hash: string; proofRef: string };
  /** Local-only execution readiness (no network egress required to run). */
  localOnly: { ready: boolean; statement: string };
  /** Attestation that no real model API call occurred. */
  noRealModelCalls: { occurred: boolean; statement: string };
}

export interface StatusBadge {
  label: string;
  tone: Tone;
}

/** Presentation-ready provider row. */
export interface ProviderRowView {
  id: string;
  model: string;
  kind: ProviderKind;
  enabled: boolean;
  /** Human label for the enabled/disabled state. */
  stateLabel: string;
  tone: Tone;
  reason: string;
  /** True when this is the provider the brain selected. */
  selected: boolean;
}

/** Presentation-ready view for the Operator Brain Panel. */
export interface BrainConsoleView {
  /** Constant persistent banner string. */
  banner: string;
  workspaceId: string;
  sandbox: boolean;
  /** Selected task. */
  taskLabel: string;
  taskObjective: string;
  /** Selected provider/model, e.g. "mock · mock-deterministic-1". */
  selectedProviderLabel: string;
  /** Enabled/disabled badge for the SELECTED provider. */
  selectedProviderState: StatusBadge;
  /** All providers with their enabled/disabled state. */
  providers: ProviderRowView[];
  /** Ids of real (remote) providers that are disabled — should be ALL of them. */
  disabledRealProviders: string[];
  /** Policy decision badge + reason. */
  policyBadge: StatusBadge;
  policyReason: string;
  /** Whether a fallback was used, and a human label for it. */
  fallbackLabel: string;
  /** Ledger proof — hash + proofRef (no raw content). */
  ledgerHash: string;
  proofRef: string;
  /** Local-only readiness badge + statement. */
  localOnlyReady: boolean;
  localOnlyStatement: string;
  /**
   * True only when the snapshot is mock-mode AND no real model call occurred
   * AND every real provider is disabled. The single safety invariant the panel
   * asserts on every render.
   */
  mockSafe: boolean;
  /** Attestation statement that no real model API call occurred. */
  noRealModelStatement: string;
}

function selectedProviderState(snapshot: BrainHarnessSnapshot): StatusBadge {
  const selected = snapshot.providers.find((p) => p.id === snapshot.selectedProvider.id);
  if (!selected) {
    return { label: 'Unknown', tone: 'warning' };
  }
  return selected.enabled
    ? { label: 'Enabled', tone: 'success' }
    : { label: 'Disabled', tone: 'danger' };
}

function providerRow(snapshot: BrainHarnessSnapshot, p: ProviderSnapshot): ProviderRowView {
  return {
    id: p.id,
    model: p.model,
    kind: p.kind,
    enabled: p.enabled,
    stateLabel: p.enabled ? 'Enabled' : 'Disabled',
    // Enabled remote providers would be a real-call risk — flag as danger.
    tone: p.enabled ? (p.kind === 'local' ? 'success' : 'danger') : 'neutral',
    reason: p.reason,
    selected: p.id === snapshot.selectedProvider.id,
  };
}

function policyBadge(policy: PolicySnapshot): StatusBadge {
  switch (policy.decision) {
    case 'allow':
      return { label: 'Allow', tone: 'success' };
    case 'requires_approval':
      return { label: 'Requires approval', tone: 'warning' };
    case 'deny':
    default:
      return { label: 'Deny', tone: 'danger' };
  }
}

function fallbackLabel(fallback: FallbackSnapshot): string {
  if (!fallback.used) {
    return 'None — primary provider selected';
  }
  const from = fallback.from ?? 'unknown';
  const to = fallback.to ?? 'unknown';
  const reason = fallback.reason ? ` (${fallback.reason})` : '';
  return `${from} → ${to}${reason}`;
}

/** Build the Operator Brain Panel view-model from a harness snapshot. Pure. */
export function toBrainConsoleView(snapshot: BrainHarnessSnapshot): BrainConsoleView {
  const noRealCalls = snapshot.noRealModelCalls.occurred === false;
  const allRealDisabled = snapshot.providers
    .filter((p) => p.kind === 'remote')
    .every((p) => !p.enabled);

  return {
    banner: BRAIN_CONSOLE_BANNER,
    workspaceId: snapshot.workspace.workspaceId,
    sandbox: snapshot.workspace.sandbox,
    taskLabel: snapshot.task.label,
    taskObjective: snapshot.task.objective,
    selectedProviderLabel: `${snapshot.selectedProvider.id} · ${snapshot.selectedProvider.model}`,
    selectedProviderState: selectedProviderState(snapshot),
    providers: snapshot.providers.map((p) => providerRow(snapshot, p)),
    disabledRealProviders: snapshot.providers
      .filter((p) => p.kind === 'remote' && !p.enabled)
      .map((p) => p.id),
    policyBadge: policyBadge(snapshot.policy),
    policyReason: snapshot.policy.reason,
    fallbackLabel: fallbackLabel(snapshot.fallback),
    ledgerHash: snapshot.ledger.hash,
    proofRef: snapshot.ledger.proofRef,
    localOnlyReady: snapshot.localOnly.ready,
    localOnlyStatement: snapshot.localOnly.statement,
    mockSafe: snapshot.mode === 'mock' && noRealCalls && allRealDisabled,
    noRealModelStatement: snapshot.noRealModelCalls.statement,
  };
}

/**
 * A small, deterministic example snapshot for unit tests. The PAGE renders the
 * real snapshot built from the #206 registry/router by the server adapter; this
 * fixture exists only so the pure transform is unit-testable without importing
 * `@cognitia/agents`. Provider ids/models mirror the real #206 registry.
 */
export function exampleBrainHarnessSnapshot(): BrainHarnessSnapshot {
  return {
    mode: 'mock',
    workspace: { workspaceId: 'budget_wheels_demo', sandbox: true },
    task: {
      id: 'prospect.research',
      label: 'Prospect research',
      objective: 'Summarize a sandbox prospect for review (mock, never sent).',
    },
    selectedProvider: { id: 'mock', model: 'mock-deterministic-1' },
    providers: [
      {
        id: 'mock',
        model: 'mock-deterministic-1',
        kind: 'local',
        enabled: true,
        reason: 'Deterministic local mock — no network, no key, mock output only.',
      },
      {
        id: 'anthropic',
        model: 'claude (model id withheld)',
        kind: 'remote',
        enabled: false,
        reason: 'Real provider disabled in V1 — no live model calls.',
      },
      {
        id: 'openai',
        model: 'gpt (model id withheld)',
        kind: 'remote',
        enabled: false,
        reason: 'Real provider disabled in V1 — no live model calls.',
      },
    ],
    policy: {
      decision: 'allow',
      riskLevel: 'low',
      blocked: false,
      reason: 'Low-risk research task allowed under the local-only policy.',
    },
    fallback: { used: false },
    ledger: {
      hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      proofRef: 'proof:brain.decision.v1/mock',
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
