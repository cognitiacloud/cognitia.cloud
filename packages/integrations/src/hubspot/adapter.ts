import type { ActionProvenance, ApprovedAgentAction } from '@cognitia/core';
import { assertApproved, type AdapterResult, type IntegrationAdapter } from '../types.js';
import { FakeHubspotClient, type HubspotClient } from './client.js';
import { engagementContent } from './writePlan.js';

/**
 * HubSpot adapter. Handles CRM task/note creation and (CRM-2) approval-gated
 * deal stage updates. Refuses unapproved actions and delegates the actual write
 * to a HubspotClient (the implementation boundary). Defaults to an in-memory
 * FakeHubspotClient so the approval→execute path works end-to-end; swap in the
 * real client to go live.
 */
export class StubHubspotAdapter implements IntegrationAdapter {
  readonly system = 'hubspot';
  readonly kind = 'crm' as const;

  constructor(private readonly client: HubspotClient = new FakeHubspotClient()) {}

  handles(actionType: string): boolean {
    return (
      actionType === 'crm.task.create' ||
      actionType === 'crm.note.create' ||
      actionType === 'crm.stage.update'
    );
  }

  async execute(
    action: ApprovedAgentAction,
    provenance?: ActionProvenance,
  ): Promise<AdapterResult> {
    assertApproved(action);
    // CRM-2: stage update. The typed plan (external deal id + from/to stage)
    // was resolved from synced CRM facts at proposal time and rides
    // payload_ref, so what the approver saw is exactly what is written.
    if (action.action_type === 'crm.stage.update') {
      const plan = parseStagePlanRef(action.payload_ref);
      if (!plan) {
        return { ok: false, detail: `unrecognized stage plan ref: ${action.payload_ref}` };
      }
      const result = await this.client.updateDealStage({
        tenantId: action.tenant_id,
        externalId: plan.externalId,
        stage: plan.toStage,
        idempotencyKey: action.idempotency_key,
      });
      return {
        ok: true,
        // Encodes the prior stage so rollback can restore it (reversible write).
        external_ref: `hubspot:deal_stage:${plan.externalId}:${plan.fromStage}`,
        idempotent_replay: result.idempotentReplay,
        detail: `stage ${plan.fromStage} -> ${plan.toStage} via HubspotClient`,
      };
    }
    // GOV-1: the payload is the typed engagement content derived from the
    // action row — the same content the preview showed at approval time.
    const input = {
      tenantId: action.tenant_id,
      idempotencyKey: action.idempotency_key,
      targetRef: action.target_ref,
      payload: engagementContent(action),
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

  /**
   * UNDO-1: reverse the write this adapter performed.
   *  - Engagements (`hubspot:task(s)|note(s):<id>`) are archived (recycle bin).
   *  - Stage updates (`hubspot:deal_stage:<id>:<priorStage>`) are restored to
   *    the prior stage recorded at execution time (CRM-2).
   */
  async rollback(tenantId: string, externalRef: string): Promise<AdapterResult> {
    const stage = parseStageUndoRef(externalRef);
    if (stage) {
      await this.client.updateDealStage({
        tenantId,
        externalId: stage.externalId,
        stage: stage.priorStage,
        idempotencyKey: `undo:${externalRef}`,
      });
      return { ok: true, external_ref: externalRef, detail: 'prior stage restored' };
    }
    const parsed = parseEngagementRef(externalRef);
    if (!parsed) {
      return { ok: false, detail: `unrecognized external_ref: ${externalRef}` };
    }
    await this.client.archiveEngagement({
      tenantId,
      object: parsed.object,
      externalId: parsed.id,
    });
    return { ok: true, external_ref: externalRef, detail: 'archived via HubspotClient' };
  }
}

/** Parse `hubspot:task(s)|note(s):<id>` into a typed archive target. */
function parseEngagementRef(ref: string): { object: 'tasks' | 'notes'; id: string } | null {
  const m = /^hubspot:(tasks?|notes?):(.+)$/.exec(ref);
  if (!m) return null;
  const object = m[1]!.startsWith('task') ? ('tasks' as const) : ('notes' as const);
  return { object, id: m[2]! };
}

/**
 * CRM-2 stage plan ref: `stage:<externalDealId>:<fromStage>:<toStage>`. Stage
 * names are HubSpot internal stage ids (lowercase, no colons).
 */
export function parseStagePlanRef(
  ref: string | null | undefined,
): { externalId: string; fromStage: string; toStage: string } | null {
  if (!ref) return null;
  const m = /^stage:([^:]+):([^:]+):([^:]+)$/.exec(ref);
  if (!m) return null;
  return { externalId: m[1]!, fromStage: m[2]!, toStage: m[3]! };
}

/** CRM-2 undo ref: `hubspot:deal_stage:<externalDealId>:<priorStage>`. */
function parseStageUndoRef(ref: string): { externalId: string; priorStage: string } | null {
  const m = /^hubspot:deal_stage:([^:]+):([^:]+)$/.exec(ref);
  if (!m) return null;
  return { externalId: m[1]!, priorStage: m[2]! };
}
