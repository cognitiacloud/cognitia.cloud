import type { ActionProvenance, ApprovedAgentAction } from '@cognitia/core';
import { assertApproved, type AdapterResult, type IntegrationAdapter } from '../types.js';
import { FakeHubspotClient, type HubspotClient } from './client.js';

/**
 * HubSpot adapter. Handles CRM task/note creation for Mira's CRM-task mode.
 * Refuses unapproved actions and delegates the actual write to a HubspotClient
 * (the implementation boundary). Defaults to an in-memory FakeHubspotClient so
 * the approval→execute path works end-to-end; swap in the real client to go live.
 */
export class StubHubspotAdapter implements IntegrationAdapter {
  readonly system = 'hubspot';
  readonly kind = 'crm' as const;

  constructor(private readonly client: HubspotClient = new FakeHubspotClient()) {}

  handles(actionType: string): boolean {
    return actionType === 'crm.task.create' || actionType === 'crm.note.create';
  }

  async execute(
    action: ApprovedAgentAction,
    provenance?: ActionProvenance,
  ): Promise<AdapterResult> {
    assertApproved(action);
    const input = {
      tenantId: action.tenant_id,
      idempotencyKey: action.idempotency_key,
      targetRef: action.target_ref,
      payload: { payload_ref: action.payload_ref ?? null },
      provenance,
    };
    const result =
      action.action_type === 'crm.note.create'
        ? await this.client.createNote(input)
        : await this.client.createTask(input);
    return {
      ok: true,
      external_ref: result.externalRef,
      idempotent_replay: result.idempotentReplay,
      detail: 'created via HubspotClient',
    };
  }
}
