import type { ApprovedAgentAction } from '@cognitia/core';
import { assertApproved, type AdapterResult, type IntegrationAdapter } from '../types.js';

/**
 * Stub email adapter. It does not talk to a real provider yet — it records
 * "sends" keyed by idempotency_key. It enforces two invariants:
 *   1. Refuses to send unless the action is approved (assertApproved).
 *   2. Idempotent: the same idempotency_key never sends twice; a replay returns
 *      the original result with idempotent_replay = true.
 */
export class StubEmailAdapter implements IntegrationAdapter {
  readonly system = 'email';
  readonly kind = 'comms' as const;

  /** idempotency_key -> result, simulating provider-side dedupe. */
  private readonly sent = new Map<string, AdapterResult>();

  handles(actionType: string): boolean {
    return actionType === 'email.draft.send';
  }

  async execute(action: ApprovedAgentAction): Promise<AdapterResult> {
    assertApproved(action); // defense in depth — cannot send unapproved.
    // CGD-001: this adapter is an in-memory stub (no provider fetch). A live
    // email adapter MUST call assertLiveOutboundAllowed('email') before fetch.

    const prior = this.sent.get(action.idempotency_key);
    if (prior) {
      return { ...prior, idempotent_replay: true };
    }

    const result: AdapterResult = {
      ok: true,
      external_ref: `email:${action.idempotency_key.slice(0, 12)}`,
      idempotent_replay: false,
      detail: 'queued (stub)',
    };
    this.sent.set(action.idempotency_key, result);
    return result;
  }

  /** Test helper: how many distinct sends happened. */
  sentCount(): number {
    return this.sent.size;
  }
}
