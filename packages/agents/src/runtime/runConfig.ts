import { createHash } from 'node:crypto';
import { actionType, POLICY_VERSION } from '@cognitia/core';
import type { AdapterRegistry } from '@cognitia/integrations';

/**
 * RUN-3 — run config fingerprinting. Stamps every AgentRun with the exact
 * versioned logic that produced it, so any run answers "what version created
 * this?" deterministically and two runs are comparable / rollback-friendly.
 *
 * Honesty note: Mira's generator is deterministic templates today — there is
 * NO external LLM, prompt store, or model router in the repo. So `model_version`
 * truthfully reads `deterministic-template` and `prompt_version` is the
 * template generator's version. When a real model/prompt store lands, these
 * fields carry the real ids and the fingerprint moves automatically — which is
 * the whole point. Two of the fields are DERIVED from live inputs (not labels):
 *   - tool_schema_version: hash of the canonical action-type enum (changes when
 *     an action type is added/removed),
 *   - routing_version: hash of the action types EXECUTABLE in this composition
 *     (captures the V1 fence — email is non-executable in v1), probed live from
 *     the adapter registry.
 * So the fingerprint is grounded in real inputs, not mutable labels alone.
 */

/** Code-reviewed version labels for the deterministic logic with no other signal. */
export const RUN_CONFIG_LABELS = {
  /** Deterministic template generator version (no LLM today). */
  prompt_version: 'mira-templates-v1',
  /** Human-facing release tag for the prompt/template bundle. */
  prompt_release: '2026-06-01',
  /** No external model is called; the generator is deterministic templates. */
  model_version: 'deterministic-template',
} as const;

export interface RunConfigDescriptor {
  prompt_version: string;
  prompt_release: string;
  model_version: string;
  policy_version: string;
  /** Derived: short hash of the canonical action-type enum. */
  tool_schema_version: string;
  /** Derived: short hash of the action types executable in this composition. */
  routing_version: string;
}

/** sha256 over a sorted-key canonical encoding of a string-keyed record. */
function shortHash(obj: Record<string, unknown>): string {
  const canonical = JSON.stringify(
    Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => ((acc[k] = obj[k]), acc), {}),
  );
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

/** Canonical, sorted list of every action type the system knows (the tool schema). */
function canonicalActionTypes(): string[] {
  return [...actionType.options].sort();
}

/**
 * Derive the config descriptor from the live runtime. `tool_schema_version`
 * comes from the canonical action-type set; `routing_version` from the action
 * types this adapter registry can actually execute (the V1 fence makes email
 * non-executable, so a v1 composition has a different routing_version than a
 * full one — proving a composition change is visible in the fingerprint).
 */
export function describeRunConfig(adapters: AdapterRegistry): RunConfigDescriptor {
  const all = canonicalActionTypes();
  const executable = all.filter((t) => adapters.find(t) !== undefined);
  return {
    prompt_version: RUN_CONFIG_LABELS.prompt_version,
    prompt_release: RUN_CONFIG_LABELS.prompt_release,
    model_version: RUN_CONFIG_LABELS.model_version,
    policy_version: POLICY_VERSION,
    tool_schema_version: shortHash({ action_types: all }),
    routing_version: shortHash({ executable }),
  };
}

/**
 * Deterministic fingerprint over the full descriptor. Stable across engines
 * and across identical configs; any field change yields a different hash.
 */
export function configFingerprint(descriptor: RunConfigDescriptor): string {
  const canonical = JSON.stringify(
    Object.keys(descriptor)
      .sort()
      .reduce<Record<string, unknown>>(
        (acc, k) => ((acc[k] = descriptor[k as keyof RunConfigDescriptor]), acc),
        {},
      ),
  );
  return createHash('sha256').update(canonical).digest('hex');
}

/** Content-addressed pointer to the exact config bundle used (for the trace). */
export function traceBundleRef(fingerprint: string): string {
  return `config:${fingerprint}`;
}

/** Resolve the full lineage stamp for a run created under this composition. */
export function resolveRunLineage(adapters: AdapterRegistry): {
  config: RunConfigDescriptor;
  config_fingerprint: string;
  trace_bundle_ref: string;
} {
  const config = describeRunConfig(adapters);
  const config_fingerprint = configFingerprint(config);
  return { config, config_fingerprint, trace_bundle_ref: traceBundleRef(config_fingerprint) };
}
