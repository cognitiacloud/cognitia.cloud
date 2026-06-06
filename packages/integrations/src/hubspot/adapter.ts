import type { ApprovedAgentAction } from '@cognitia/core';
import { assertApproved, type AdapterResult, type IntegrationAdapter } from '../types.js';

/**
 * Stub HubSpot adapter. Handles CRM task/note creation for Mira's CRM-task mode.
 * Idempotent on idempotency_key; refuses unapproved actions. Real API calls are
 * left as TODOs for a follow-up implementation.
 */
export class StubHubspotAdapter implements IntegrationAdapter {
  readonly system = 'hubspot';
  readonly kind = 'crm' as const;

  private readonly written = new Map<string, AdapterResult>();

  handles(actionType: string): boolean {
    return actionType === 'crm.task.create' || actionType === 'crm.note.create';
  }

  async execute(action: ApprovedAgentAction): Promise<AdapterResult> {
    assertApproved(action);
    const prior = this.written.get(action.idempotency_key);
    if (prior) return { ...prior, idempotent_replay: true };

    // TODO(codex): call HubSpot Engagements API to create the task/note.
    const result: AdapterResult = {
      ok: true,
      external_ref: `hubspot:${action.action_type}:${action.idempotency_key.slice(0, 12)}`,
      idempotent_replay: false,
      detail: 'created (stub)',
    };
    this.written.set(action.idempotency_key, result);
    return result;
  }
}
