/**
 * CONTROLLED-LIVE SANDBOX HARNESS.
 *
 * STATUS: MOCK / SANDBOX. This harness models what a `controlled_live` release
 * stage *would* exercise — permission checks, the full release gate, an
 * authorized channel action — but it executes that action as a SIMULATION
 * ONLY. It NEVER sends, NEVER touches the network, NEVER imports or invokes a
 * vendor SDK, and NEVER selects a real provider.
 *
 * The output of an authorized run is fixed by construction to:
 *
 *     mode:     'sandbox_simulated'
 *     sent:     false
 *     provider: 'none'
 *
 * Fail-closed guarantees:
 *  - `runControlledLiveSandbox` is a pure function. Its result's `sent` is the
 *    literal `false`, `mode` is the literal `'sandbox_simulated'`, and
 *    `provider` is the literal `'none'` — there is no input that changes them.
 *  - Requesting a real provider (any `provider` other than `'none'`, or
 *    `useRealProvider: true`) is BLOCKED: the harness throws and produces no
 *    result. Even a fully-authorized controlled-live gate cannot select one.
 *  - `assertSandboxSimulatedOnly` is a runtime tripwire that throws if a result
 *    has been forged/tampered to claim a send, a non-sandbox mode, or a real
 *    provider.
 *
 * Actually performing a controlled-live release remains PLANNED and blocked
 * until legal, customer, and founder signoff land out-of-band in a separate,
 * legally-reviewed lane. Authorizing the gate here only models that those
 * attestations exist; it does NOT make them true and does NOT enable a send.
 *
 * No real PII: previews use redacted/synthetic targets (`*.example`,
 * `555-01xx`) scoped to the Budget Wheels demo / Tenant Zero sandbox.
 */

import type { ChannelKind } from '../channels/channelPolicy.js';
import { planDryRunAction, type DryRunAction } from '../channels/dryRunChannels.js';
import { can } from '../security/permissionModel.js';
import {
  evaluateReleaseGate,
  type ReleaseConditions,
  type ReleaseGateResult,
} from '../security/releaseGate.js';

/** The only mode this harness ever emits. */
export const SANDBOX_MODE = 'sandbox_simulated' as const;
export type SandboxMode = typeof SANDBOX_MODE;

/** The only provider this harness ever emits — none. Real providers are blocked. */
export const SANDBOX_PROVIDER = 'none' as const;
export type SandboxProvider = typeof SANDBOX_PROVIDER;

/**
 * The release stage this harness simulates. It is always `controlled_live`:
 * the harness exists to exercise the most-exposed gate while still never
 * sending.
 */
export const SANDBOX_STAGE = 'controlled_live' as const;

/**
 * Authorization context for a controlled-live sandbox run.
 *
 * `conditions` are the SANDBOX booleans evaluated by the `controlled_live`
 * release gate (see `security/releaseGate.ts`). Asserting them true here does
 * NOT make them true in the real world — it models that an out-of-band
 * attestation exists. Even all-true only authorizes a SIMULATION.
 */
export interface ControlledLiveAuthorization {
  /** Permission role of the caller (least-privilege; see permissionModel). */
  role: string;
  /** Sandbox release-gate conditions for the `controlled_live` stage. */
  conditions?: ReleaseConditions;
}

/**
 * Input to a controlled-live sandbox run. Identifiers and previews only — no
 * raw PII.
 */
export interface ControlledLiveSandboxInput {
  /** Workspace / tenant scope; required and non-empty. */
  workspaceId: string;
  /** Opaque prospect/contact identifier (NOT raw PII). */
  prospectId: string;
  /** Channel to simulate. */
  channel: ChannelKind;
  /** Authorization context (permission role + release-gate conditions). */
  authorization: ControlledLiveAuthorization;
  /**
   * Redacted/synthetic preview target (e.g. `lead@buyer.example`,
   * `+1-555-0142`). Preview only — never contacted.
   */
  target?: string;
  /** Short human-readable preview of what would be simulated. */
  summary?: string;
  /**
   * Caller's requested provider. MUST be `'none'` or omitted. Any other value
   * is a request for a REAL provider and is BLOCKED (the run throws).
   */
  provider?: string;
  /**
   * Caller's request to use a real provider. MUST be off. If true, the run is
   * BLOCKED (it throws) regardless of authorization.
   */
  useRealProvider?: boolean;
}

/**
 * The result of an authorized controlled-live sandbox run: a SIMULATION.
 *
 * `mode`, `sent`, and `provider` are fixed literals by construction. The
 * embedded `plan` is the same dry-run preview the channel layer produces; it
 * has no send effect.
 */
export interface SandboxSimulationResult {
  mode: SandboxMode;
  /** Always literally false. Nothing was, or can be, sent in this harness. */
  sent: false;
  /** Always literally 'none'. No real provider is ever selected here. */
  provider: SandboxProvider;
  /** Always 'controlled_live' — the stage being simulated. */
  stage: typeof SANDBOX_STAGE;
  channel: ChannelKind;
  workspaceId: string;
  prospectId: string;
  /**
   * Whether the run was authorized (permission held + release gate passed).
   * Note: an UNauthorized run still returns a simulated, never-sent result —
   * authorization only governs the `authorized` flag and notes, never whether
   * anything is sent.
   */
  authorized: boolean;
  /** The release-gate evaluation for the simulated `controlled_live` stage. */
  gate: ReleaseGateResult;
  /** Stable, deterministic simulation reference (no randomness, no IO). */
  simulationRef: string;
  /** The dry-run plan preview (never sent). */
  plan: DryRunAction;
  /** Ordered, human-readable notes about the simulation. */
  notes: string[];
}

/** Thrown when a real (non-sandbox) provider or live send is requested. */
export class RealProviderBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RealProviderBlockedError';
  }
}

/** Thrown when a result violates the sandbox-simulated / no-send invariant. */
export class SandboxInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxInvariantError';
  }
}

/**
 * The permission a caller needs to *authorize* a controlled-live simulation.
 * Holding it does NOT enable a send — the gate downstream is still a
 * simulation. (Mirrors the live-connector permission in the permission model.)
 */
const REQUIRED_PERMISSION = 'configure_live_connector';

/**
 * Reject any request for a real provider. Called before any simulation runs so
 * the harness fails closed at the boundary.
 *
 * A request is "real" if `provider` is present and not `'none'`, or if
 * `useRealProvider` is true.
 */
function assertNoRealProviderRequested(input: ControlledLiveSandboxInput): void {
  if (input.useRealProvider === true) {
    throw new RealProviderBlockedError(
      'real provider blocked: useRealProvider is true — this harness only simulates (provider: none, sent: false)',
    );
  }
  if (input.provider !== undefined && input.provider !== SANDBOX_PROVIDER) {
    throw new RealProviderBlockedError(
      `real provider blocked: requested provider "${input.provider}" — only "${SANDBOX_PROVIDER}" (simulation) is permitted`,
    );
  }
}

/**
 * Run a controlled-live action in the sandbox. ALWAYS simulates; NEVER sends.
 *
 * Behaviour:
 *  - Requesting a real provider throws {@link RealProviderBlockedError}.
 *  - Otherwise returns a {@link SandboxSimulationResult} whose `mode` is
 *    `'sandbox_simulated'`, `sent` is `false`, and `provider` is `'none'` —
 *    fixed by construction for every input.
 *  - `authorized` reflects whether the caller held the required permission AND
 *    the `controlled_live` release gate passed; it never changes whether a send
 *    occurs (it cannot — the harness has no send path).
 *
 * Pure and deterministic: identical inputs yield an identical result.
 */
export function runControlledLiveSandbox(
  input: ControlledLiveSandboxInput,
): SandboxSimulationResult {
  // Fail closed at the boundary: no real provider, ever.
  assertNoRealProviderRequested(input);

  const notes: string[] = [];

  const hasPermission = can(input.authorization.role, REQUIRED_PERMISSION);
  if (!hasPermission) {
    notes.push(
      `permission_denied: role "${input.authorization.role}" lacks "${REQUIRED_PERMISSION}" — running unauthorized simulation`,
    );
  }

  const gate = evaluateReleaseGate(SANDBOX_STAGE, input.authorization.conditions ?? {});
  if (!gate.passed) {
    notes.push(`gate_blocked: ${gate.reason}`);
  }

  const authorized = hasPermission && gate.passed;
  notes.push(
    authorized
      ? 'authorized: controlled-live conditions modelled as satisfied — proceeding as SIMULATION ONLY (no send)'
      : 'unauthorized: proceeding as SIMULATION ONLY (no send) regardless',
  );
  // Invariant note, true for every path:
  notes.push('no_live_egress: provider=none, sent=false, mode=sandbox_simulated');

  const plan = planDryRunAction(input.channel, {
    workspaceId: input.workspaceId,
    prospectId: input.prospectId,
    target: input.target,
    summary: input.summary,
  });

  const simulationRef = `sandbox:${SANDBOX_STAGE}:${input.channel}:${input.workspaceId}:${input.prospectId}`;

  return {
    mode: SANDBOX_MODE,
    sent: false,
    provider: SANDBOX_PROVIDER,
    stage: SANDBOX_STAGE,
    channel: input.channel,
    workspaceId: input.workspaceId,
    prospectId: input.prospectId,
    authorized,
    gate,
    simulationRef,
    plan,
    notes,
  };
}

/**
 * Runtime tripwire. Throws {@link SandboxInvariantError} if a result has been
 * forged/tampered to claim a send, a non-sandbox mode, or a real provider.
 * Use this anywhere a {@link SandboxSimulationResult} crosses a trust boundary.
 */
export function assertSandboxSimulatedOnly(
  result: Pick<SandboxSimulationResult, 'mode' | 'sent' | 'provider'>,
): void {
  // Widened cast on purpose: this guard must catch forged objects whose types
  // were bypassed at the boundary.
  const mode = (result as { mode: unknown }).mode;
  const sent = (result as { sent: unknown }).sent;
  const provider = (result as { provider: unknown }).provider;

  if (mode !== SANDBOX_MODE) {
    throw new SandboxInvariantError(
      `sandbox invariant violated: expected mode "${SANDBOX_MODE}", got "${String(mode)}"`,
    );
  }
  if (sent !== false) {
    throw new SandboxInvariantError(
      `sandbox invariant violated: result reported sent="${String(sent)}", must be false`,
    );
  }
  if (provider !== SANDBOX_PROVIDER) {
    throw new SandboxInvariantError(
      `sandbox invariant violated: expected provider "${SANDBOX_PROVIDER}", got "${String(provider)}"`,
    );
  }
}
