import { makeEvent, type KnownEventName } from '@cognitia/core';
import type { AgentRunRow, AuditEventInsert, EventRow } from '@cognitia/db';
import type { AgentDeps } from '../deps.js';

/**
 * Owns the agent_run lifecycle and emits the canonical events/audit entries.
 * Every status transition is recorded.
 */
export class AgentRunService {
  constructor(private readonly deps: AgentDeps) {}

  async createRun(input: {
    tenantId: string;
    agent: 'mira' | 'echo' | 'atlas' | 'beacon';
    objective: string;
    inputRefs?: string[];
    traceId: string;
  }): Promise<AgentRunRow> {
    const ts = this.deps.now().toISOString();
    const run: AgentRunRow = {
      id: this.deps.newId(),
      tenant_id: input.tenantId,
      agent: input.agent,
      objective: input.objective,
      input_refs: input.inputRefs ?? [],
      status: 'running',
      trace_id: input.traceId,
      created_at: ts,
      updated_at: ts,
    };
    await this.deps.repo.createAgentRun(run);
    await this.emit(run, 'agent.run.created.v1', 'agent_run', run.id, {
      agent: run.agent,
      objective: run.objective,
    });
    return run;
  }

  async complete(run: AgentRunRow, actionCount: number): Promise<void> {
    await this.deps.repo.updateAgentRunStatus(run.tenant_id, run.id, 'completed');
    await this.emit(run, 'agent.run.completed.v1', 'agent_run', run.id, {
      action_count: actionCount,
    });
  }

  async fail(run: AgentRunRow, reason: string): Promise<void> {
    await this.deps.repo.updateAgentRunStatus(run.tenant_id, run.id, 'failed');
    await this.emit(run, 'agent.run.failed.v1', 'agent_run', run.id, { reason });
  }

  /** Emit a validated event scoped to a run's tenant/trace. */
  private async emit(
    run: Pick<AgentRunRow, 'tenant_id' | 'agent' | 'trace_id'>,
    eventName: KnownEventName,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const event = makeEvent(
      {
        tenant_id: run.tenant_id,
        event_name: eventName,
        entity_type: entityType,
        entity_id: entityId,
        source: `agent:${run.agent}`,
        payload,
        trace_id: run.trace_id,
      },
      this.deps.now,
      this.deps.newId,
    ) as EventRow;
    await this.deps.repo.insertEvent(event);
  }

  /** Write an append-only audit entry. */
  async audit(input: {
    tenantId: string;
    actorRef: string;
    action: string;
    subjectRef: string;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    const ts = this.deps.now().toISOString();
    const row: AuditEventInsert = {
      id: this.deps.newId(),
      tenant_id: input.tenantId,
      actor_ref: input.actorRef,
      action: input.action,
      subject_ref: input.subjectRef,
      detail: input.detail ?? {},
      occurred_at: ts,
      created_at: ts,
    };
    await this.deps.repo.insertAuditEvent(row);
  }
}
