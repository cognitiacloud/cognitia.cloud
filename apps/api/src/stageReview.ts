import { classifyRisk, contentFingerprint } from '@cognitia/core';
import type { Repository, OpportunityRow } from '@cognitia/db';
import type { GtmServices } from '@cognitia/agents';

/**
 * CRM-2 — signal-driven stage-update proposals (approval-gated write-back).
 *
 * The signal is a fact already on the immutable event stream: a
 * `calendar.meeting.booked.v1` event whose entity is an opportunity. When such
 * an opportunity still sits in the entry stage, Mira proposes ONE
 * `crm.stage.update` action advancing it along the documented rule below. The
 * proposal is medium-risk — it can never ride the low-risk auto-approve
 * setting, so a human approves every stage write, and execution performs
 * exactly one idempotent CRM write (ledger dual-guard + adapter idempotency).
 *
 * The typed plan (`stage:<externalDealId>:<from>:<to>`) is resolved here from
 * synced CRM facts (the opportunity's own crm.opportunity.*.v1 events carry the
 * external id) and rides payload_ref — so preview==write holds (GOV-1) and
 * rollback can restore the prior stage (UNDO-1).
 */

/** The documented V1 advancement rule: booked meeting ⇒ qualified → meeting_scheduled. */
export const STAGE_ADVANCE_RULE = {
  signal: 'calendar.meeting.booked.v1',
  from_stage: 'qualified',
  to_stage: 'meeting_scheduled',
} as const;

export interface StageReviewResult {
  runId: string;
  /** Proposed action ids (one per signaled opportunity; replays collapse). */
  proposedActionIds: string[];
  /** Opportunities with a signal but no proposal, with the structured why. */
  skipped: Array<{ opportunity_id: string; reason: string }>;
}

async function externalDealId(
  repo: Repository,
  tenantId: string,
  opportunityId: string,
): Promise<string | null> {
  const events = await repo.listEvents(tenantId);
  const created = events.find(
    (e) =>
      e.entity_type === 'opportunity' &&
      e.entity_id === opportunityId &&
      (e.event_name === 'crm.opportunity.created.v1' ||
        e.event_name === 'crm.opportunity.updated.v1') &&
      typeof e.payload.external_id === 'string',
  );
  return created ? (created.payload.external_id as string) : null;
}

export async function runStageReview(
  services: GtmServices,
  repo: Repository,
  tenantId: string,
  traceId: string,
): Promise<StageReviewResult> {
  const run = await services.runService.createRun({
    tenantId,
    agent: 'mira',
    objective: 'stage-review',
    traceId,
  });

  const proposedActionIds: string[] = [];
  const skipped: StageReviewResult['skipped'] = [];
  try {
    const [events, opportunities] = await Promise.all([
      repo.listEvents(tenantId),
      repo.listOpportunities(tenantId),
    ]);
    const byId = new Map<string, OpportunityRow>(opportunities.map((o) => [o.id, o]));

    // Signal: meeting booked against an opportunity.
    const signals = events.filter(
      (e) => e.event_name === STAGE_ADVANCE_RULE.signal && e.entity_type === 'opportunity',
    );

    for (const signal of signals) {
      const opp = byId.get(signal.entity_id);
      if (!opp) {
        skipped.push({ opportunity_id: signal.entity_id, reason: 'opportunity_not_found' });
        continue;
      }
      if (opp.stage !== STAGE_ADVANCE_RULE.from_stage) {
        skipped.push({ opportunity_id: opp.id, reason: `stage_is_${opp.stage}` });
        continue;
      }
      const externalId = await externalDealId(repo, tenantId, opp.id);
      if (!externalId) {
        // No synced external id ⇒ no write target. Refuse rather than guess.
        skipped.push({ opportunity_id: opp.id, reason: 'external_id_unresolved' });
        continue;
      }

      const action = await services.ledger.propose({
        tenantId,
        agentRunId: run.id,
        agent: 'mira',
        traceId,
        actionType: 'crm.stage.update',
        riskLevel: classifyRisk('crm.stage.update'),
        targetRef: `opportunity:${opp.id}`,
        // Grounding: the booked-meeting event IS the evidence.
        evidenceRefs: [signal.id],
        contentFingerprint: contentFingerprint(
          `stage:${opp.id}:${STAGE_ADVANCE_RULE.from_stage}->${STAGE_ADVANCE_RULE.to_stage}`,
        ),
        payloadRef: `stage:${externalId}:${STAGE_ADVANCE_RULE.from_stage}:${STAGE_ADVANCE_RULE.to_stage}`,
        guardrailResults: [],
      });
      proposedActionIds.push(action.id);
    }

    await services.runService.complete(run, proposedActionIds.length);
    return { runId: run.id, proposedActionIds, skipped };
  } catch (err) {
    await services.runService.fail(run, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
