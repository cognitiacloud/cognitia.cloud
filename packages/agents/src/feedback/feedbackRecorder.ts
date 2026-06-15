import { makeEvent, type KnownEventName } from '@cognitia/core';
import type { EventRow } from '@cognitia/db';
import type { AgentDeps } from '../deps.js';
import { classifyReply, replyOutcome } from '../mira/replyClassifier.js';

/**
 * Records human edits/approvals/rejections and downstream outcomes (replies,
 * meetings) and emits learning events. PII-safe: stores classifications and
 * refs, never raw reply text.
 */
export class FeedbackRecorder {
  constructor(private readonly deps: AgentDeps) {}

  async recordFeedback(input: {
    tenantId: string;
    traceId: string;
    subjectRef: string;
    kind: string;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    await this.emit(input.tenantId, input.traceId, 'agent.feedback.recorded.v1', input.subjectRef, {
      kind: input.kind,
    });
    await this.deps.repo.insertAuditEvent({
      id: this.deps.newId(),
      tenant_id: input.tenantId,
      actor_ref: 'system',
      action: 'feedback',
      subject_ref: input.subjectRef,
      detail: { kind: input.kind, ...(input.detail ?? {}) },
      occurred_at: this.deps.now().toISOString(),
      created_at: this.deps.now().toISOString(),
    });
  }

  /** Classify a reply and record the outcome (no raw text persisted). */
  async recordReply(input: {
    tenantId: string;
    traceId: string;
    conversationRef: string;
    replyText: string;
  }): Promise<{
    classification: ReturnType<typeof classifyReply>;
    outcome: ReturnType<typeof replyOutcome>;
  }> {
    const classification = classifyReply(input.replyText);
    const outcome = replyOutcome(classification);
    await this.recordFeedback({
      tenantId: input.tenantId,
      traceId: input.traceId,
      subjectRef: input.conversationRef,
      kind: `reply:${classification}`,
      detail: { ...outcome },
    });
    return { classification, outcome };
  }

  private async emit(
    tenantId: string,
    traceId: string,
    eventName: KnownEventName,
    subjectRef: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const [entityType, entityId] = subjectRef.split(':');
    const event = makeEvent(
      {
        tenant_id: tenantId,
        event_name: eventName,
        entity_type: entityType ?? 'entity',
        entity_id: entityId ?? subjectRef,
        source: 'agent:mira',
        payload,
        trace_id: traceId,
      },
      this.deps.now,
      this.deps.newId,
    ) as EventRow;
    await this.deps.repo.insertEvent(event);
  }
}
