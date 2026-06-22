/**
 * DRY-RUN-ONLY channel orchestration.
 *
 * Every channel here *plans* an action and NEVER sends. There is no network,
 * no vendor SDK, no IO. The output is a deterministic, inspectable plan whose
 * `sent` is always `false` and whose `mode` is always `'dry_run'`.
 *
 * Fail-closed guarantees:
 *  - `planDryRunAction` cannot emit a "sent" action — it is a pure function.
 *  - `assertNoLiveSend` throws if any action claims to have sent or is not in
 *    dry-run mode (defence against a tampered/forged action).
 *  - `sendLive` ALWAYS throws ("live channels disabled") regardless of input
 *    and regardless of any release gate, because no gate can open in this layer.
 *
 * SANDBOX/MOCK only. No real PII; previews use redacted/synthetic targets.
 */

import {
  isReleaseGateOpen,
  IMPOSSIBLE_RELEASE_GATE,
  type ChannelKind,
  type ReleaseGate,
} from './channelPolicy.js';

export type ChannelMode = 'dry_run';

/**
 * Input for planning a channel action. Identifiers and previews only.
 * Targets should be redacted/synthetic (e.g. `*.example`, `555-01xx`).
 */
export interface DryRunChannelInput {
  /** Workspace / tenant scope. */
  workspaceId: string;
  /** Opaque prospect/contact identifier (NOT raw PII). */
  prospectId: string;
  /**
   * Redacted/synthetic target descriptor for preview only (e.g.
   * `lead@buyer.example`, `+1-555-0142`, `linkedin:demo-handle`).
   */
  target?: string;
  /** Short human-readable summary of what would be sent (preview text). */
  summary?: string;
}

/**
 * A planned, never-sent channel action.
 *
 * `sent` is always literally `false` and `mode` is always `'dry_run'`. The
 * `wouldSendIfLive` block is a PREVIEW of intent only; it has no send effect.
 */
export interface DryRunAction {
  mode: ChannelMode;
  /** Always false. The action was not, and cannot be, sent in this layer. */
  sent: false;
  channel: ChannelKind;
  workspaceId: string;
  prospectId: string;
  /** Stable, deterministic plan reference (no randomness, no IO). */
  planRef: string;
  /** Preview-only description of the intended send. NOT executed. */
  wouldSendIfLive: {
    channel: ChannelKind;
    target: string;
    summary: string;
    /** Always 'BLOCKED' — the live path is fail-closed in this layer. */
    liveStatus: 'BLOCKED';
  };
}

/** Per-channel default preview target when none supplied (synthetic only). */
const DEFAULT_TARGETS: Record<ChannelKind, string> = {
  email: 'lead@buyer.example',
  sms: '+1-555-0100',
  whatsapp: 'whatsapp:+1-555-0101',
  call: '+1-555-0102',
  linkedin: 'linkedin:demo-prospect.invalid',
  ad: 'ad-audience:budget_wheels_demo',
  crm_writeback: 'crm:budget_wheels_demo/sandbox-record',
};

/**
 * Plan a dry-run channel action. Pure and deterministic: same inputs always
 * yield the same plan, with `sent: false` and `mode: 'dry_run'`.
 */
export function planDryRunAction(channel: ChannelKind, input: DryRunChannelInput): DryRunAction {
  const target = input.target ?? DEFAULT_TARGETS[channel];
  const summary = input.summary ?? `dry-run ${channel} plan for ${input.prospectId}`;
  const planRef = `dryrun:${channel}:${input.workspaceId}:${input.prospectId}`;

  return {
    mode: 'dry_run',
    sent: false,
    channel,
    workspaceId: input.workspaceId,
    prospectId: input.prospectId,
    planRef,
    wouldSendIfLive: {
      channel,
      target,
      summary,
      liveStatus: 'BLOCKED',
    },
  };
}

/** Thrown when an action violates the dry-run / no-send invariant. */
export class LiveSendBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveSendBlockedError';
  }
}

/**
 * Assert that an action did not (and cannot have) sent. Throws
 * {@link LiveSendBlockedError} if `mode` is not `'dry_run'` or `sent` is truthy.
 * This is the runtime tripwire against a forged/tampered action.
 */
export function assertNoLiveSend(action: Pick<DryRunAction, 'mode' | 'sent'>): void {
  // Cast widened on purpose: this guard must catch forged objects whose types
  // were bypassed at the boundary.
  const sent = (action as { sent: unknown }).sent;
  const mode = (action as { mode: unknown }).mode;
  if (mode !== 'dry_run') {
    throw new LiveSendBlockedError(
      `live channels disabled: expected mode "dry_run", got "${String(mode)}"`,
    );
  }
  if (sent !== false) {
    throw new LiveSendBlockedError(
      `live channels disabled: action reported sent="${String(sent)}", must be false`,
    );
  }
}

/**
 * The live-send guard. ALWAYS throws — this layer cannot send.
 *
 * It accepts an optional release gate purely to model the future contract: a
 * real live lane would require an OPEN gate. But because no gate constructible
 * in this layer can be open (see `channelPolicy.isReleaseGateOpen`), this
 * function fails closed for every possible input.
 */
export function sendLive(
  _channel: ChannelKind,
  _input: DryRunChannelInput,
  gate: ReleaseGate = IMPOSSIBLE_RELEASE_GATE,
): never {
  if (isReleaseGateOpen(gate)) {
    // Unreachable in this layer: no gate here can open. Still fail closed.
    throw new LiveSendBlockedError(
      'live channels disabled: live send is not implemented in the dry-run layer',
    );
  }
  throw new LiveSendBlockedError(
    'live channels disabled: release gate is closed (blocked until legal/consent sign-off in a separate lane)',
  );
}
